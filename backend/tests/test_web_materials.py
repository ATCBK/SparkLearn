import pytest

from app.auth import create_access_token
from app.db import execute, now_iso
from app.routes import tutor_eval


def _authenticated_user(user_id: str, name: str = "测试用户") -> dict[str, str]:
    ts = now_iso()
    execute(
        "INSERT INTO students(user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (user_id, name, ts, ts),
    )
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


@pytest.mark.asyncio
async def test_import_web_material_requires_explicit_authentication(client):
    resp = await client.post(
        "/api/tutor/files/web-capture",
        json={"title": "未登录抓取", "url": "https://example.com", "text": ""},
    )

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_import_web_material_saves_analysis_card_and_lecture(client, monkeypatch):
    headers = _authenticated_user("web-capture-user-a", "网页采集用户")

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
        headers=headers,
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

    detail_resp = await client.get(f"/api/tutor/files/{data['id']}", headers=headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()["data"]
    assert detail["content"].startswith("闭包可以保存外层函数变量")
    assert detail["analysis"]["learning_method"] == "先读概念，再手写两个闭包示例。"

    files_resp = await client.get("/api/tutor/files", headers=headers)
    assert files_resp.status_code == 200
    assert all(item["id"] != data["id"] for item in files_resp.json()["data"])

    resources_resp = await client.get("/api/resources", headers=headers)
    assert resources_resp.status_code == 200
    resources = resources_resp.json()["data"]
    material = next((item for item in resources if item["id"] == f"webmat-{data['id']}"), None)
    assert material is not None
    assert material["type"] == "web_material"
    assert material["status"] == "completed"
    assert material["title"] == "Python 闭包讲解"
    assert material["source_url"] == "https://example.com/python-closure"
    assert material["analysis"]["summary"] == "这是一篇介绍 Python 闭包的网页资料。"
    assert material["content"] == ""

    resource_detail_resp = await client.get(f"/api/resources/webmat-{data['id']}", headers=headers)
    assert resource_detail_resp.status_code == 200
    resource_detail = resource_detail_resp.json()["data"]
    assert resource_detail["content"].startswith("闭包可以保存外层函数变量")
    assert resource_detail["analysis"]["lecture_script"] == "我们可以把闭包理解成带着记忆的函数。"

    delete_resp = await client.delete(f"/api/resources/webmat-{data['id']}", headers=headers)
    assert delete_resp.status_code == 200
    assert delete_resp.json()["data"]["deleted"] is True

    missing_resp = await client.get(f"/api/tutor/files/{data['id']}", headers=headers)
    assert missing_resp.status_code == 404


@pytest.mark.asyncio
async def test_import_web_material_rejects_empty_text(client):
    headers = _authenticated_user("web-capture-empty-user")
    resp = await client.post(
        "/api/tutor/files/web-capture",
        headers=headers,
        json={"title": "空页面", "url": "https://example.com/empty", "text": "   "},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False
    assert "网页正文为空" in body["error"]


@pytest.mark.asyncio
async def test_import_web_material_is_visible_only_to_authenticated_owner(client, monkeypatch):
    owner_headers = _authenticated_user("web-capture-owner", "资料所有者")
    other_headers = _authenticated_user("web-capture-other", "其他用户")

    async def fake_analyze(_title: str, _url: str, _text: str):
        return {
            "summary": "用户隔离测试资料。",
            "key_points": ["只属于创建者"],
            "audience": "测试用户",
            "learning_method": "阅读",
            "lecture_script": "这是用户隔离测试资料。",
        }

    monkeypatch.setattr(tutor_eval, "_analyze_web_material", fake_analyze)
    created_resp = await client.post(
        "/api/tutor/files/web-capture",
        headers=owner_headers,
        json={
            "title": "用户 A 的网页资料",
            "url": "https://example.com/user-a-material",
            "text": "这是一段只应出现在用户 A 资源中心里的网页资料正文。",
        },
    )
    assert created_resp.status_code == 200
    resource_id = f"webmat-{created_resp.json()['data']['id']}"

    owner_resources = (await client.get("/api/resources", headers=owner_headers)).json()["data"]
    other_resources = (await client.get("/api/resources", headers=other_headers)).json()["data"]

    assert any(item["id"] == resource_id for item in owner_resources)
    assert all(item["id"] != resource_id for item in other_resources)


@pytest.mark.asyncio
async def test_legacy_ready_web_material_is_exposed_as_completed_resource(client):
    headers = _authenticated_user("web-capture-legacy-user", "历史资料用户")
    ts = now_iso()
    execute(
        """
        INSERT INTO tutor_files(
          user_id, filename, stored_path, mime_type, size_bytes,
          source_type, source_url, status, analysis_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "web-capture-legacy-user",
            "历史网页资料",
            "",
            "text/plain; charset=utf-8",
            24,
            "web_capture",
            "https://example.com/legacy-material",
            "ready",
            "{}",
            ts,
            ts,
        ),
    )

    resources = (await client.get("/api/resources", headers=headers)).json()["data"]
    material = next(item for item in resources if item["title"] == "历史网页资料")

    assert material["status"] == "completed"
