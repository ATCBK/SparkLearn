import asyncio
import time

import pytest

from app.routes import tutor_eval


@pytest.mark.asyncio
async def test_import_web_material_saves_analysis_card_and_lecture(client, monkeypatch):
    async def fake_analyze(_title: str, _url: str, text: str):
        assert "闭包可以保存外层函数变量" in text
        return {
            "summary": "这是一篇介绍 Python 闭包的网页资料。",
            "key_points": ["闭包保存外层变量", "nonlocal 可以修改外层变量"],
            "audience": "适合 Python 入门后想理解函数进阶的学习者",
            "learning_method": "先读概念，再手写两个闭包示例。",
            "lecture_script": "我们可以把闭包理解成带着记忆的函数。",
        }

    monkeypatch.setattr(tutor_eval, "_analyze_web_material", fake_analyze)

    resp = await client.post(
        "/api/tutor/files/web-capture",
        json={
            "title": "Python 闭包讲解",
            "url": "https://example.com/python-closure",
            "text": "闭包可以保存外层函数变量。nonlocal 可以修改外层变量。",
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    data = body["data"]
    assert data["filename"] == "Python 闭包讲解"
    assert data["source_type"] == "web_capture"
    assert data["source_url"] == "https://example.com/python-closure"
    assert data["analysis"]["summary"] == "这是一篇介绍 Python 闭包的网页资料。"
    assert data["analysis"]["key_points"] == ["闭包保存外层变量", "nonlocal 可以修改外层变量"]
    assert data["analysis"]["lecture_script"] == "我们可以把闭包理解成带着记忆的函数。"

    detail_resp = await client.get(f"/api/tutor/files/{data['id']}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()["data"]
    assert detail["content"].startswith("闭包可以保存外层函数变量")
    assert detail["analysis"]["learning_method"] == "先读概念，再手写两个闭包示例。"

    files_resp = await client.get("/api/tutor/files")
    assert files_resp.status_code == 200
    assert all(item["id"] != data["id"] for item in files_resp.json()["data"])

    resources_resp = await client.get("/api/resources")
    assert resources_resp.status_code == 200
    resources = resources_resp.json()["data"]
    material = next((item for item in resources if item["id"] == f"webmat-{data['id']}"), None)
    assert material is not None
    assert material["type"] == "web_material"
    assert material["title"] == "Python 闭包讲解"
    assert material["source_url"] == "https://example.com/python-closure"
    assert material["analysis"]["summary"] == "这是一篇介绍 Python 闭包的网页资料。"
    assert material["content"] == ""

    resource_detail_resp = await client.get(f"/api/resources/webmat-{data['id']}")
    assert resource_detail_resp.status_code == 200
    resource_detail = resource_detail_resp.json()["data"]
    assert resource_detail["content"].startswith("闭包可以保存外层函数变量")
    assert resource_detail["analysis"]["lecture_script"] == "我们可以把闭包理解成带着记忆的函数。"

    delete_resp = await client.delete(f"/api/resources/webmat-{data['id']}")
    assert delete_resp.status_code == 200
    assert delete_resp.json()["data"]["deleted"] is True

    missing_resp = await client.get(f"/api/tutor/files/{data['id']}")
    assert missing_resp.status_code == 404


@pytest.mark.asyncio
async def test_import_web_material_rejects_empty_text(client):
    resp = await client.post(
        "/api/tutor/files/web-capture",
        json={"title": "空页面", "url": "https://example.com/empty", "text": "   "},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False
    assert "网页正文为空" in body["error"]


@pytest.mark.asyncio
async def test_import_web_material_falls_back_when_ai_analysis_times_out(client, monkeypatch):
    async def slow_analyze(_title: str, _url: str, _text: str):
        await asyncio.sleep(0.2)
        return {
            "summary": "不应该等待到这里",
            "key_points": ["慢响应"],
            "audience": "",
            "learning_method": "",
            "lecture_script": "",
        }

    monkeypatch.setattr(tutor_eval, "WEB_CAPTURE_ANALYSIS_TIMEOUT_SEC", 0.01, raising=False)
    monkeypatch.setattr(tutor_eval, "_analyze_web_material", slow_analyze)

    started = time.perf_counter()
    resp = await client.post(
        "/api/tutor/files/web-capture",
        json={
            "title": "超时网页资料",
            "url": "https://example.com/slow",
            "text": "这是一段用于测试网页资料采集超时降级的正文。它应该先被保存，而不是一直等待 AI 讲解稿生成完成。",
        },
    )
    elapsed = time.perf_counter() - started

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert elapsed < 0.15
    assert body["data"]["analysis"]["summary"].startswith("超时网页资料 已保存为网页资料")
    assert body["data"]["analysis"]["summary"] != "不应该等待到这里"
