import json

from fastapi import APIRouter, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from ..clients import cosyvoice_tts_client
from ..config import settings
from ..db import fetch_all, fetch_one
from ..schemas import ok
from ..storage import read_json


router = APIRouter(prefix="/api", tags=["voice-admin"])


class TTSReq(BaseModel):
    text: str
    voice: str = ""
    speed: int = 50
    volume: int = 60
    pitch: int = 50


def _has_tts_config() -> bool:
    return bool(cosyvoice_tts_client.is_configured())


def _synthesize(
    text: str,
    voice: str = "",
    speed: int = 50,
    volume: int = 60,
    pitch: int = 50,
) -> tuple[bool, bytes | None, str]:
    if not text.strip():
        return False, None, "文本不能为空"
    if not _has_tts_config():
        return False, None, "TTS 未配置（缺少 CosyVoice 密钥）"
    del voice, speed, volume, pitch
    return cosyvoice_tts_client.synthesize(text)


@router.post("/voice/asr")
async def asr(audio: UploadFile):
    del audio
    return ok({"text": "这是语音识别占位结果"})


@router.post("/voice/tts")
async def tts(req: TTSReq):
    success, wav_bytes, message = _synthesize(
        req.text,
        voice=req.voice,
        speed=req.speed,
        volume=req.volume,
        pitch=req.pitch,
    )
    if not success:
        return Response(
            content=json.dumps({"success": False, "error": message}, ensure_ascii=False),
            media_type="application/json",
            status_code=500,
        )
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={
            "X-TTS-Provider": "xunfei_tts",
            "X-TTS-Voice": settings.cosyvoice_default_voice,
        },
    )


@router.get("/voice/tts/status")
async def tts_status():
    return ok({
        "provider": "xunfei_tts",
        "configured": _has_tts_config(),
        "base_url": settings.xf_tts_base_url,
        "default_voice": settings.cosyvoice_default_voice,
        "text_limit": settings.xf_tts_text_limit,
    })


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
