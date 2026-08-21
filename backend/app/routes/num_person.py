import time
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse

from ..auth import get_current_user
from ..config import settings
from ..schemas import ok
from ..schemas.num_person import MemoryLoadReq, ChatReq
from ..video_memory_service import load_memory, get_memory, clear_memory, MemoryNotFoundError, NoScriptError
from ..num_person_service import chat_stream
from ..xfyun_digital_human_auth import build_xfyun_digital_human_signed_url
from .common import sse_wrap

router = APIRouter(prefix="/api/num-person", tags=["num-person"])


def _digital_human_configured() -> bool:
    server_url = urlparse(settings.xf_dh_server_url)
    return bool(
        settings.xf_dh_app_id
        and settings.xf_dh_api_key
        and settings.xf_dh_api_secret
        and settings.xf_dh_avatar_id
        and server_url.scheme == "wss"
        and server_url.netloc
    )


@router.get("/digital-human/config")
async def digital_human_config():
    return ok({
        "enabled": settings.xf_dh_enabled,
        "configured": _digital_human_configured(),
        "provider": "xfyun",
        "sdk_url": settings.xf_dh_sdk_url,
        "avatar_id": settings.xf_dh_avatar_id,
        "scene_id": settings.xf_dh_scene_id,
        "scene_version": settings.xf_dh_scene_version,
        "stage": {
            "width": settings.xf_dh_width,
            "height": settings.xf_dh_height,
            "scale": settings.xf_dh_scale,
            "move_h": settings.xf_dh_move_h,
            "move_v": settings.xf_dh_move_v,
            "mask_region": {
                "top": settings.xf_dh_mask_top,
                "right": settings.xf_dh_mask_right,
                "bottom": settings.xf_dh_mask_bottom,
                "left": settings.xf_dh_mask_left,
            },
            "transparent": settings.xf_dh_transparent,
        },
        "tts": {
            "vcn": settings.xf_dh_tts_voice,
            "speed": settings.xf_dh_tts_speed,
            "pitch": settings.xf_dh_tts_pitch,
            "volume": settings.xf_dh_tts_volume,
        },
        "stream": {
            "protocol": settings.xf_dh_stream_protocol,
            "alpha": 1 if settings.xf_dh_transparent else 0,
        },
    })


@router.post("/digital-human/session")
async def digital_human_session(
    response: Response,
    current_user: dict = Depends(get_current_user),
):
    del current_user
    if not settings.xf_dh_enabled:
        raise HTTPException(
            status_code=404,
            detail={"code": "DH_DISABLED", "message": "讯飞数字人未启用"},
        )
    if not _digital_human_configured():
        raise HTTPException(
            status_code=503,
            detail={"code": "DH_NOT_CONFIGURED", "message": "讯飞数字人配置不完整"},
        )

    try:
        signed_url = build_xfyun_digital_human_signed_url(
            settings.xf_dh_server_url,
            settings.xf_dh_api_key,
            settings.xf_dh_api_secret,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "DH_SERVER_URL_INVALID", "message": str(exc)},
        ) from exc

    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return ok({
        "app_id": settings.xf_dh_app_id,
        "signed_url": signed_url,
        "expires_at": int(time.time()) + settings.xf_dh_signed_url_ttl_sec,
        "scene_id": settings.xf_dh_scene_id,
        "scene_version": settings.xf_dh_scene_version,
    })


@router.post("/memory/load")
async def memory_load(req: MemoryLoadReq):
    try:
        result = load_memory(req.video_id, req.user_id)
        return ok(result)
    except MemoryNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except NoScriptError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"记忆加载失败: {e}")


@router.post("/chat")
async def chat(req: ChatReq):
    async def gen():
        async for event_type, payload in chat_stream(req.memory_id, req.message, req.history):
            yield (event_type, payload)

    return StreamingResponse(sse_wrap(gen()), media_type="text/event-stream")


@router.get("/memory/{memory_id}")
async def memory_get(memory_id: str):
    info = get_memory(memory_id)
    if not info:
        raise HTTPException(status_code=404, detail="记忆不存在或已过期")
    return ok(info)


@router.delete("/memory/{memory_id}")
async def memory_delete(memory_id: str):
    cleared = clear_memory(memory_id)
    return ok({"memory_id": memory_id, "cleared": cleared})
