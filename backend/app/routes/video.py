import asyncio
import json
import re
import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field

from ..config import settings
from ..auth import get_current_user
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json
from ..video_ai import VideoAIScriptError
from ..video_generator import artifact_dir, build_video_artifacts, make_polished_script, now_iso
from .common import sse_wrap


router = APIRouter(prefix="/api/video", tags=["video"])

_video_job_tasks: dict[str, asyncio.Task[dict[str, Any]]] = {}
_video_generation_semaphore: asyncio.Semaphore | None = None
_video_generation_semaphore_limit: int | None = None


def _video_job_task_key(user_id: str, job_id: str) -> str:
    return f"{user_id}:{job_id}"


def _get_video_generation_semaphore() -> asyncio.Semaphore:
    global _video_generation_semaphore, _video_generation_semaphore_limit
    limit = max(1, int(getattr(settings, "video_generation_max_concurrency", 1) or 1))
    if _video_generation_semaphore is None or _video_generation_semaphore_limit != limit:
        _video_generation_semaphore = asyncio.Semaphore(limit)
        _video_generation_semaphore_limit = limit
    return _video_generation_semaphore


def _default_public_voice_config() -> dict[str, Any]:
    return {
        "provider": "cosyvoice",
        "voice": settings.cosyvoice_default_voice,
        "speed": settings.cosyvoice_speech_rate,
        "pitch": settings.cosyvoice_pitch_rate,
        "volume": settings.cosyvoice_volume,
    }


@router.get("/styles")
async def list_video_styles():
    """返回可用的视频风格模版列表"""
    styles = settings.video_styles
    result = []
    for style_id, cfg in styles.items():
        if isinstance(cfg, dict):
            result.append({
                "id": style_id,
                "name": cfg.get("name", style_id),
                "description": cfg.get("description", ""),
                "accent_color": cfg.get("accent_color", "#0071e3"),
                "bg_gradient": cfg.get("bg_gradient", ""),
                "font_family": cfg.get("font_family", ""),
                "tone": cfg.get("tone", ""),
            })
    return ok(result)


class VideoPolishReq(BaseModel):
    prompt: str = Field(min_length=1)
    course_id: str = "python_basic"
    user_id: str = "single_user"
    target_level: str = "beginner"
    duration_sec: int = Field(default=90, ge=15, le=180)
    style_id: str = "apple-minimal"
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
    style_id: str = "apple-minimal"
    target_level: str = "beginner"
    duration_sec: int = 90
    voice: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)


def _jobs(user_id: str) -> list[dict[str, Any]]:
    return read_json(user_id, "video_jobs.json", [])


def _save_jobs(user_id: str, items: list[dict[str, Any]]) -> None:
    write_json(user_id, "video_jobs.json", items)


def _resources(user_id: str) -> list[dict[str, Any]]:
    return read_json(user_id, "video_resources.json", [])


def _save_resources(user_id: str, items: list[dict[str, Any]]) -> None:
    write_json(user_id, "video_resources.json", items)


def _api_url(path: str) -> str:
    return path


def _resource_payload(resource_id: str, manifest: dict[str, Any], status: str = "completed") -> dict[str, Any]:
    duration_ms = int(manifest.get("duration_ms") or 0)
    voice_meta = manifest.get("voice") or {}
    if isinstance(voice_meta, dict):
        voice_value = str(voice_meta.get("voice") or "")
        voice_provider = str(voice_meta.get("provider") or "")
    else:
        voice_value = str(voice_meta or "")
        voice_provider = ""
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
        "voice_provider": voice_provider,
        "voice": voice_value,
        "has_mp4": bool(manifest.get("has_mp4")),
        "slides": int(manifest.get("slides") or 0),
        "audio_status": str(manifest.get("audio_status") or ""),
        "audio_message": str(manifest.get("audio_message") or ""),
        "frame_status": str(manifest.get("frame_status") or ""),
        "frame_message": str(manifest.get("frame_message") or ""),
        "mux_status": str(manifest.get("mux_status") or ""),
        "mux_message": str(manifest.get("mux_message") or ""),
    }


