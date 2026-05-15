import base64
import hashlib
import hmac
import io
import json
import ssl
import wave
from email.utils import formatdate
from urllib.parse import urlencode, urlparse

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
    voice: str = ""
    speed: int = 50
    volume: int = 60
    pitch: int = 50


def _has_tts_config() -> bool:
    return bool(settings.xf_tts_app_id and settings.xf_tts_api_key and settings.xf_tts_api_secret)


def _build_auth_url() -> str:
    parsed = urlparse(settings.xf_tts_base_url)
    host = parsed.netloc
    path = parsed.path or "/v2/tts"
    date = formatdate(timeval=None, localtime=False, usegmt=True)
    signature_origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
    digest = hmac.new(
        settings.xf_tts_api_secret.encode("utf-8"),
        signature_origin.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    signature = base64.b64encode(digest).decode("ascii")
    authorization_origin = (
        f'api_key="{settings.xf_tts_api_key}", algorithm="hmac-sha256", '
        f'headers="host date request-line", signature="{signature}"'
    )
    query = urlencode(
        {
            "authorization": base64.b64encode(authorization_origin.encode("utf-8")).decode("ascii"),
            "date": date,
            "host": host,
        }
    )
    return f"{settings.xf_tts_base_url}?{query}"


def _pcm_to_wav(pcm: bytes, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm)
    return buf.getvalue()


def _synthesize(text: str, voice: str = "", speed: int = 50, volume: int = 60, pitch: int = 50) -> tuple[bool, bytes | None, str]:
    """Call iFlytek TTS WebSocket and return (success, wav_bytes, message)."""
    if not text.strip():
        return False, None, "文本为空"
    if not _has_tts_config():
        return False, None, "TTS 未配置（缺少讯飞密钥）"

    try:
        from websockets.sync.client import connect
    except Exception as ex:
        return False, None, f"websockets 库不可用：{ex}"

    vcn = voice or settings.xf_tts_default_voice
    # Split long text into chunks
    limit = settings.xf_tts_text_limit
    chunks = [text[i:i + limit] for i in range(0, len(text), limit)] if len(text) > limit else [text]

    all_pcm = bytearray()
    for chunk in chunks:
        try:
            auth_url = _build_auth_url()
            payload = {
                "common": {"app_id": settings.xf_tts_app_id},
                "business": {
                    "aue": "raw",
                    "auf": "audio/L16;rate=16000",
                    "vcn": vcn,
                    "tte": "utf8",
                    "speed": speed,
                    "volume": volume,
                    "pitch": pitch,
                },
                "data": {
                    "status": 2,
                    "text": base64.b64encode(chunk.encode("utf-8")).decode("ascii"),
                },
            }
            timeout_sec = max(5, settings.xf_tts_timeout_ms / 1000)
            pcm = bytearray()
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
            with connect(auth_url, open_timeout=timeout_sec, ssl=ssl_ctx) as ws:
                ws.send(json.dumps(payload, ensure_ascii=False))
                while True:
                    raw = ws.recv(timeout=timeout_sec)
                    data = json.loads(raw)
                    header = data.get("header", {})
                    code = int(header.get("code", 0))
                    if code != 0:
                        return False, None, f"讯飞 TTS 错误 {code}: {header.get('message', '')}"
                    audio_b64 = data.get("data", {}).get("audio", "")
                    if audio_b64:
                        pcm.extend(base64.b64decode(audio_b64))
                    if int(data.get("data", {}).get("status", 0)) == 2:
                        break
            all_pcm.extend(pcm)
        except Exception as ex:
            return False, None, f"讯飞 TTS 调用失败：{ex}"

    if not all_pcm:
        return False, None, "讯飞 TTS 未返回音频数据"

    wav_bytes = _pcm_to_wav(bytes(all_pcm))
    return True, wav_bytes, "ok"


@router.post("/voice/asr")
async def asr(audio: UploadFile):
    del audio
    return ok({"text": "这是语音识别占位结果"})


@router.post("/voice/tts")
async def tts(req: TTSReq):
    success, wav_bytes, message = _synthesize(
        req.text, voice=req.voice, speed=req.speed, volume=req.volume, pitch=req.pitch
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
            "X-TTS-Voice": req.voice or settings.xf_tts_default_voice,
        },
    )


@router.get("/voice/tts/status")
async def tts_status():
    return ok({
        "provider": "xunfei_tts",
        "configured": _has_tts_config(),
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
