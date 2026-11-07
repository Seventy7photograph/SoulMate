from __future__ import annotations

import json
import os
import re
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

Emotion = Literal["IDLE", "HAPPY", "SHY", "SAD", "SLEEPY", "ANGRY"]
Action = Literal["IDLE", "JUMP", "DANCE", "WAVE", "PUNCH", "SIT"]


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    systemInstruction: str = Field(default="", max_length=500)
    displayName: str = Field(default="小雅", max_length=20)
    bio: str = Field(default="", max_length=120)


class AnalyzeResponse(BaseModel):
    emotion: Emotion
    action: Action
    reply: str = Field(min_length=1, max_length=160)
    confidence: float = Field(ge=0, le=1)
    provider: str = Field(default="local", min_length=1, max_length=40)


class PreferencesPayload(BaseModel):
    displayName: str = Field(min_length=1, max_length=20)
    accentColor: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    bio: str = Field(max_length=120)
    sceneId: str = Field(min_length=1, max_length=20)
    characterId: str = Field(min_length=1, max_length=30)


class EventPayload(BaseModel):
    source: str = Field(min_length=1, max_length=30)
    type: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=40)
    detail: str = Field(max_length=200)
    emotion: str = Field(min_length=1, max_length=20)
    action: str = Field(min_length=1, max_length=20)
    sceneId: str = Field(min_length=1, max_length=20)
    characterId: str = Field(min_length=1, max_length=30)
    status: str = Field(min_length=1, max_length=20)


def pick_variant(text: str, variants: list[str]) -> str:
    hash_value = 0
    for character in text:
        hash_value = (hash_value * 31 + ord(character)) & 0xFFFFFFFF
    index = hash_value % len(variants)
    return variants[index]


def quoted_topic(text: str) -> str:
    compact = " ".join(text.split())
    return f"{compact[:20]}…" if len(compact) > 20 else compact


SEMANTICS_PATH = (
    Path(__file__).resolve().parent.parent
    / "shared"
    / "companion-intents.json"
)
with SEMANTICS_PATH.open(encoding="utf-8") as semantics_file:
    SEMANTIC_RULES = sorted(
        json.load(semantics_file),
        key=lambda rule: int(rule["priority"]),
        reverse=True,
    )
for semantic_rule in SEMANTIC_RULES:
    semantic_rule["matchers"] = [
        re.compile(pattern, re.IGNORECASE)
        for pattern in semantic_rule["patterns"]
    ]

EMOTION_FALLBACKS = {
    "IDLE": "我在听。今天想和我聊点什么？",
    "HAPPY": "你这么说，我心里一下子亮起来了。",
    "SHY": "唔，被你摸到了。",
    "SAD": "不用急着说话，我会安静陪着你。",
    "SLEEPY": "声音轻一点，我有点困了。",
    "ANGRY": "哼，我听出来了，你有点不开心。",
}
QUESTIONS_AND_REQUESTS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"[?？]",
        r"(?:吗|么|呢|吧)[。！!？? ]*$",
        r"如何",
        r"怎么",
        r"为什么",
        r"为何",
        r"什么",
        r"哪里",
        r"哪儿",
        r"谁",
        r"多少",
        r"几点",
        r"能不能",
        r"可不可以",
        r"有没有",
        r"是否",
        r"要不要",
        r"帮我",
        r"请问",
    )
]


def local_analysis(text: str) -> AnalyzeResponse:
    normalized = " ".join(text.split()).lower()
    if not normalized:
        return AnalyzeResponse(
            emotion="IDLE",
            action="IDLE",
            reply=EMOTION_FALLBACKS["IDLE"],
            confidence=0.0,
            provider="local",
        )

    for rule in SEMANTIC_RULES:
        if any(matcher.search(normalized) for matcher in rule["matchers"]):
            return AnalyzeResponse(
                emotion=rule["emotion"],
                action=rule["action"],
                reply=pick_variant(normalized, rule["replies"]),
                confidence=rule["confidence"],
                provider="local",
            )

    if any(
        pattern.search(normalized)
        for pattern in QUESTIONS_AND_REQUESTS
    ):
        return AnalyzeResponse(
            emotion="IDLE",
            action="IDLE",
            reply=(
                f"我听见你在问「{quoted_topic(text)}」。"
                "如果需要实时或专业信息，我可能无法给准确答案；"
                "但我可以先陪你把思路理清。"
            ),
            confidence=0.68,
            provider="local",
        )
    return AnalyzeResponse(
        emotion="IDLE",
        action="IDLE",
        reply=pick_variant(
            normalized,
            [
                f"我听见了你在说「{quoted_topic(text)}」。我会在这里，你可以继续讲下去。",
                f"「{quoted_topic(text)}」这件事，我想再多听一点。它对你来说意味着什么？",
                "我把这句话认真记住了。现在最想让我陪你聊哪一部分？",
            ],
        ),
        confidence=0.6,
        provider="local",
    )


