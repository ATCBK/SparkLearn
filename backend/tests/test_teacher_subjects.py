import pytest


@pytest.mark.asyncio
async def test_teacher_subjects_support_default_create_and_import(client):
    initial = await client.get("/api/teacher/subjects")
    assert initial.status_code == 200
    initial_body = initial.json()
    assert initial_body["success"] is True
    assert any(item["name"] == "Python" for item in initial_body["data"])

    created = await client.post(
        "/api/teacher/subjects",
        json={
            "name": "Rust",
            "code": "rust",
            "description": "系统编程、内存安全与高性能服务开发",
        },
    )
    assert created.status_code == 200
    created_body = created.json()
    assert created_body["success"] is True
    assert created_body["data"]["name"] == "Rust"
    assert created_body["data"]["enabled"] is True

    imported = await client.post(
        "/api/teacher/subjects/import",
        json={
            "items": [
                {"name": "数据库系统", "code": "database-systems", "description": "关系模型、SQL 与事务"},
                {"name": "计算机网络", "code": "computer-networking", "description": "网络协议、路由与应用层"},
                {"name": "Rust", "code": "rust", "description": "重复项应被跳过"},
            ]
        },
    )
    assert imported.status_code == 200
    imported_body = imported.json()
    assert imported_body["success"] is True
    assert imported_body["data"]["created_count"] == 2
    assert imported_body["data"]["skipped_count"] == 1

    final = await client.get("/api/teacher/subjects")
    names = [item["name"] for item in final.json()["data"]]
    assert "Rust" in names
    assert "数据库系统" in names
    assert "计算机网络" in names


@pytest.mark.asyncio
async def test_teacher_subjects_update_delete_and_enabled_sync(client):
    created = await client.post(
        "/api/teacher/subjects",
        json={"name": "操作系统", "code": "os", "description": "进程、内存与文件系统"},
    )
    assert created.status_code == 200
    subject_id = int(created.json()["data"]["id"])

    updated = await client.put(
        f"/api/teacher/subjects/{subject_id}",
        json={"name": "现代操作系统", "code": "modern-os", "description": "面向高等教育的操作系统课程", "enabled": False},
    )
    assert updated.status_code == 200
    updated_body = updated.json()
    assert updated_body["success"] is True
    assert updated_body["data"]["name"] == "现代操作系统"
    assert updated_body["data"]["enabled"] is False

    enabled_only = await client.get("/api/teacher/subjects?enabled_only=true")
    enabled_names = [item["name"] for item in enabled_only.json()["data"]]
    assert "现代操作系统" not in enabled_names

    reenabled = await client.put(
        f"/api/teacher/subjects/{subject_id}",
        json={"name": "现代操作系统", "code": "modern-os", "description": "面向高等教育的操作系统课程", "enabled": True},
    )
    assert reenabled.status_code == 200
    enabled_only_after = await client.get("/api/teacher/subjects?enabled_only=true")
    assert "现代操作系统" in [item["name"] for item in enabled_only_after.json()["data"]]

    deleted = await client.delete(f"/api/teacher/subjects/{subject_id}")
    assert deleted.status_code == 200
    assert deleted.json()["success"] is True

    final = await client.get("/api/teacher/subjects")
    final_names = [item["name"] for item in final.json()["data"]]
    assert "现代操作系统" not in final_names