def _find_resource(user_id: str, resource_id: str) -> dict[str, Any] | None:
    return next((item for item in _resources(user_id) if str(item.get("id")) == resource_id), None)


def _update_job(user_id: str, job_id: str, **updates: Any) -> None:
    jobs = _jobs(user_id)
    for item in jobs:
        if str(item.get("job_id")) == job_id:
            item.update(updates)
            break
    _save_jobs(user_id, jobs)


async def _run_video_job_once(user_id: str, job_id: str, job: dict[str, Any]) -> dict[str, Any]:
    resource_id = str(job["resource_id"])
    existing = _find_resource(user_id, resource_id)
    if existing:
        return existing

    _update_job(user_id, job_id, status="running", progress=18, started_at=now_iso())
    async with _get_video_generation_semaphore():
        existing = _find_resource(user_id, resource_id)
        if existing:
            return existing

        manifest = await asyncio.to_thread(build_video_artifacts, resource_id, job)
        resource = _resource_payload(resource_id, manifest)
        resources = [item for item in _resources(user_id) if str(item.get("id")) != resource_id]
        resources.insert(0, resource)
        _save_resources(user_id, resources)
        _update_job(user_id, job_id, status="completed", progress=100, completed_at=now_iso())
        append_jsonl(user_id, "video_events.jsonl", {"type": "video_job_completed", "job_id": job_id, "resource_id": resource_id})
        return resource


def _ensure_video_job_task(user_id: str, job_id: str, job: dict[str, Any]) -> asyncio.Task[dict[str, Any]]:
    key = _video_job_task_key(user_id, job_id)
    task = _video_job_tasks.get(key)
    if task is None or task.cancelled() or (task.done() and task.exception() is not None):
        task = asyncio.create_task(_run_video_job_once(user_id, job_id, dict(job)))
        _video_job_tasks[key] = task

        def cleanup(done_task: asyncio.Task[dict[str, Any]]) -> None:
            if not done_task.cancelled() and done_task.exception() is None:
                _video_job_tasks.pop(key, None)

        task.add_done_callback(cleanup)
    return task


