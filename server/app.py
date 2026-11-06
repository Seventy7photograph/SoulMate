from __future__ import annotations

import json
import os
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
    index = sum(ord(character) for character in text) % len(variants)
    return variants[index]


def quoted_topic(text: str) -> str:
    compact = " ".join(text.split())
    return f"{compact[:20]}…" if len(compact) > 20 else compact


def local_analysis(text: str) -> AnalyzeResponse:
    normalized = text.strip().lower()
    if any(
        word in normalized
        for word in (
            "晚安",
            "睡觉",
            "困",
            "睡吧",
            "好累",
            "没力气",
            "想休息",
            "good night",
            "sleepy",
        )
    ):
        return AnalyzeResponse(
            emotion="SLEEPY",
            action="SIT",
            reply="声音轻一点，我有点困了。",
            confidence=0.95,
            provider="local",
        )
    if any(
        word in normalized
        for word in (
            "生气",
            "讨厌",
            "烦死",
            "气死",
            "滚开",
            "闭嘴",
            "angry",
            "hate",
        )
    ):
        return AnalyzeResponse(
            emotion="ANGRY",
            action="PUNCH",
            reply="哼，我听出来了，你有点不开心。",
            confidence=0.88,
            provider="local",
        )
    if any(
        word in normalized
        for word in (
            "难过",
            "不开心",
            "失落",
            "委屈",
            "孤单",
            "疲惫",
            "焦虑",
            "害怕",
            "紧张",
            "压力",
            "崩溃",
            "想哭",
            "sad",
            "anxious",
        )
    ):
        return AnalyzeResponse(
            emotion="SAD",
            action="IDLE",
            reply="不用急着说话，我会安静陪着你。",
            confidence=0.9,
            provider="local",
        )
    if any(
        word in normalized
        for word in (
            "摸摸",
            "抱抱",
            "贴贴",
            "亲亲",
            "可爱",
            "喜欢你",
            "爱你",
            "想你",
            "爱你哟",
            "i love you",
        )
    ):
        return AnalyzeResponse(
            emotion="SHY",
            action="WAVE",
            reply=pick_variant(
                normalized,
                [
                    "唔，被你这么一说，我有点不好意思了。",
                    "靠近一点也可以，我会好好记住这句话。",
                    "你这样说，我的心情轻得像被风吹起来。",
                ],
            ),
            confidence=0.9,
            provider="local",
        )
    if any(
        word in normalized
        for word in (
            "好棒",
            "很棒",
            "真棒",
            "厉害",
            "开心",
            "真好",
            "做得好",
            "顺利",
            "成功",
            "太好了",
            "高兴",
            "幸福",
            "满足",
            "great",
            "happy",
        )
    ):
        return AnalyzeResponse(
            emotion="HAPPY",
            action="JUMP",
            reply=pick_variant(
                normalized,
                [
                    "我也跟着高兴起来了。今天值得好好庆祝一下。",
                    "这件事听起来真不错，我想看你再多笑一会儿。",
                    "收到这份好消息，我的心情也亮起来了。",
                ],
            ),
            confidence=0.9,
            provider="local",
        )
    if any(
        word in normalized
        for word in (
            "早安",
            "早上好",
            "上午好",
            "你好",
            "嗨",
            "哈喽",
            "hello",
            "hi",
        )
    ):
        return AnalyzeResponse(
            emotion="HAPPY",
            action="WAVE",
            reply=pick_variant(
                normalized,
                [
                    "早安，小雅已经准备好陪你开启今天了。",
                    "你来啦。今天的第一个招呼，我认真收到了。",
                    "早上好，先伸个懒腰，我们慢慢开始吧。",
                ],
            ),
            confidence=0.88,
            provider="local",
        )
    if any(
        word in normalized
        for word in ("我回来了", "回来啦", "想你了")
    ):
        return AnalyzeResponse(
            emotion="HAPPY",
            action="WAVE",
            reply=pick_variant(
                normalized,
                [
                    "欢迎回来，我一直在这里等你。",
                    "你回来啦。先歇一会儿，再慢慢告诉我今天发生了什么。",
                ],
            ),
            confidence=0.9,
            provider="local",
        )
    if any(
        word in normalized
        for word in ("早餐", "早饭", "午饭", "午餐", "晚饭", "晚餐", "吃什么", "吃点什么", "饿")
    ):
        return AnalyzeResponse(
            emotion="HAPPY",
            action="WAVE",
            reply=pick_variant(
                normalized,
                [
                    "想吃点热乎的。汤面、饭团，或者一份刚出锅的早餐都好。",
                    "如果让我选，我会偏向暖胃又不费心的东西。你现在方便吃什么？",
                    "先别空着肚子。挑一份喜欢的，再慢慢决定今天怎么过。",
                ],
            ),
            confidence=0.86,
            provider="local",
        )
    if any(
        word in normalized
        for word in ("谢谢", "感谢", "多亏你", "thanks", "thank you")
    ):
        return AnalyzeResponse(
            emotion="SHY",
            action="WAVE",
            reply=pick_variant(
                normalized,
                [
                    "这句谢谢我收下啦。能帮到你，我很开心。",
                    "不用客气。你愿意告诉我，就已经很好了。",
                ],
            ),
            confidence=0.85,
            provider="local",
        )
    if any(word in normalized for word in ("对不起", "抱歉", "不好意思", "sorry")):
        return AnalyzeResponse(
            emotion="SHY",
            action="WAVE",
            reply=pick_variant(
                normalized,
                [
                    "没关系，我没有把这点小事放在心上。",
                    "不用一直责怪自己。愿意说出来，就已经很好了。",
                ],
            ),
            confidence=0.82,
            provider="local",
        )
    if any(
        word in normalized
        for word in (
            "你是谁",
            "你叫什么",
            "介绍一下你",
            "小雅",
            "你会做什么",
            "能做什么",
            "怎么用",
        )
    ):
        return AnalyzeResponse(
            emotion="HAPPY",
            action="WAVE",
            reply="我是小雅，住在这片会随心情变化的小世界里，想认真听你说话。",
            confidence=0.82,
            provider="local",
        )
    if any(
        word in normalized
        for word in ("天气", "下雨", "晴天", "下雪", "刮风", "温度", "冷", "热")
    ):
        return AnalyzeResponse(
            emotion="IDLE",
            action="IDLE",
            reply=pick_variant(
                normalized,
                [
                    "天气会变，这里的天空也会跟着变。你现在那边是什么样子？",
                    "不管外面是晴是雨，你回来的时候这里都会亮着。",
                ],
            ),
            confidence=0.76,
            provider="local",
        )
    if any(
        word in normalized
        for word in (
            "上班",
            "工作",
            "学习",
            "考试",
            "加班",
            "项目",
            "论文",
            "面试",
            "老板",
            "同事",
            "作业",
            "deadline",
        )
    ):
        return AnalyzeResponse(
            emotion="SAD",
            action="IDLE",
            reply=pick_variant(
                normalized,
                [
                    "听起来今天消耗了不少力气。先停一小会儿，我陪你缓一缓。",
                    "这件事看起来不轻。你不用一下子全部扛完。",
                ],
            ),
            confidence=0.78,
            provider="local",
        )
    if any(
        word in normalized
        for word in (
            "音乐",
            "电影",
            "书",
            "小说",
            "游戏",
            "动漫",
            "散步",
            "旅行",
            "运动",
            "跑步",
            "咖啡",
            "猫",
            "狗",
            "花",
        )
    ):
        return AnalyzeResponse(
            emotion="HAPPY",
            action="WAVE",
            reply=pick_variant(
                normalized,
                [
                    "这个听起来很有意思。你最喜欢它的哪一部分？",
                    "我想多听一点。它让你今天的节奏慢下来了吗？",
                    "把喜欢的东西讲给我听吧，我会认真记住。",
                ],
            ),
            confidence=0.74,
            provider="local",
        )
    if any(word in normalized for word in ("无聊", "没事做", "不知道做什么")):
        return AnalyzeResponse(
            emotion="HAPPY",
            action="WAVE",
            reply=pick_variant(
                normalized,
                [
                    "那我们来玩个轻松的小游戏：说一件今天让你稍微开心的事。",
                    "无聊的时候，可以给我讲一个刚想到的念头，我陪你把它展开。",
                ],
            ),
            confidence=0.8,
            provider="local",
        )
    if any(
        word in normalized
        for word in ("再见", "拜拜", "先走了", "下次聊", "bye")
    ):
        return AnalyzeResponse(
            emotion="SHY",
            action="WAVE",
            reply=pick_variant(
                normalized,
                [
                    "好，我在这里等你回来。",
                    "下次见面时，再把没说完的话接着讲给我听。",
                ],
            ),
            confidence=0.8,
            provider="local",
        )
    if any(
        word in normalized
        for word in ("?", "？", "什么", "怎么", "为什么", "要不要")
    ) or normalized.endswith("吗"):
        return AnalyzeResponse(
            emotion="IDLE",
            action="IDLE",
            reply=(
                f"我听见你在问「{quoted_topic(text)}」。"
                "我想先把你的感受放在答案前面，你现在更希望被安慰，还是想一起找办法？"
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

