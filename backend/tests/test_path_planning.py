import pytest


def test_pick_resources_for_node_uses_generate_library_route(monkeypatch):
    from app.routes import path_planning

    def fake_read_json(user_id, filename, default):
        assert filename == "resources_index.json"
        return [
            {
                "id": "res-123",
                "title": "函数返回值讲义",
                "type": "document",
                "status": "completed",
                "content": "讲解函数返回值的基础概念",
            }
        ]

    monkeypatch.setattr(path_planning, "read_json", fake_read_json)

    resources = path_planning._pick_resources_for_node("函数返回值", count=1)

    assert len(resources) == 1
    assert resources[0]["link"] == "/generate?view=library&id=res-123"


@pytest.mark.asyncio
async def test_path_node_suggestions_endpoint_returns_generate_library_links(client, monkeypatch):
    from app.routes import path_planning

    async def fake_generate_ai_node_suggestions(**kwargs):
        return (
            [{"id": 1, "text": "先看讲义", "desc": "从基础概念开始"}],
            [{"id": 1, "title": "函数返回值讲义", "tag": "文档", "link": "/resources/res-123"}],
        )

    monkeypatch.setattr(path_planning, "_generate_ai_node_suggestions", fake_generate_ai_node_suggestions)

    response = await client.post(
        "/api/path-planning/node-suggestions",
        json={
            "node_title": "函数返回值",
            "node_goal": "函数返回值",
            "node_status": "current",
            "phase_title": "补弱阶段",
            "target": "修复函数基础",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["resources"][0]["link"] == "/generate?view=library&id=res-123"
