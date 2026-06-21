import uuid

import pytest
from app.routes import mcp


def _payload(name: str) -> dict:
    return {
        "name": name,
        "description": "test service",
        "transport": "http",
        "endpoint": "https://example.com/mcp",
        "command": "",
        "args_json": [],
        "env_json": {},
        "enabled": False,
        "startup_timeout_ms": 60000,
        "tool_timeout_ms": 30000,
        "long_task_timeout_ms": 120000,
    }


@pytest.mark.asyncio
async def test_update_service_accepts_post_compat(client):
    create_resp = await client.post("/api/mcp/services", json=_payload(f"compat-{uuid.uuid4().hex[:8]}"))
    assert create_resp.status_code == 200
    service_id = create_resp.json()["data"]["id"]

    update_resp = await client.post(
        f"/api/mcp/services/{service_id}",
        json=_payload(f"compat-updated-{uuid.uuid4().hex[:8]}"),
    )

    assert update_resp.status_code == 200
    body = update_resp.json()
    assert body["success"] is True
    assert body["data"]["id"] == service_id
    assert body["data"]["name"].startswith("compat-updated-")


@pytest.mark.asyncio
async def test_call_tool_returns_readable_result_text(client, monkeypatch):
    create_resp = await client.post("/api/mcp/services", json=_payload(f"call-{uuid.uuid4().hex[:8]}"))
    assert create_resp.status_code == 200
    service_id = create_resp.json()["data"]["id"]

    async def fake_mcp_request(_service, method, params):
        assert method == "tools/call"
        assert params == {"name": "weather", "arguments": {"city": "北京"}}
        return {
            "content": [
                {"type": "text", "text": "北京今天晴，26℃。"},
                {"type": "text", "text": "适合户外学习。"},
            ],
            "isError": False,
        }

    monkeypatch.setattr(mcp, "_mcp_request", fake_mcp_request)

    call_resp = await client.post(
        f"/api/mcp/services/{service_id}/call",
        json={"tool_name": "weather", "args": {"city": "北京"}},
    )

    assert call_resp.status_code == 200
    body = call_resp.json()
    assert body["success"] is True
    assert body["data"]["result_text"] == "北京今天晴，26℃。\n适合户外学习。"
    assert body["data"]["result_preview"] == "北京今天晴，26℃。 适合户外学习。"