def build_system_prompt(
    display_name: str,
    bio: str,
    system_instruction: str,
) -> str:
    identity = display_name.strip() or "小雅"
    biography = bio.strip() or "住在午后温室里的数字生命。"
    instruction = system_instruction.strip() or "保持温柔、自然、简洁，不要像客服。"
    return (
        "You are an AI companion state classifier and dialogue responder. "
        f"Your name is {identity}. Character biography: {biography}. "
        f"Developer instruction: {instruction}. "
        "Return JSON only with keys emotion, action, reply, confidence. "
        "emotion must be one of IDLE,HAPPY,SHY,SAD,SLEEPY,ANGRY. "
        "action must be one of IDLE,JUMP,DANCE,WAVE,PUNCH,SIT. "
        "reply must be concise Chinese under 120 characters. "
        "Never invent actions or diagnostic claims about the user."
    )


async def gemini_analysis(
    text: str,
    api_key: str,
    model_name: str,
    system_prompt: str,
) -> AnalyzeResponse:
    prompt = f"{system_prompt}\nMessage: {text}"
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_name}:generateContent"
    )
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.post(
            endpoint,
            params={"key": api_key},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.35,
                    "responseMimeType": "application/json",
                },
            },
        )
        response.raise_for_status()

    body = response.json()
    raw_text = body["candidates"][0]["content"]["parts"][0]["text"]
    cleaned = raw_text.strip().removeprefix("```json").removesuffix("```").strip()
    data = json.loads(cleaned)
    return AnalyzeResponse.model_validate({**data, "provider": "gemini"})


async def openai_compatible_analysis(
    text: str,
    base_url: str,
    api_key: str,
    model_name: str,
    system_prompt: str,
) -> AnalyzeResponse:
    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.post(
            endpoint,
            headers=headers,
            json={
                "model": model_name,
                "temperature": 0.35,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text},
                ],
            },
        )
        response.raise_for_status()

    body = response.json()
    raw_text = body["choices"][0]["message"]["content"]
    cleaned = raw_text.strip().removeprefix("```json").removesuffix("```").strip()
    data = json.loads(cleaned)
    return AnalyzeResponse.model_validate(
        {**data, "provider": "openai-compatible"}
    )


def normalized_model_analysis(
    data: dict[str, object],
    text: str,
    provider: str,
) -> AnalyzeResponse:
    local = local_analysis(text)
    emotions = {"IDLE", "HAPPY", "SHY", "SAD", "SLEEPY", "ANGRY"}
    actions = {"IDLE", "JUMP", "DANCE", "WAVE", "PUNCH", "SIT"}
    emotion = str(data.get("emotion", "")).upper()
    action = str(data.get("action", "")).upper()
    reply = str(data.get("reply", "")).strip()[:160]
    try:
        confidence = float(data.get("confidence", 0.72))
    except (TypeError, ValueError):
        confidence = 0.72
    return AnalyzeResponse(
        emotion=emotion if emotion in emotions else local.emotion,
        action=action if action in actions else local.action,
        reply=reply or local.reply,
        confidence=max(0.0, min(1.0, confidence)),
        provider=provider,
    )


async def pollinations_analysis(
    text: str,
    model_name: str,
    system_prompt: str,
) -> AnalyzeResponse:
    async with httpx.AsyncClient(timeout=18) as client:
        response = await client.post(
            "https://text.pollinations.ai/openai",
            json={
                "model": model_name or "openai",
                "temperature": 0.4,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text},
                ],
            },
        )
        response.raise_for_status()
    body = response.json()
    raw_text = body["choices"][0]["message"]["content"]
    cleaned = raw_text.strip().removeprefix("```json").removesuffix("```").strip()
    data = json.loads(cleaned)
    if not isinstance(data, dict):
        raise ValueError("Pollinations response is not a JSON object")
    return normalized_model_analysis(data, text, "pollinations")


