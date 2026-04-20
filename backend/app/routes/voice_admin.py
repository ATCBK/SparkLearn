from fastapi import APIRouter, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from ..config import settings
from ..db import fetch_all, fetch_one
from ..schemas import ok
from ..storage import read_json


router = APIRouter(prefix="/api", tags=["voice-admin"])


class TTSReq(BaseModel):
    text: str


@router.post("/voice/asr")
async def asr(audio: UploadFile):
    del audio
    return ok({"text": "这是语音识别占位结果"})


@router.post("/voice/tts")
async def tts(req: TTSReq):
    payload = f"FAKE_MP3::{req.text}".encode("utf-8")
    return Response(content=payload, media_type="audio/mpeg")


@router.get("/admin/students")
async def admin_students():
    profile = fetch_one("SELECT current_stage FROM profiles WHERE user_id = ?", (settings.single_user_id,))
    return ok(
        [
            {
                "user_id": settings.single_user_id,
                "name": "张同学",
                "major": "计算机科学",
                "current_stage": profile["current_stage"] if profile else "函数与模块",
                "completion_rate": 0.62,
                "last_active_time": "2026-04-16T10:30:00Z",
            }
        ]
    )


@router.get("/admin/resources")
async def admin_resources():
    resources = read_json(settings.single_user_id, "resources_index.json", [])
    return ok(resources)


@router.get("/admin/dashboard")
async def admin_dashboard():
    rows = fetch_all("SELECT score FROM mastery_records WHERE user_id = ?", (settings.single_user_id,))
    avg = sum(r["score"] for r in rows) / max(1, len(rows))
    return ok({"student_count": 1, "average_mastery": round(avg, 3)})