def _video_artifact_path(resource_id: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", resource_id):
        raise HTTPException(status_code=400, detail="invalid resource id")
    root = (settings.data_dir / "artifacts" / "video").resolve()
    path = (root / resource_id).resolve()
    if root != path and root not in path.parents:
        raise HTTPException(status_code=400, detail="invalid resource path")
    return path


@router.post("/polish")
async def polish_video_prompt(req: VideoPolishReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    voice = req.voice.strip() or settings.cosyvoice_default_voice
    result = make_polished_script(
        prompt=req.prompt,
        duration_sec=req.duration_sec,
        target_level=req.target_level,
        style=req.style_id or req.style or "apple-minimal",
        voice=voice,
    )
    result["voice"] = voice
    append_jsonl(user_id, "video_events.jsonl", {"type": "video_polished", "polish_id": result["polish_id"], "style_id": req.style_id})
    return ok(result)


@router.post("/jobs")
async def create_video_job(req: VideoJobReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    resource_id = f"video_{uuid.uuid4().hex[:8]}"
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    voice = _default_public_voice_config()
    job = {
        "job_id": job_id,
        "resource_id": resource_id,
        "status": "queued",
        "progress": 0,
        "created_at": now_iso(),
        **req.model_dump(),
        "voice": voice,
    }
    jobs = _jobs(user_id)
    jobs.append(job)
    _save_jobs(user_id, jobs)
    append_jsonl(user_id, "video_events.jsonl", {"type": "video_job_created", "job_id": job_id, "resource_id": resource_id})
    return ok({"job_id": job_id, "resource_id": resource_id, "status": "queued", "events_url": f"/api/video/jobs/{job_id}/events"})


@router.get("/jobs/{job_id}/events")
async def video_job_events(job_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]

    async def gen():
        jobs = _jobs(user_id)
        job = next((item for item in jobs if str(item.get("job_id")) == job_id), None)
        if not job:
            yield ("error", {"code": "VIDEO_JOB_NOT_FOUND", "message": "视频任务不存在", "retryable": False})
            return

        resource_id = str(job["resource_id"])
        existing = _find_resource(user_id, resource_id)
        if existing:
            yield ("progress", {"stage": "completed", "progress": 100, "resource_id": resource_id})
            yield ("done", {"resource_id": resource_id, "resource": existing})
            return

        style_id = str(job.get("style_id") or job.get("styleId") or "apple-minimal")
        style_config = settings.video_styles.get(style_id, settings.video_styles.get("apple-minimal", {}))
        style_name = style_config.get("name", style_id) if isinstance(style_config, dict) else style_id

        stages = [
            ("scripting", 18, f"正在用 {style_name} 风格整理分镜与讲稿"),
            ("video_rendering", 42, f"正在以 {style_name} 风格生成教学场景"),
            ("tts_synthesizing", 68, "正在生成语音播报"),
            ("muxing", 88, "正在写入字幕与时间轴"),
        ]
        for stage, progress, message in stages:
            yield ("progress", {"stage": stage, "progress": progress, "message": message, "resource_id": resource_id})
            await asyncio.sleep(0.25)

        try:
            resource = await asyncio.shield(_ensure_video_job_task(user_id, job_id, job))
            yield ("artifact", {"kind": "timeline", "url": resource["timeline_url"], "resource_id": resource_id})
            yield ("progress", {"stage": "completed", "progress": 100, "message": "视频创作产物已生成", "resource_id": resource_id})
            yield ("done", {"resource_id": resource_id, "resource": resource})
        except VideoAIScriptError as ex:
            _update_job(user_id, job_id, status="failed", progress=0, failed_at=now_iso(), error=str(ex))
            yield ("error", {"code": "VIDEO_SCRIPT_ERROR", "message": str(ex), "retryable": False})
        except Exception as ex:
            _update_job(user_id, job_id, status="failed", progress=0, failed_at=now_iso(), error=str(ex))
            yield ("error", {"code": "VIDEO_GENERATION_FAILED", "message": f"视频生成失败：{ex}", "retryable": True})

    return StreamingResponse(sse_wrap(gen()), media_type="text/event-stream")


@router.get("/resources")
async def list_video_resources(current_user: dict = Depends(get_current_user)):
    return ok(_resources(current_user["user_id"]))


@router.get("/resources/{resource_id}")
async def get_video_resource(resource_id: str, current_user: dict = Depends(get_current_user)):
    item = _find_resource(current_user["user_id"], resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="video resource not found")
    timeline = _read_artifact_json(resource_id, "timeline.json", {})
    return ok({**item, "timeline": timeline.get("segments", [])})


@router.get("/resources/{resource_id}/timeline")
async def get_video_timeline(resource_id: str, current_user: dict = Depends(get_current_user)):
    item = _find_resource(current_user["user_id"], resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="video resource not found")
    return ok(_read_artifact_json(resource_id, "timeline.json", {}))


@router.delete("/resources/{resource_id}")
async def delete_video_resource(resource_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    resources = _resources(user_id)
    next_resources = [item for item in resources if str(item.get("id")) != resource_id]
    deleted = len(next_resources) != len(resources)
    _save_resources(user_id, next_resources)

    jobs = _jobs(user_id)
    next_jobs = [item for item in jobs if str(item.get("resource_id")) != resource_id]
    _save_jobs(user_id, next_jobs)

    artifact_path = _video_artifact_path(resource_id)
    if artifact_path.exists():
        shutil.rmtree(artifact_path)
        deleted = True

    append_jsonl(user_id, "video_events.jsonl", {"type": "video_resource_deleted", "resource_id": resource_id, "deleted": deleted})
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
async def share_video(resource_id: str, current_user: dict = Depends(get_current_user)):
    item = _find_resource(current_user["user_id"], resource_id)
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
