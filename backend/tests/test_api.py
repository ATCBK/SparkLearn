import pytest


@pytest.mark.asyncio
async def test_profile_onboarding_and_get(client):
    payload = {
        "goal": ["期末提分"],
        "level": ["有一些基础"],
        "weak": ["函数"],
        "preference": ["实践型"],
        "time": ["30-60分钟"],
    }
    r = await client.post("/api/profile/onboarding", json=payload)
    assert r.status_code == 200
    assert r.json()["success"] is True

    p = await client.get("/api/profile")
    body = p.json()
    assert body["success"] is True
    assert "goal" in body["data"]


@pytest.mark.asyncio
async def test_tutor_stream_and_history(client):
    r = await client.post("/api/tutor/chat", json={"message": "什么是闭包", "mode": "knowledge_qa"})
    assert r.status_code == 200
    text = r.text
    assert '"type": "text"' in text
    assert '"type": "done"' in text

    h = await client.get("/api/tutor/history")
    assert h.status_code == 200
    assert h.json()["success"] is True
    assert len(h.json()["data"]) >= 2


def _extract_conversation_id_from_stream(text: str) -> int:
    marker = '"conversation_id": '
    return int(text.split(marker, 1)[1].split(",", 1)[0])


@pytest.mark.asyncio
async def test_tutor_chat_without_conversation_id_creates_new_conversation_each_time(client):
    first = await client.post("/api/tutor/chat", json={"message": "第一问", "mode": "knowledge_qa"})
    second = await client.post("/api/tutor/chat", json={"message": "第二问", "mode": "knowledge_qa"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert '"type": "done"' in first.text
    assert '"type": "done"' in second.text

    first_conv_id = _extract_conversation_id_from_stream(first.text)
    second_conv_id = _extract_conversation_id_from_stream(second.text)
    assert first_conv_id != second_conv_id


@pytest.mark.asyncio
async def test_tutor_chat_stores_raw_user_message_verbatim(client):
    created = await client.post("/api/tutor/conversations", json={"title": "原文校验"})
    assert created.status_code == 200
    conv_id = int(created.json()["data"]["id"])
    raw_message = "帮我查一下信阳明天的天气"

    resp = await client.post(
        "/api/tutor/chat",
        json={
            "message": raw_message,
            "conversation_id": conv_id,
            "mode": "knowledge_qa",
        },
    )

    assert resp.status_code == 200

    history = await client.get(f"/api/tutor/history?conversation_id={conv_id}&limit=20")
    assert history.status_code == 200
    user_messages = [m for m in history.json()["data"] if m["role"] == "user"]
    assert user_messages[-1]["content"] == raw_message
    assert "用户已生成资源库上下文" not in user_messages[-1]["content"]


@pytest.mark.asyncio
async def test_tutor_chat_does_not_reuse_previous_file_ids_when_request_omits_them(client):
    created = await client.post("/api/tutor/conversations", json={"title": "文件隔离"})
    assert created.status_code == 200
    conv_id = int(created.json()["data"]["id"])

    upload = await client.post(
        "/api/tutor/files",
        files=[("files", ("sample.txt", b"hello workspace", "text/plain"))],
    )
    assert upload.status_code == 200
    file_id = int(upload.json()["data"][0]["id"])

    first = await client.post(
        "/api/tutor/chat",
        json={
            "message": "第一问",
            "conversation_id": conv_id,
            "file_ids": [file_id],
            "mode": "knowledge_qa",
        },
    )
    second = await client.post(
        "/api/tutor/chat",
        json={
            "message": "第二问",
            "conversation_id": conv_id,
            "mode": "knowledge_qa",
        },
    )

    assert first.status_code == 200
    assert second.status_code == 200

    history = await client.get(f"/api/tutor/history?conversation_id={conv_id}&limit=20")
    assert history.status_code == 200
    data = history.json()["data"]
    user_messages = [m for m in data if m["role"] == "user"]
    assert "sample.txt" in user_messages[0]["file_names"]
    assert user_messages[1]["file_names"] == []


@pytest.mark.asyncio
async def test_quiz_submit(client):
    q = await client.get("/api/quiz")
    assert q.status_code == 200
    first = q.json()["data"][0]

    s = await client.post("/api/quiz/submit", json={"quiz_id": first["id"], "answer": "list"})
    assert s.status_code == 200
    assert s.json()["success"] is True
    assert "correct" in s.json()["data"]


@pytest.mark.asyncio
async def test_generate_stream(client):
    r = await client.post("/api/resources/generate", json={"type": "document", "prompt": "Python 变量"})
    assert r.status_code == 200
    assert '"type": "progress"' in r.text
    assert '"type": "done"' in r.text


@pytest.mark.asyncio
async def test_tutor_workspace_closed_loop(client):
    roles = await client.get("/api/tutor/roles")
    assert roles.status_code == 200
    assert roles.json()["success"] is True

    created_role = await client.post(
        "/api/tutor/roles",
        json={"name": "测试角色", "persona": "你是测试导师"},
    )
    assert created_role.status_code == 200
    role_id = int(created_role.json()["data"]["id"])

    created_conv = await client.post(
        "/api/tutor/conversations",
        json={"title": "闭环测试会话", "role_id": role_id},
    )
    assert created_conv.status_code == 200
    conv_id = int(created_conv.json()["data"]["id"])

    upload = await client.post(
        "/api/tutor/files",
        files=[("files", ("sample.txt", b"hello workspace", "text/plain"))],
    )
    assert upload.status_code == 200
    file_id = int(upload.json()["data"][0]["id"])

    stream = await client.post(
        "/api/tutor/chat",
        json={
            "message": "请解释闭包",
            "conversation_id": conv_id,
            "role_id": role_id,
            "file_ids": [file_id],
            "mode": "knowledge_qa",
        },
    )
    assert stream.status_code == 200
    assert '"type": "text"' in stream.text
    assert '"type": "done"' in stream.text

    history = await client.get(f"/api/tutor/history?conversation_id={conv_id}&limit=50")
    assert history.status_code == 200
    assert history.json()["success"] is True
    msgs = history.json()["data"]
    assert len(msgs) >= 2
    user_messages = [m for m in msgs if m["role"] == "user"]
    assert user_messages
    assert "sample.txt" in user_messages[-1]["file_names"]

    convs_before = await client.get("/api/tutor/conversations")
    assert convs_before.status_code == 200
    before = next((c for c in convs_before.json()["data"] if int(c["id"]) == conv_id), None)
    assert before is not None
    before_count = int(before["message_count"])
    assert before_count >= 2

    delete_msg = await client.delete(f"/api/tutor/messages/{user_messages[-1]['id']}")
    assert delete_msg.status_code == 200
    assert delete_msg.json()["success"] is True

    convs_after = await client.get("/api/tutor/conversations")
    after = next((c for c in convs_after.json()["data"] if int(c["id"]) == conv_id), None)
    assert after is not None
    assert int(after["message_count"]) == before_count - 1


@pytest.mark.asyncio
async def test_agent_task_uses_learning_companion_backend(client, monkeypatch):
    from app.routes import agent as agent_route

    async def fake_execute_fallback_task(task_id: str, task_type: str, input_text: str, persona_prompt: str):
        assert task_id
        assert task_type == "search"
        assert input_text == "Python 闭包"
        assert "encouraging" in persona_prompt.lower()
        return {
            "items": [
                {
                    "title": "闭包入门",
                    "summary": "解释闭包概念与使用场景",
                    "url": "https://example.com/closure",
                    "source": "example.com",
                }
            ]
        }

    monkeypatch.setattr(agent_route, "_execute_fallback_task", fake_execute_fallback_task)

    pet_resp = await client.post(
        "/api/agent/pet",
        json={"name": "小星", "avatar": "fox", "personality": "encouraging"},
    )
    assert pet_resp.status_code == 200
    if pet_resp.json()["success"] is False:
        current_pet = await client.get("/api/agent/pet")
        assert current_pet.status_code == 200
        assert current_pet.json()["success"] is True
    else:
        assert pet_resp.json()["success"] is True

    create = await client.post(
        "/api/agent/task",
        json={"task_type": "search", "input_text": "Python 闭包"},
    )
    assert create.status_code == 200
    task_id = create.json()["data"]["task_id"]

    task_resp = None
    for _ in range(10):
        task_resp = await client.get(f"/api/agent/task/{task_id}")
        assert task_resp.status_code == 200
        if task_resp.json()["data"]["status"] == "completed":
            break

    assert task_resp is not None
    data = task_resp.json()["data"]
    assert data["status"] == "completed"
    assert data["result"]["items"][0]["title"] == "闭包入门"
    assert any(step["action"] == "start" for step in data["steps"])