def initialize_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS preferences (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


def create_app(
    db_path: str | Path | None = None,
    gemini_api_key: str | None = None,
    gemini_model: str | None = None,
    llm_provider: str | None = None,
    llm_base_url: str | None = None,
    llm_api_key: str | None = None,
    llm_model: str | None = None,
) -> FastAPI:
    resolved_db_path = Path(
        db_path or os.getenv("AOLINU_DB_PATH", "server/data/aolinu.db")
    )
    initialize_db(resolved_db_path)
    requested_provider = (
        llm_provider
        or os.getenv("LLM_PROVIDER")
        or ("gemini" if gemini_api_key else "local")
    ).strip().lower()
    if requested_provider in {"openai", "openai_compatible", "openai-compatible"}:
        provider = "openai-compatible"
    elif requested_provider == "gemini":
        provider = "gemini"
    elif requested_provider in {"pollinations", "free"}:
        provider = "pollinations"
    else:
        provider = "local"
    resolved_base_url = llm_base_url or os.getenv("LLM_BASE_URL", "")
    resolved_api_key = llm_api_key or os.getenv("LLM_API_KEY", "")
    resolved_model = llm_model or os.getenv("LLM_MODEL", "")
    if provider == "gemini" and not gemini_api_key:
        provider = "local"
    if provider == "openai-compatible" and not (
        resolved_base_url and resolved_model
    ):
        provider = "local"

    app = FastAPI(title="AOLINU SoulMate API", version="1.0.0")
    allowed_origins = os.getenv(
        "AOLINU_ALLOWED_ORIGINS",
        "http://127.0.0.1:4173,http://localhost:4173",
    ).split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in allowed_origins],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    def connect() -> sqlite3.Connection:
        connection = sqlite3.connect(resolved_db_path)
        connection.row_factory = sqlite3.Row
        return connection

    @app.get("/api/health")
    async def health() -> dict[str, object]:
        return {
            "status": "ok",
            "ai_configured": provider != "local",
            "provider": provider,
        }

    @app.post("/api/analyze", response_model=AnalyzeResponse)
    async def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
        system_prompt = build_system_prompt(
            payload.displayName,
            payload.bio,
            payload.systemInstruction,
        )
        if provider == "local":
            return local_analysis(payload.text)
        try:
            if provider == "gemini":
                return await gemini_analysis(
                    payload.text,
                    gemini_api_key or "",
                    gemini_model or "gemini-2.5-flash",
                    system_prompt,
                )
            if provider == "pollinations":
                return await pollinations_analysis(
                    payload.text,
                    resolved_model or "openai",
                    system_prompt,
                )
            return await openai_compatible_analysis(
                payload.text,
                resolved_base_url,
                resolved_api_key,
                resolved_model,
                system_prompt,
            )
        except Exception:
            return local_analysis(payload.text)

    @app.post("/api/preferences")
    async def save_preferences(payload: PreferencesPayload) -> dict[str, bool]:
        serialized = payload.model_dump_json()
        timestamp = datetime.now(UTC).isoformat()
        with connect() as connection:
            connection.execute(
                """
                INSERT INTO preferences (id, payload, updated_at)
                VALUES (1, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    payload = excluded.payload,
                    updated_at = excluded.updated_at
                """,
                (serialized, timestamp),
            )
        return {"saved": True}

    @app.get("/api/preferences")
    async def get_preferences() -> PreferencesPayload | None:
        with connect() as connection:
            row = connection.execute(
                "SELECT payload FROM preferences WHERE id = 1"
            ).fetchone()
        if row is None:
            return None
        return PreferencesPayload.model_validate_json(row["payload"])

    @app.post("/api/events")
    async def save_event(payload: EventPayload) -> dict[str, bool]:
        timestamp = datetime.now(UTC).isoformat()
        with connect() as connection:
            connection.execute(
                "INSERT INTO events (payload, created_at) VALUES (?, ?)",
                (payload.model_dump_json(), timestamp),
            )
        return {"saved": True}

    @app.get("/api/events")
    async def list_events(limit: int = 50) -> list[dict[str, object]]:
        safe_limit = max(1, min(limit, 200))
        with connect() as connection:
            rows = connection.execute(
                """
                SELECT id, payload, created_at
                FROM events
                ORDER BY id DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "createdAt": row["created_at"],
                **json.loads(row["payload"]),
            }
            for row in rows
        ]

    return app


load_dotenv()

app = create_app(
    gemini_api_key=os.getenv("GEMINI_API_KEY"),
    gemini_model=os.getenv("GEMINI_MODEL"),
    llm_provider=os.getenv("LLM_PROVIDER"),
    llm_base_url=os.getenv("LLM_BASE_URL"),
    llm_api_key=os.getenv("LLM_API_KEY"),
    llm_model=os.getenv("LLM_MODEL"),
)

