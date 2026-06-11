import pytest
from fastapi import HTTPException
import io


@pytest.mark.asyncio
async def test_quiz_questions_do_not_expose_answers_and_invalid_submit_is_rejected(client):
    quiz = await client.get("/api/quiz?count=3")
    assert quiz.status_code == 200
    questions = quiz.json()["data"]
    assert len(questions) == 3
    assert all("correct_answer" not in q for q in questions)
    assert all("explanation" not in q for q in questions)

    invalid = await client.post("/api/quiz/submit", json={"quiz_id": "missing-question", "answer": "list"})
    assert invalid.status_code == 404


@pytest.mark.asyncio
async def test_task_status_rejects_missing_task(client):
    missing = await client.put("/api/tasks/not-a-real-task/complete", json={"status": "completed"})
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_resource_proxy_rejects_private_network_urls():
    from app.routes.resources import _fetch_url_binary, _fetch_url_text

    with pytest.raises(HTTPException) as text_error:
        await _fetch_url_text("http://127.0.0.1:8000/health")
    assert text_error.value.status_code == 400

    with pytest.raises(HTTPException) as binary_error:
        await _fetch_url_binary("http://10.0.0.5/file.pdf")
    assert binary_error.value.status_code == 400


@pytest.mark.asyncio
async def test_teacher_broadcast_validates_required_fields_and_invalid_targets(client):
    empty = await client.post(
        "/api/teacher/broadcasts",
        json={"title": "", "content": "", "target_type": "all", "student_ids": []},
    )
    assert empty.status_code == 400
    assert "title" in empty.json()["detail"]

    missing_students = await client.post(
        "/api/teacher/broadcasts",
        json={"title": "验收通知", "content": "请完成函数复盘", "target_type": "specific", "student_ids": []},
    )
    assert missing_students.status_code == 400
    assert "student_ids" in missing_students.json()["detail"]

    invalid_student = await client.post(
        "/api/teacher/broadcasts",
        json={"title": "验收通知", "content": "请完成函数复盘", "target_type": "specific", "student_ids": ["missing-student"]},
    )
    assert invalid_student.status_code == 400
    assert "invalid student_ids" in invalid_student.json()["detail"]

    ok_resp = await client.post(
        "/api/teacher/broadcasts",
        json={"title": "验收通知", "content": "请完成函数复盘", "target_type": "all", "student_ids": []},
    )
    assert ok_resp.status_code == 200
    assert ok_resp.json()["success"] is True
    assert ok_resp.json()["data"]["title"] == "验收通知"


@pytest.mark.asyncio
async def test_forum_rejects_invalid_moderation_and_attachment_inputs(client):
    post = await client.post(
        "/api/forum/posts",
        json={"title": "附件边界测试", "content": "验证非法附件和审核状态", "tags": ["验收"]},
    )
    assert post.status_code == 200
    post_id = int(post.json()["data"]["id"])

    invalid_status = await client.patch(
        f"/api/forum/admin/posts/{post_id}/status",
        json={"status": "unknown", "reason": "bad status"},
    )
    assert invalid_status.status_code == 400

    unsupported_file = await client.post(
        f"/api/forum/posts/{post_id}/attachments",
        files=[("files", ("script.exe", io.BytesIO(b"bad"), "application/octet-stream"))],
    )
    assert unsupported_file.status_code == 400
    assert "unsupported file type" in unsupported_file.json()["detail"]
