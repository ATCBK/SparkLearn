import pytest

from app.auth import create_access_token
from app.db import execute, now_iso


@pytest.mark.asyncio
async def test_teacher_class_join_members_and_class_broadcast(client):
    auth_headers = {"Authorization": f"Bearer {create_access_token('single_user')}"}
    created = await client.post(
        "/api/teacher/classes",
        json={
            "name": "Python 实战 1 班",
            "subject_id": 1,
            "subject_name": "Python",
            "grade": "大二",
            "description": "真实班级关系测试",
        },
    )
    assert created.status_code == 200
    created_body = created.json()
    assert created_body["success"] is True
    class_item = created_body["data"]
    class_id = int(class_item["id"])
    invite_code = class_item["invite_code"]
    assert invite_code

    joined = await client.post("/api/classes/join", json={"invite_code": invite_code.lower()}, headers=auth_headers)
    assert joined.status_code == 200
    assert joined.json()["data"]["id"] == class_id

    mine = await client.get("/api/classes/my", headers=auth_headers)
    assert mine.status_code == 200
    assert any(item["id"] == class_id for item in mine.json()["data"])

    members = await client.get(f"/api/teacher/classes/{class_id}/members")
    assert members.status_code == 200
    member_items = members.json()["data"]
    assert len(member_items) == 1
    assert member_items[0]["id"] == "single_user"
    assert "risk_level" in member_items[0]

    sent = await client.post(
        "/api/teacher/broadcasts",
        json={
            "title": "本周项目任务",
            "content": "请完成班级项目的第一阶段提交。",
            "target_type": "class",
            "class_ids": [class_id],
            "student_ids": [],
            "material_file_ids": [],
        },
    )
    assert sent.status_code == 200
    sent_body = sent.json()
    assert sent_body["success"] is True
    assert sent_body["data"]["target_type"] == "class"
    assert sent_body["data"]["target_class_ids"] == [class_id]
    broadcast_id = int(sent_body["data"]["id"])

    broadcasts = await client.get("/api/classes/broadcasts", headers=auth_headers)
    assert broadcasts.status_code == 200
    student_items = broadcasts.json()["data"]
    assert any(item["id"] == broadcast_id and item["read_at"] is None for item in student_items)

    marked = await client.post(f"/api/classes/broadcasts/{broadcast_id}/read", headers=auth_headers)
    assert marked.status_code == 200
    assert marked.json()["success"] is True

    broadcasts_after = await client.get("/api/classes/broadcasts", headers=auth_headers)
    target = [item for item in broadcasts_after.json()["data"] if item["id"] == broadcast_id][0]
    assert target["read_at"]


@pytest.mark.asyncio
async def test_teacher_class_import_members_from_file(client):
    ts = now_iso()
    execute(
        """
        INSERT INTO students(user_id, name, email, phone, major, grade, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("file_user", "文件导入学生", "file_user@sparklearn.ai", "18800000000", "Python", "大一", ts, ts),
    )

    created = await client.post(
        "/api/teacher/classes",
        json={"name": "文件导入测试班", "subject_name": "Python", "grade": "大一"},
    )
    assert created.status_code == 200
    class_id = int(created.json()["data"]["id"])

    imported = await client.post(
        f"/api/teacher/classes/{class_id}/members/import-file",
        files=[
            ("files", ("students.txt", b"file_user\n18800000000\nfile_user@sparklearn.ai", "text/plain")),
            ("files", ("students.csv", "user_id,phone\nfile_user,18800000000\n".encode("utf-8"), "text/csv")),
        ],
    )
    assert imported.status_code == 200
    body = imported.json()
    assert body["success"] is True
    assert body["data"]["file_count"] == 2
    assert body["data"]["parsed_count"] >= 3
    assert body["data"]["added_count"] == 1

    members = await client.get(f"/api/teacher/classes/{class_id}/members")
    assert any(item["id"] == "file_user" for item in members.json()["data"])
