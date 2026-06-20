import pytest

from app.routes import resources as resources_route


@pytest.mark.asyncio
async def test_document_generation_passes_user_prompt_verbatim(client, monkeypatch):
    captured: dict[str, str] = {}

    async def fake_stream_resource_text(resource_type: str, prompt: str, user_id: str):
        captured["resource_type"] = resource_type
        captured["prompt"] = prompt
        if False:
            yield ("text", {"content": ""})
        yield ("text", {"content": "文档内容"})

    async def fake_load_knowledge_context_async(file_ids, query: str):
        return "不应该拼进 prompt 的知识内容"

    monkeypatch.setattr(resources_route.coze_adapter, "stream_resource_text", fake_stream_resource_text)
    monkeypatch.setattr(resources_route, "load_knowledge_context_async", fake_load_knowledge_context_async)

    user_prompt = '请基于当前薄弱点"函数返回值"生成一份讲解Python函数的课程文档'
    resp = await client.post("/api/resources/generate", json={"type": "document", "prompt": user_prompt, "knowledge_file_ids": [1]})

    assert resp.status_code == 200
    assert '"type": "done"' in resp.text
    assert captured["resource_type"] == "document"
    assert captured["prompt"] == user_prompt


@pytest.mark.asyncio
async def test_blog_generation_keeps_specialized_prompt_template(client, monkeypatch):
    captured: dict[str, str] = {}

    async def fake_stream_chat_events(prompt: str, mode: str, history: list):
        captured["prompt"] = prompt
        if False:
            yield ("text", {"content": ""})
        yield ("text", {"content": "播客稿内容"})

    async def fake_load_knowledge_context_async(file_ids, query: str):
        return "不应该拼进 prompt 的知识内容"

    monkeypatch.setattr(resources_route.spark_lite, "stream_chat_events", fake_stream_chat_events)
    monkeypatch.setattr(resources_route, "load_knowledge_context_async", fake_load_knowledge_context_async)

    user_prompt = '请用通俗易懂的方式讲解"函数返回值"这个概念'
    resp = await client.post("/api/resources/generate", json={"type": "blog", "prompt": user_prompt, "knowledge_file_ids": [1]})

    assert resp.status_code == 200
    assert '"type": "done"' in resp.text
    assert captured["prompt"] != user_prompt
    assert "播客电台脚本" in captured["prompt"]
    assert user_prompt in captured["prompt"]


def test_build_resource_prompt_returns_raw_user_prompt():
    user_prompt = '帮我做一个Python函数的讲义'

    assert resources_route._build_resource_prompt("document", user_prompt) == user_prompt
    blog_prompt = resources_route._build_resource_prompt("blog", user_prompt)
    assert blog_prompt != user_prompt
    assert "播客电台脚本" in blog_prompt
