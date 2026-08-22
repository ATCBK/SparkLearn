import pytest

from app.config import settings
from app.routes import video as video_route


@pytest.mark.asyncio
async def test_video_job_without_frontend_script_still_runs_backend_scripting(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_dev_bypass", True)
    captured_jobs: list[dict] = []

    def fake_build_video_artifacts(resource_id: str, job: dict):
        captured_jobs.append(job)
        return {
            "resource_id": resource_id,
            "provider": "html_ppt",
            "tts_provider": "test",
            "title": "函数返回值讲解",
            "duration_ms": 9000,
            "resolution": "1920x1080",
            "fps": 30,
            "files": {},
            "slides": 1,
            "audio_status": "completed",
            "audio_message": "ok",
            "frame_status": "skipped",
            "frame_message": "skip",
            "has_mp4": False,
            "mux_status": "skipped",
            "mux_message": "skip",
            "created_at": "2026-08-22T00:00:00Z",
            "content_source": "ai",
            "style_id": "apple-minimal",
            "style_name": "苹果极简风",
        }

    monkeypatch.setattr(video_route, "build_video_artifacts", fake_build_video_artifacts)

    created = await client.post(
        "/api/video/jobs",
        json={
            "prompt": "用视频讲解 Python 函数返回值",
            "title": "函数返回值讲解",
            "duration_sec": 45,
            "target_level": "beginner",
            "style_id": "apple-minimal",
        },
    )

    assert created.status_code == 200
    job_id = created.json()["data"]["job_id"]

    events = await client.get(f"/api/video/jobs/{job_id}/events")

    assert events.status_code == 200
    assert '"type": "done"' in events.text
    assert captured_jobs
    assert captured_jobs[0]["prompt"] == "用视频讲解 Python 函数返回值"
    assert captured_jobs[0]["script_outline"] == []
