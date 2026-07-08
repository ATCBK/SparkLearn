import pytest
from io import BytesIO

from docx import Document


@pytest.mark.asyncio
async def test_subject_knowledge_file_can_be_indexed_and_retrieved(client, monkeypatch):
    from app.routes import knowledge as knowledge_route

    async def fake_embed_para(text: str):
        return [float(len(text) % 7), 1.0, 0.5]

    async def fake_embed_query(text: str):
        return [float(len(text) % 7), 1.0, 0.5]

    monkeypatch.setattr(knowledge_route.xfyun_embedding, "embed_para", fake_embed_para)
    monkeypatch.setattr(knowledge_route.xfyun_embedding, "embed_query", fake_embed_query)

    subjects = await client.get("/api/teacher/subjects?enabled_only=true")
    assert subjects.status_code == 200
    java_subject = next(item for item in subjects.json()["data"] if item["name"] == "Java")
    subject_id = int(java_subject["id"])

    upload = await client.post(
        f"/api/knowledge/files?subject_id={subject_id}",
        files=[("files", ("java.md", "JVM 垃圾回收负责自动回收不再被引用的对象，常见算法包括标记清除和分代收集。".encode("utf-8"), "text/markdown"))],
    )
    assert upload.status_code == 200
    uploaded = upload.json()["data"][0]
    assert uploaded["subject_id"] == subject_id
    assert uploaded["subject_name"] == "Java"

    indexed = await client.put(f"/api/knowledge/files/{uploaded['id']}/index")
    assert indexed.status_code == 200
    assert indexed.json()["success"] is True
    assert indexed.json()["data"]["status"] == "indexed"

    retrieved = await client.get(f"/api/knowledge/retrieve?subject_id={subject_id}&query=JVM 垃圾回收")
    assert retrieved.status_code == 200
    body = retrieved.json()
    assert body["success"] is True
    assert "JVM 垃圾回收" in body["data"]["context"]
    assert body["data"]["sources"][0]["filename"] == "java.md"

    from app.routes import resources as resources_route

    prompt = await resources_route._build_resource_prompt_with_rag(
        "reading",
        "讲解 JVM 垃圾回收",
        [int(uploaded["id"])],
    )
    assert "学科知识库检索上下文" in prompt
    assert "JVM 垃圾回收" in prompt

    await client.put("/api/profile", json={"major": "Java"})
    from app.routes import tutor_eval as tutor_route

    assert int(uploaded["id"]) in tutor_route._resolve_subject_knowledge_file_ids_for_tutor([])


@pytest.mark.asyncio
async def test_docx_knowledge_file_can_be_indexed(client, monkeypatch):
    from app.routes import knowledge as knowledge_route

    async def fake_embed_para(text: str):
        return [1.0, float(len(text) % 5), 0.25]

    async def fake_summarize(text: str):
        assert "函数返回值" in text
        return "函数返回值资料 学习资料 DOCX"

    monkeypatch.setattr(knowledge_route.xfyun_embedding, "embed_para", fake_embed_para)
    monkeypatch.setattr(knowledge_route.spark_lite, "summarize", fake_summarize)

    doc = Document()
    doc.add_heading("函数返回值", level=1)
    doc.add_paragraph("函数返回值用于把计算结果交还给调用方。")
    table = doc.add_table(rows=1, cols=2)
    table.cell(0, 0).text = "关键词"
    table.cell(0, 1).text = "return"
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    upload = await client.post(
        "/api/knowledge/files",
        files=[
            (
                "files",
                (
                    "函数返回值.docx",
                    buffer.getvalue(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ),
            )
        ],
    )
    assert upload.status_code == 200
    uploaded = upload.json()["data"][0]

    indexed = await client.put(f"/api/knowledge/files/{uploaded['id']}/index")
    assert indexed.status_code == 200
    body = indexed.json()
    assert body["success"] is True
    assert body["data"]["status"] == "indexed"
    assert body["data"]["chunk_count"] >= 1

    chunks = await client.get(f"/api/knowledge/chunks?file_id={uploaded['id']}")
    assert chunks.status_code == 200
    chunk_text = "\n".join(item["content"] for item in chunks.json()["data"])
    assert "函数返回值用于把计算结果交还给调用方" in chunk_text
    assert "关键词 | return" in chunk_text
