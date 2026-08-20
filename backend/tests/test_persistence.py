from pathlib import Path

import pytest

from app.config import settings
from app.routes import profile as profile_route


@pytest.mark.asyncio
async def test_profile_dialog_persistence(client, monkeypatch):
    async def fake_stream(prompt: str, mode: str, history: list):
        if "从对话中提取学习画像事实" in prompt:
            content = (
                '{"major":"计算机科学","goal":["期末提分"],"knowledge_level":"",'
                '"weak_points":["函数","面向对象"],"learning_preference":[],"cognitive_style":"",'
                '"daily_time":0,"practical_ability":"","current_stage":""}'
            )
        elif "学习画像融合分析器" in prompt:
            content = (
                '{"overview":"当前画像概览","narrative":"对话持久化融合画像",'
                '"goal_gap":"待验证","strengths":[],"focus_areas":["函数","面向对象"],'
                '"learning_strategy":"尚未采集","next_actions":[],"confidence":0.75}'
            )
        else:
            content = "请继续说明。"
        yield ("text", {"content": content})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", fake_stream)
    r = await client.post("/api/profile/initiate", json={})
    assert r.status_code == 200
    session_id = r.json()["data"]["session_id"]

    for msg in ["我是计算机专业大二", "我目标是期末提分", "我薄弱点是函数和面向对象"]:
        c = await client.post("/api/profile/chat", json={"session_id": session_id, "message": msg})
        assert c.status_code == 200
        assert '"type": "done"' in c.text

    base = Path(settings.data_dir) / "users" / settings.single_user_id
    snap = base / "profile_snapshot.json"
    analysis = base / "profile_ai_analysis.json"
    events = base / "learning_events.jsonl"
    assert snap.exists()
    assert analysis.exists()
    assert events.exists()
    assert "对话持久化融合画像" in analysis.read_text(encoding="utf-8")
    events_text = events.read_text(encoding="utf-8")
    assert "profile_dialog_completed" in events_text
    assert "我是计算机专业大二" in events_text

