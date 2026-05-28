from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..schemas import ok
from ..schemas.num_person import MemoryLoadReq, ChatReq
from ..video_memory_service import load_memory, get_memory, clear_memory, MemoryNotFoundError, NoScriptError
from ..num_person_service import chat_stream
from .common import sse_wrap

router = APIRouter(prefix="/api/num-person", tags=["num-person"])


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
