import asyncio
from pathlib import Path

import httpx

import server.app as app_module
from server.app import create_app


def test_health_and_local_analysis(tmp_path: Path) -> None:
    app = create_app(
        db_path=tmp_path / "test.db",
        gemini_api_key=None,
    )
    async def run() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            health = await client.get("/api/health")
            assert health.status_code == 200
            assert health.json() == {
                "status": "ok",
                "ai_configured": False,
                "provider": "local",
            }

            response = await client.post(
                "/api/analyze",
                json={"text": "晚安，早点睡"},
            )
            assert response.status_code == 200
            body = response.json()
            assert body["emotion"] == "SLEEPY"
            assert body["action"] == "SIT"
            assert body["provider"] == "local"
            assert 0 <= body["confidence"] <= 1

            greeting = await client.post(
                "/api/analyze",
                json={"text": "早上好"},
            )
            breakfast = await client.post(
                "/api/analyze",
                json={"text": "早餐吃点什么好呢"},
            )
            assert greeting.json()["emotion"] == "HAPPY"
            assert greeting.json()["action"] == "WAVE"
            assert breakfast.json()["emotion"] == "HAPPY"
            assert breakfast.json()["reply"] != greeting.json()["reply"]

    asyncio.run(run())


def test_prompt_contains_developer_instruction_and_companion_identity() -> None:
    prompt = app_module.build_system_prompt(
        display_name="小雅",
        bio="住在夜航温室里的数字生命。",
        system_instruction="回答简短，像在夜晚轻声说话。",
    )

    assert "小雅" in prompt
    assert "夜航温室" in prompt
    assert "回答简短" in prompt
    assert "JSON" in prompt


def test_local_analysis_covers_broader_conversation_scenes() -> None:
    cases = {
        "我回来了": ("HAPPY", "WAVE"),
        "最近很焦虑": ("SAD", "IDLE"),
        "陪我看电影吧": ("HAPPY", "WAVE"),
        "有点无聊": ("HAPPY", "WAVE"),
        "对不起，刚才语气重了": ("SHY", "WAVE"),
        "你会做什么": ("HAPPY", "WAVE"),
        "bye": ("SHY", "WAVE"),
    }
    for text, expected in cases.items():
        result = app_module.local_analysis(text)
        assert (result.emotion, result.action) == expected
        assert len(result.reply) > 4


def test_local_analysis_covers_expanded_natural_expressions() -> None:
    cases = {
        "下午好": ("HAPPY", "WAVE"),
        "好久不见": ("HAPPY", "WAVE"),
        "我想死你了": ("SHY", "WAVE"),
        "我最近开心不起来": ("SAD", "IDLE"),
        "头疼得厉害": ("SAD", "IDLE"),
        "我被裁员了": ("SAD", "IDLE"),
        "终于拿到 offer 了": ("HAPPY", "JUMP"),
        "陪我聊聊天吧": ("SHY", "WAVE"),
        "你吃饭了吗": ("HAPPY", "WAVE"),
        "今天降温了": ("IDLE", "IDLE"),
        "what can you do": ("HAPPY", "WAVE"),
        "I feel really lonely": ("SAD", "IDLE"),
        "好的": ("IDLE", "IDLE"),
        "哈哈哈哈哈": ("HAPPY", "JUMP"),
        "呜呜呜": ("SAD", "IDLE"),
        "see you": ("SHY", "WAVE"),
        "who are you": ("HAPPY", "WAVE"),
        "I passed the exam": ("HAPPY", "JUMP"),
    }
    for text, expected in cases.items():
        result = app_module.local_analysis(text)
        assert (result.emotion, result.action) == expected
        assert len(result.reply) > 4


def test_crisis_language_is_distinct_from_affection() -> None:
    affection = app_module.local_analysis("我想死你了")
    crisis = app_module.local_analysis("我真的不想活了")

    assert affection.emotion == "SHY"
    assert crisis.emotion == "SAD"
    assert "紧急援助" in crisis.reply


def test_generic_question_does_not_use_idle_fallback() -> None:
    result = app_module.local_analysis("冰箱里有什么")

    assert result.emotion == "IDLE"
    assert "我听见你在问" in result.reply
    assert result.reply != "我在听。今天想和我聊点什么？"


