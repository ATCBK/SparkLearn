import pytest

from app.config import settings
from app.routes import resources as resources_route


@pytest.mark.asyncio
async def test_document_generation_includes_selected_knowledge_context(client, monkeypatch):
    captured: dict[str, str] = {}
    monkeypatch.setattr(settings, "auth_dev_bypass", True)

    async def fake_stream_resource_text(resource_type: str, prompt: str, user_id: str):
        captured["resource_type"] = resource_type
        captured["prompt"] = prompt
        if False:
            yield ("text", {"content": ""})
        yield ("text", {"content": "文档内容"})

    async def fake_load_knowledge_context_async(file_ids, query: str, **kwargs):
        captured["file_ids"] = ",".join(str(file_id) for file_id in file_ids)
        captured["query"] = query
        captured["user_id"] = str(kwargs.get("user_id") or "")
        return "选中资料片段：函数返回值需要明确返回给调用方"

    monkeypatch.setattr(resources_route.coze_adapter, "stream_resource_text", fake_stream_resource_text)
    monkeypatch.setattr(resources_route, "load_knowledge_context_async", fake_load_knowledge_context_async)

    user_prompt = '请基于当前薄弱点"函数返回值"生成一份讲解Python函数的课程文档'
    resp = await client.post("/api/resources/generate", json={"type": "document", "prompt": user_prompt, "knowledge_file_ids": [1]})

    assert resp.status_code == 200
    assert '"type": "done"' in resp.text
    assert captured["resource_type"] == "document"
    assert user_prompt in captured["prompt"]
    assert "选中资料片段：函数返回值需要明确返回给调用方" in captured["prompt"]
    assert captured["file_ids"] == "1"
    assert captured["query"] == user_prompt
    assert captured["user_id"]


@pytest.mark.asyncio
async def test_uploaded_knowledge_file_can_be_used_by_resource_generation(client, monkeypatch):
    from app.routes import knowledge as knowledge_route

    captured: dict[str, str] = {}
    monkeypatch.setattr(settings, "auth_dev_bypass", True)

    async def fake_embed_para(text: str):
        return [1.0, float(len(text) % 5), 0.25]

    async def fake_embed_query(text: str):
        return [1.0, float(len(text) % 5), 0.25]

    async def fake_summarize(text: str):
        assert "闭包会捕获外层函数变量" in text
        return "Python 闭包资料"

    async def fake_stream_resource_text(resource_type: str, prompt: str, user_id: str):
        captured["resource_type"] = resource_type
        captured["prompt"] = prompt
        captured["user_id"] = user_id
        if False:
            yield ("text", {"content": ""})
        yield ("text", {"content": "基于上传资料生成的讲义"})

    monkeypatch.setattr(knowledge_route.xfyun_embedding, "embed_para", fake_embed_para)
    monkeypatch.setattr(knowledge_route.xfyun_embedding, "embed_query", fake_embed_query)
    monkeypatch.setattr(knowledge_route.spark_lite, "summarize", fake_summarize)
    monkeypatch.setattr(resources_route.coze_adapter, "stream_resource_text", fake_stream_resource_text)

    upload = await client.post(
        "/api/knowledge/files",
        files=[
            (
                "files",
                (
                    "closure.md",
                    "Python 闭包会捕获外层函数变量，可以在内部函数继续访问这些变量。".encode("utf-8"),
                    "text/markdown",
                ),
            )
        ],
    )
    assert upload.status_code == 200
    uploaded = upload.json()["data"][0]

    indexed = await client.put(f"/api/knowledge/files/{uploaded['id']}/index")
    assert indexed.status_code == 200
    assert indexed.json()["data"]["status"] == "indexed"

    resp = await client.post(
        "/api/resources/generate",
        json={
            "type": "document",
            "prompt": "请生成一份 Python 闭包讲义",
            "knowledge_file_ids": [uploaded["id"]],
        },
    )

    assert resp.status_code == 200
    assert '"type": "done"' in resp.text
    assert captured["resource_type"] == "document"
    assert "学科知识库检索上下文" in captured["prompt"]
    assert "closure.md#1" in captured["prompt"]
    assert "Python 闭包会捕获外层函数变量" in captured["prompt"]
    assert captured["user_id"] == settings.single_user_id


@pytest.mark.asyncio
async def test_blog_generation_keeps_specialized_prompt_template(client, monkeypatch):
    captured: dict[str, str] = {}
    monkeypatch.setattr(settings, "auth_dev_bypass", True)

    async def fake_stream_chat_events(prompt: str, mode: str, history: list):
        captured["prompt"] = prompt
        if False:
            yield ("text", {"content": ""})
        yield ("text", {"content": "播客稿内容"})

    async def fake_load_knowledge_context_async(file_ids, query: str, **kwargs):
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

    assert resources_route._build_resource_prompt("document", user_prompt, settings.single_user_id) == user_prompt
    blog_prompt = resources_route._build_resource_prompt("blog", user_prompt, settings.single_user_id)
    assert blog_prompt != user_prompt
    assert "播客电台脚本" in blog_prompt
