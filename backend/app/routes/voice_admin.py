import json
import logging

from fastapi import APIRouter, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from ..clients.tts_client import tts_client
from ..clients.cosyvoice_tts_client import cosyvoice_tts_client
from ..config import settings
from ..db import fetch_all, fetch_one
from ..schemas import ok
from ..storage import read_json

logger = logging.getLogger("api.voice_admin")

router = APIRouter(prefix="/api", tags=["voice-admin"])


class TTSReq(BaseModel):
    text: str
    voice: str = ""
    speed: int = 50
    volume: int = 60
    pitch: int = 50


def _pick_tts_provider() -> str:
    """根据配置返回实际使用的 TTS provider: 'cosyvoice' 或 'xfyun'"""
    provider = settings.tts_provider.lower()
    if provider == "cosyvoice":
        return "cosyvoice"
    if provider == "xfyun":
        return "xfyun"
    # auto: 优先 CosyVoice，降级讯飞
    if cosyvoice_tts_client.is_configured():
        return "cosyvoice"
    if tts_client.is_configured():
        return "xfyun"
    return "cosyvoice"  # 都没配，返回默认


@router.post("/voice/asr")
async def asr(audio: UploadFile):
    del audio
    return ok({"text": "这是语音识别占位结果"})


@router.post("/voice/tts")
async def tts(req: TTSReq):
    provider = _pick_tts_provider()

    if provider == "cosyvoice":
        success, audio_bytes, message = cosyvoice_tts_client.synthesize(
            req.text, voice=req.voice,
            speech_rate=req.speed / 50.0,   # 50=正常 -> 1.0
            pitch_rate=req.pitch / 50.0,
            volume=req.volume / 50.0,
        )
        default_voice = settings.cosyvoice_default_voice
        media_type = f"audio/{settings.cosyvoice_format}"
        if not success and settings.tts_provider == "auto":
            # auto 模式下降级到讯飞
            logger.warning("CosyVoice 失败，降级到讯飞 TTS: %s", message)
            success, audio_bytes, message = tts_client.synthesize(
                req.text, voice=req.voice, speed=req.speed, volume=req.volume, pitch=req.pitch
            )
            provider = "xfyun"
            default_voice = settings.xf_tts_default_voice
            media_type = "audio/wav"
    else:
        success, audio_bytes, message = tts_client.synthesize(
            req.text, voice=req.voice, speed=req.speed, volume=req.volume, pitch=req.pitch
        )
        default_voice = settings.xf_tts_default_voice
        media_type = "audio/wav"

    if not success:
        return Response(
            content=json.dumps({"success": False, "error": message}, ensure_ascii=False),
            media_type="application/json",
            status_code=500,
        )
    return Response(
        content=audio_bytes,
        media_type=media_type,
        headers={
            "X-TTS-Provider": provider,
            "X-TTS-Voice": req.voice or default_voice,
        },
    )


@router.get("/voice/tts/status")
async def tts_status():
    provider = _pick_tts_provider()
    if provider == "cosyvoice":
        return ok({
            "provider": "cosyvoice",
            "configured": cosyvoice_tts_client.is_configured(),
            "model": settings.cosyvoice_model,
            "default_voice": settings.cosyvoice_default_voice,
            "format": settings.cosyvoice_format,
            "sample_rate": settings.cosyvoice_sample_rate,
        })
    return ok({
        "provider": "xunfei_tts",
        "configured": tts_client.is_configured(),
        "base_url": settings.xf_tts_base_url,
        "default_voice": settings.xf_tts_default_voice,
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
