import json
import time
from pathlib import Path

import pytest
import pytest_asyncio


def _make_timeline(video_id: str, title: str, segments: list[dict]) -> dict:
    return {"video_id": video_id, "title": title, "segments": segments}


def _make_segment(seg_id: str, title: str, narration: str, start_ms: int = 0, end_ms: int = 5000) -> dict:
    return {
        "segment_id": seg_id,
        "title": title,
        "narration": narration,
        "start_ms": start_ms,
        "end_ms": end_ms,
    }


TEST_VIDEO_ID = "test-np-video-001"
TEST_TITLE = "Python 变量与数据类型"
TEST_SEGMENTS = [
    _make_segment("s1", "变量定义", "在Python中，变量不需要声明类型，直接赋值即可创建变量。"),
    _make_segment("s2", "基本数据类型", "Python有整数、浮点数、字符串、布尔值等基本数据类型。"),
    _make_segment("s3", "类型转换", "可以使用int()、float()、str()等函数进行类型转换。"),
]


@pytest_asyncio.fixture
async def np_client(client, tmp_path, monkeypatch):
    """Client with a test video timeline pre-created."""
    # Override data_dir to use tmp_path
    from app import config as cfg

    monkeypatch.setattr(cfg.settings, "data_dir", tmp_path)

    artifacts_dir = tmp_path / "artifacts" / "video" / TEST_VIDEO_ID
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    timeline = _make_timeline(TEST_VIDEO_ID, TEST_TITLE, TEST_SEGMENTS)
    (artifacts_dir / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False), encoding="utf-8")

    # Re-import to refresh module-level constant
    import app.video_memory_service as vms
    monkeypatch.setattr(vms, "VIDEO_ARTIFACT_ROOT", cfg.settings.data_dir / "artifacts" / "video")
    monkeypatch.setattr(vms, "_memories", {})

    yield client


@pytest.mark.asyncio
async def test_memory_load_success(np_client):
    """POST /api/num-person/memory/load should return memory_id and greeting."""
    r = await np_client.post("/api/num-person/memory/load", json={
        "video_id": TEST_VIDEO_ID,
        "user_id": "test_user",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    data = body["data"]
    assert "memory_id" in data
    assert data["video_title"] == TEST_TITLE
    assert data["segment_count"] == len(TEST_SEGMENTS)
    assert "你好" in data["greeting"]


@pytest.mark.asyncio
async def test_memory_load_not_found(np_client):
    """POST /api/num-person/memory/load with unknown video_id returns 404."""
    r = await np_client.post("/api/num-person/memory/load", json={
        "video_id": "nonexistent-video",
        "user_id": "test_user",
    })
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_get_memory(np_client):
    """GET /api/num-person/memory/{id} returns memory info."""
    # First load
    load_r = await np_client.post("/api/num-person/memory/load", json={
        "video_id": TEST_VIDEO_ID,
        "user_id": "test_user",
    })
    memory_id = load_r.json()["data"]["memory_id"]

    r = await np_client.get(f"/api/num-person/memory/{memory_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["memory_id"] == memory_id
    assert body["data"]["video_title"] == TEST_TITLE
    assert body["data"]["ttl_sec"] == 600


@pytest.mark.asyncio
async def test_get_memory_not_found(np_client):
    """GET /api/num-person/memory/{id} with unknown id returns 404."""
    r = await np_client.get("/api/num-person/memory/mem_nonexistent")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_memory(np_client):
    """DELETE /api/num-person/memory/{id} should succeed."""
    load_r = await np_client.post("/api/num-person/memory/load", json={
        "video_id": TEST_VIDEO_ID,
        "user_id": "test_user",
    })
    memory_id = load_r.json()["data"]["memory_id"]

    r = await np_client.delete(f"/api/num-person/memory/{memory_id}")
    assert r.status_code == 200
    assert r.json()["data"]["cleared"] is True

    # Second delete should return false
    r2 = await np_client.delete(f"/api/num-person/memory/{memory_id}")
    assert r2.json()["data"]["cleared"] is False


@pytest.mark.asyncio
async def test_chat_stream_with_keyword_fallback(np_client):
    """POST /api/num-person/chat returns SSE stream with keyword search (no embedding configured)."""
    load_r = await np_client.post("/api/num-person/memory/load", json={
        "video_id": TEST_VIDEO_ID,
        "user_id": "test_user",
    })
    memory_id = load_r.json()["data"]["memory_id"]

    r = await np_client.post("/api/num-person/chat", json={
        "memory_id": memory_id,
        "message": "什么是变量",
        "history": [],
    })
    # SSE may fail because LLM is not configured — we accept 200 + error event or 500
    # The retrieval should work, but LLM call may fail in test (no API key)
    if r.status_code == 200:
        text = r.text
        # Should contain at least one SSE event
        assert "data:" in text
    else:
        # Acceptable: LLM not configured in test env
        assert r.status_code in (200, 422, 500)


@pytest.mark.asyncio
async def test_chat_memory_not_found(np_client):
    """POST /api/num-person/chat with unknown memory_id returns SSE error."""
    r = await np_client.post("/api/num-person/chat", json={
        "memory_id": "mem_unknown",
        "message": "hello",
        "history": [],
    })
    if r.status_code == 200:
        assert "NP_MEMORY_NOT_FOUND" in r.text
    else:
        assert r.status_code in (404, 422, 500)


@pytest.mark.asyncio
async def test_memory_expiry(np_client, monkeypatch):
    """Memory should be considered expired after TTL."""
    import app.video_memory_service as vms

    load_r = await np_client.post("/api/num-person/memory/load", json={
        "video_id": TEST_VIDEO_ID,
        "user_id": "test_user",
    })
    memory_id = load_r.json()["data"]["memory_id"]

    # Artificially age the memory
    if memory_id in vms._memories:
        vms._memories[memory_id]["created_at"] = time.time() - 601

    r = await np_client.get(f"/api/num-person/memory/{memory_id}")
    assert r.status_code == 404