def test_pollinations_response_is_normalized_to_supported_state() -> None:
    result = app_module.normalized_model_analysis(
        {
            "emotion": "friendly",
            "action": "greeting",
            "reply": "早上好，今天也一起慢慢来。",
            "confidence": 1.4,
        },
        "早上好",
        "pollinations",
    )

    assert result.emotion == "HAPPY"
    assert result.action == "WAVE"
    assert result.reply == "早上好，今天也一起慢慢来。"
    assert result.confidence == 1.0
    assert result.provider == "pollinations"


def test_pollinations_provider_is_wired_through_analyze(
    tmp_path: Path,
    monkeypatch,
) -> None:
    async def fake_pollinations(
        text: str,
        model_name: str,
        system_prompt: str,
    ):
        assert text == "早上好"
        assert model_name == "openai"
        assert "小雅" in system_prompt
        return app_module.AnalyzeResponse(
            emotion="HAPPY",
            action="WAVE",
            reply="早上好，今天也一起慢慢来。",
            confidence=0.82,
            provider="pollinations",
        )

    monkeypatch.setattr(
        app_module,
        "pollinations_analysis",
        fake_pollinations,
    )
    app = create_app(
        db_path=tmp_path / "pollinations.db",
        llm_provider="pollinations",
        llm_model="openai",
    )

    async def run() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/api/analyze",
                json={"text": "早上好", "displayName": "小雅"},
            )
            assert response.status_code == 200
            assert response.json()["provider"] == "pollinations"
            assert response.json()["emotion"] == "HAPPY"

    asyncio.run(run())


def test_openai_compatible_provider_uses_shared_contract(
    tmp_path: Path,
    monkeypatch,
) -> None:
    captured: dict[str, str] = {}

    async def fake_openai_analysis(
        text: str,
        base_url: str,
        api_key: str,
        model_name: str,
        system_prompt: str,
    ):
        captured.update(
            {
                "text": text,
                "base_url": base_url,
                "api_key": api_key,
                "model_name": model_name,
                "system_prompt": system_prompt,
            }
        )
        return app_module.AnalyzeResponse(
            emotion="HAPPY",
            action="WAVE",
            reply="听见了。",
            confidence=0.9,
            provider="openai-compatible",
        )

    monkeypatch.setattr(
        app_module,
        "openai_compatible_analysis",
        fake_openai_analysis,
    )
    app = create_app(
        db_path=tmp_path / "test.db",
        llm_provider="openai-compatible",
        llm_base_url="http://127.0.0.1:11434/v1",
        llm_api_key="ollama",
        llm_model="qwen-test",
    )

    async def run() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/api/analyze",
                json={
                    "text": "你好",
                    "systemInstruction": "不要说教。",
                    "displayName": "小雅",
                    "bio": "温柔的陪伴者。",
                },
            )
            assert response.status_code == 200
            assert response.json()["provider"] == "openai-compatible"

    asyncio.run(run())
    assert captured["base_url"] == "http://127.0.0.1:11434/v1"
    assert captured["model_name"] == "qwen-test"
    assert "不要说教" in captured["system_prompt"]


def test_preferences_round_trip(tmp_path: Path) -> None:
    app = create_app(db_path=tmp_path / "test.db", gemini_api_key=None)
    payload = {
        "displayName": "阿宁",
        "accentColor": "#d46a2f",
        "bio": "喜欢下午四点的阳光。",
        "sceneId": "FOREST",
        "characterId": "ROBOT_EXPRESSIVE",
    }

    async def run() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            saved = await client.post("/api/preferences", json=payload)
            loaded = await client.get("/api/preferences")

            assert saved.status_code == 200
            assert loaded.status_code == 200
            assert loaded.json() == payload

    asyncio.run(run())


def test_event_persistence(tmp_path: Path) -> None:
    app = create_app(db_path=tmp_path / "test.db", gemini_api_key=None)
    payload = {
        "source": "QUICK_ACTION",
        "type": "EMOTION_CHANGE",
        "label": "快捷互动",
        "detail": "夸夸它",
        "emotion": "HAPPY",
        "action": "JUMP",
        "sceneId": "MEADOW",
        "characterId": "ROBOT_EXPRESSIVE",
        "status": "SUCCESS",
    }

    async def run() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            saved = await client.post("/api/events", json=payload)
            events = await client.get("/api/events")

            assert saved.status_code == 200
            assert events.status_code == 200
            assert len(events.json()) == 1
            assert events.json()[0]["detail"] == "夸夸它"

    asyncio.run(run())

