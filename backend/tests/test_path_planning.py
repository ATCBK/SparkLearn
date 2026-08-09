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


@pytest.mark.asyncio
<<<<<<< HEAD
async def test_save_path_planning_endpoint_creates_history_entry(client):
=======
async def test_save_path_planning_endpoint_updates_history(client):
    phases = [
        {
            "id": 1,
            "title": "基础阶段",
            "description": "补齐基础",
            "nodes": [{"id": "node-1", "title": "函数返回值", "source": "user"}],
        }
    ]

>>>>>>> 04da7d704e5bd015542a61107308a98fae4ea4b1
    response = await client.post(
        "/api/path-planning/save",
        json={
            "path_id": "path-test",
<<<<<<< HEAD
            "target": "学习 FastAPI",
            "phases": [
                {
                    "id": 1,
                    "title": "基础阶段",
                    "description": "先打基础",
                    "nodes": [
                        {"id": "node-1", "title": "理解路由", "source": "user"},
                    ],
                },
            ],
=======
            "target": "修复函数基础",
            "phases": phases,
>>>>>>> 04da7d704e5bd015542a61107308a98fae4ea4b1
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
<<<<<<< HEAD
    assert body["data"] == {"saved": True, "path_id": "path-test"}

    history_response = await client.get("/api/path-planning/history")
    history = history_response.json()["data"]
    assert len(history) == 1
    assert history[0]["path_id"] == "path-test"
    assert history[0]["phases"][0]["nodes"][0]["title"] == "理解路由"


@pytest.mark.asyncio
async def test_save_path_planning_endpoint_updates_existing_history_entry(client):
    payload = {
        "path_id": "path-update",
        "target": "学习路径编辑",
        "phases": [
            {
                "id": 1,
                "title": "基础阶段",
                "nodes": [{"id": "node-1", "title": "旧节点", "source": "ai"}],
            },
        ],
    }
    await client.post("/api/path-planning/save", json=payload)

    payload["phases"][0]["nodes"][0]["title"] = "新节点"
    response = await client.post("/api/path-planning/save", json=payload)

    assert response.status_code == 200
    history_response = await client.get("/api/path-planning/history")
    history = history_response.json()["data"]
    assert len(history) == 1
    assert history[0]["phases"][0]["nodes"][0]["title"] == "新节点"
=======
    assert body["data"] == {"saved": True, "pathId": "path-test"}

    history_response = await client.get("/api/path-planning/history")
    assert history_response.status_code == 200
    history_body = history_response.json()
    assert history_body["data"][0]["path_id"] == "path-test"
    assert history_body["data"][0]["target"] == "修复函数基础"
    assert history_body["data"][0]["phases"] == phases
>>>>>>> 04da7d704e5bd015542a61107308a98fae4ea4b1
