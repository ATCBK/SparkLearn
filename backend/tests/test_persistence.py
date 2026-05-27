from pathlib import Path

import pytest


@pytest.mark.asyncio
async def test_profile_dialog_persistence(client):
    r = await client.post("/api/profile/initiate", json={})
    assert r.status_code == 200
    session_id = r.json()["data"]["session_id"]

    for msg in ["我是计算机专业大二", "我目标是期末提分", "我薄弱点是函数和面向对象"]:
        c = await client.post("/api/profile/chat", json={"session_id": session_id, "message": msg})
        assert c.status_code == 200
        assert '"type": "done"' in c.text

    base = Path("d:/Project_building/SparkLearn/backend/data/users/single_user")
    snap = base / "profile_snapshot.json"
    events = base / "learning_events.jsonl"
    assert snap.exists()
    assert events.exists()
    assert "profile_dialog_completed" in events.read_text(encoding="utf-8")

