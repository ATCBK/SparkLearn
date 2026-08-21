import pytest

from app.auth import create_access_token
from app.config import settings
from app.db import execute, now_iso
from app.storage import read_json, write_json


def _authenticated_user(user_id: str) -> dict[str, str]:
    timestamp = now_iso()
    execute(
        "INSERT INTO students(user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (user_id, "资源中心视频删除测试用户", timestamp, timestamp),
    )
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


@pytest.mark.asyncio
async def test_resource_center_delete_removes_video_resource_and_artifacts(client):
    user_id = "resource-center-video-delete-user"
    headers = _authenticated_user(user_id)
    resource_id = "video_resource_center_delete"
    write_json(
        user_id,
        "video_resources.json",
        [{"id": resource_id, "title": "待删除教学视频", "status": "completed"}],
    )
    write_json(
        user_id,
        "video_jobs.json",
        [{"job_id": "job_resource_center_delete", "resource_id": resource_id}],
    )
    artifact_dir = settings.data_dir / "artifacts" / "video" / resource_id
    artifact_dir.mkdir(parents=True)
    (artifact_dir / "video.mp4").write_bytes(b"test-video")

    listed_before = (await client.get("/api/resources", headers=headers)).json()["data"]
    assert any(item["id"] == resource_id for item in listed_before)

    response = await client.delete(f"/api/resources/{resource_id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["data"]["deleted"] is True
    listed_after = (await client.get("/api/resources", headers=headers)).json()["data"]
    assert all(item["id"] != resource_id for item in listed_after)
    assert read_json(user_id, "video_resources.json", []) == []
    assert read_json(user_id, "video_jobs.json", []) == []
    assert not artifact_dir.exists()
