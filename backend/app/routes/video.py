import asyncio
import json
import re
import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field

from ..config import settings
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json
from ..video_generator import artifact_dir, build_video_artifacts, make_polished_script, now_iso
from .common import sse_wrap


router = APIRouter(prefix="/api/video", tags=["video"])


class VideoPolishReq(BaseModel):
    prompt: str = Field(min_length=1)
    course_id: str = "python_basic"
    user_id: str = "single_user"
    target_level: str = "beginner"
    duration_sec: int = Field(default=90, ge=15, le=180)
    style: str = "清晰、生动、适合课堂讲解"
    voice: str = ""


class VideoJobReq(BaseModel):
    polish_id: str | None = None
    prompt: str = Field(min_length=1)
    title: str | None = None
    script_outline: list[dict[str, Any]] = Field(default_factory=list)
    content_source: str = ""
    ai_provider: str = ""
    ai_model: str = ""
    video_provider: str = "html_ppt"
    voice: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)


def _jobs() -> list[dict[str, Any]]:
    return read_json(settings.single_user_id, "video_jobs.json", [])


def _save_jobs(items: list[dict[str, Any]]) -> None:
    write_json(settings.single_user_id, "video_jobs.json", items)


def _resources() -> list[dict[str, Any]]:
    return read_json(settings.single_user_id, "video_resources.json", [])


def _save_resources(items: list[dict[str, Any]]) -> None:
    write_json(settings.single_user_id, "video_resources.json", items)


def _api_url(path: str) -> str:
    return path


def _resource_payload(resource_id: str, manifest: dict[str, Any], status: str = "completed") -> dict[str, Any]:
    duration_ms = int(manifest.get("duration_ms") or 0)
    return {
        "id": resource_id,
        "title": str(manifest.get("title") or "AI 讲解视频"),
        "status": status,
        "duration": max(1, round(duration_ms / 1000)),
        "duration_ms": duration_ms,
        "created_at": str(manifest.get("created_at") or now_iso()),
        "video_url": _api_url(f"/api/video/resources/{resource_id}/download/mp4"),
        "audio_url": _api_url(f"/api/video/resources/{resource_id}/download/audio"),
        "subtitle_url": _api_url(f"/api/video/resources/{resource_id}/download/srt"),
        "timeline_url": _api_url(f"/api/video/resources/{resource_id}/timeline"),
        "scene_url": _api_url(f"/api/video/resources/{resource_id}/scene"),
        "share_url": _api_url(f"/share/video/{resource_id}"),
        "resolution": str(manifest.get("resolution") or "1920x1080"),
        "fps": int(manifest.get("fps") or 30),
        "provider": str(manifest.get("provider") or settings.video_default_provider),
        "content_source": str(manifest.get("content_source") or ""),
        "tts_provider": str(manifest.get("tts_provider") or "local_fallback"),
        "has_mp4": bool(manifest.get("has_mp4")),
        "slides": int(manifest.get("slides") or 0),
        "audio_status": str(manifest.get("audio_status") or ""),
        "audio_message": str(manifest.get("audio_message") or ""),
        "frame_status": str(manifest.get("frame_status") or ""),
        "frame_message": str(manifest.get("frame_message") or ""),
        "mux_status": str(manifest.get("mux_status") or ""),
        "mux_message": str(manifest.get("mux_message") or ""),
    }


def _find_resource(resource_id: str) -> dict[str, Any] | None:
    return next((item for item in _resources() if str(item.get("id")) == resource_id), None)


def _video_artifact_path(resource_id: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", resource_id):
        raise HTTPException(status_code=400, detail="invalid resource id")
    root = (settings.data_dir / "artifacts" / "video").resolve()
    path = (root / resource_id).resolve()
    if root != path and root not in path.parents:
        raise HTTPException(status_code=400, detail="invalid resource path")
    return path


@router.post("/polish")
async def polish_video_prompt(req: VideoPolishReq):
    result = make_polished_script(
        prompt=req.prompt,
        duration_sec=req.duration_sec,
        target_level=req.target_level,
        style=req.style,
    )
    if req.voice:
        result["voice"] = req.voice
    append_jsonl(settings.single_user_id, "video_events.jsonl", {"type": "video_polished", "polish_id": result["polish_id"]})
    return ok(result)


@router.post("/jobs")
async def create_video_job(req: VideoJobReq):
    resource_id = f"video_{uuid.uuid4().hex[:8]}"
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    job = {
        "job_id": job_id,
        "resource_id": resource_id,
        "status": "queued",
        "progress": 0,
        "created_at": now_iso(),
        **req.model_dump(),
    }
    jobs = _jobs()
    jobs.append(job)
    _save_jobs(jobs)
    append_jsonl(settings.single_user_id, "video_events.jsonl", {"type": "video_job_created", "job_id": job_id, "resource_id": resource_id})
    return ok({"job_id": job_id, "resource_id": resource_id, "status": "queued", "events_url": f"/api/video/jobs/{job_id}/events"})


@router.get("/jobs/{job_id}/events")
async def video_job_events(job_id: str):
    async def gen():
        jobs = _jobs()
        job = next((item for item in jobs if str(item.get("job_id")) == job_id), None)
        if not job:
            yield ("error", {"code": "VIDEO_JOB_NOT_FOUND", "message": "视频任务不存在", "retryable": False})
            return

        resource_id = str(job["resource_id"])
        existing = _find_resource(resource_id)
        if existing:
            yield ("progress", {"stage": "completed", "progress": 100, "resource_id": resource_id})
            yield ("done", {"resource_id": resource_id, "resource": existing})
            return

        stages = [
            ("scripting", 18, "正在整理分镜与讲稿"),
            ("video_rendering", 42, "正在生成教学场景"),
            ("tts_synthesizing", 68, "正在生成语音播报降级音轨"),
            ("muxing", 88, "正在写入字幕与时间轴"),
        ]
        for stage, progress, message in stages:
            yield ("progress", {"stage": stage, "progress": progress, "message": message, "resource_id": resource_id})
            await asyncio.sleep(0.25)

        try:
            manifest = await asyncio.to_thread(build_video_artifacts, resource_id, job)
            resource = _resource_payload(resource_id, manifest)
            resources = [item for item in _resources() if str(item.get("id")) != resource_id]
            resources.insert(0, resource)
            _save_resources(resources)

            for item in jobs:
                if str(item.get("job_id")) == job_id:
                    item["status"] = "completed"
                    item["progress"] = 100
                    item["completed_at"] = now_iso()
            _save_jobs(jobs)
            append_jsonl(settings.single_user_id, "video_events.jsonl", {"type": "video_job_completed", "job_id": job_id, "resource_id": resource_id})
            yield ("artifact", {"kind": "timeline", "url": resource["timeline_url"], "resource_id": resource_id})
            yield ("progress", {"stage": "completed", "progress": 100, "message": "视频创作产物已生成", "resource_id": resource_id})
            yield ("done", {"resource_id": resource_id, "resource": resource})
        except Exception as ex:
            yield ("error", {"code": "VIDEO_GENERATION_FAILED", "message": str(ex), "retryable": True})

    return StreamingResponse(sse_wrap(gen()), media_type="text/event-stream")


@router.get("/resources")
async def list_video_resources():
    return ok(_resources())


@router.get("/resources/{resource_id}")
async def get_video_resource(resource_id: str):
    item = _find_resource(resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="video resource not found")
    timeline = _read_artifact_json(resource_id, "timeline.json", {})
    return ok({**item, "timeline": timeline.get("segments", [])})


@router.get("/resources/{resource_id}/timeline")
async def get_video_timeline(resource_id: str):
    item = _find_resource(resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="video resource not found")
    return ok(_read_artifact_json(resource_id, "timeline.json", {}))


@router.delete("/resources/{resource_id}")
async def delete_video_resource(resource_id: str):
    resources = _resources()
    next_resources = [item for item in resources if str(item.get("id")) != resource_id]
    deleted = len(next_resources) != len(resources)
    _save_resources(next_resources)

    jobs = _jobs()
    next_jobs = [item for item in jobs if str(item.get("resource_id")) != resource_id]
    _save_jobs(next_jobs)

    artifact_path = _video_artifact_path(resource_id)
    if artifact_path.exists():
        shutil.rmtree(artifact_path)
        deleted = True

    append_jsonl(settings.single_user_id, "video_events.jsonl", {"type": "video_resource_deleted", "resource_id": resource_id, "deleted": deleted})
    return ok({"resource_id": resource_id, "deleted": deleted})


@router.get("/resources/{resource_id}/scene")
async def get_video_scene(resource_id: str):
    scene_path = artifact_dir(resource_id) / "scene.html"
    if not scene_path.exists():
        raise HTTPException(status_code=404, detail="scene not found")
    return HTMLResponse(scene_path.read_text(encoding="utf-8"))


@router.get("/resources/{resource_id}/download/audio")
async def download_video_audio(resource_id: str):
    return _file_response(resource_id, "narration.wav", "audio/wav", f"{resource_id}-narration.wav")


@router.get("/resources/{resource_id}/download/srt")
async def download_video_srt(resource_id: str):
    return _file_response(resource_id, "subtitle.srt", "application/x-subrip", f"{resource_id}.srt")


@router.get("/resources/{resource_id}/download/mp4")
async def download_video_mp4(resource_id: str):
    root = artifact_dir(resource_id)
    mp4_path = root / "output.mp4"
    if mp4_path.exists():
        return FileResponse(
            mp4_path,
            media_type="video/mp4",
            filename=f"{resource_id}.mp4",
            headers={"Accept-Ranges": "bytes", "Cache-Control": "no-store"},
        )
    manifest_path = root / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="video artifact not found")
    # The development environment may not include FFmpeg. Return the manifest as
    # an explicit package fallback instead of pretending a muxed MP4 exists.
    return FileResponse(manifest_path, media_type="application/json", filename=f"{resource_id}-manifest.json")


@router.post("/resources/{resource_id}/share")
async def share_video(resource_id: str):
    item = _find_resource(resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="video resource not found")
    return ok({"share_url": item.get("share_url") or f"/share/video/{resource_id}", "expires_in": 7 * 24 * 3600})


def _read_artifact_json(resource_id: str, filename: str, default: Any) -> Any:
    path = artifact_dir(resource_id) / filename
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _file_response(resource_id: str, filename: str, media_type: str, download_name: str):
    path = artifact_dir(resource_id) / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{filename} not found")
    return FileResponse(path, media_type=media_type, filename=download_name)
