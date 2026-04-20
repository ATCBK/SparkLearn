import uuid
from collections.abc import AsyncGenerator
from datetime import datetime
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..llm import spark_lite
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json
from .common import sse_wrap

router = APIRouter(prefix="/api/resources", tags=["resources"])


class GenerateReq(BaseModel):
    type: str = "document"
    prompt: str


def _now_date() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


@router.get("")
async def get_resources():
    resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
    return ok(resources)


@router.post("/generate")
async def generate_resource(req: GenerateReq):
    async def gen() -> AsyncGenerator[tuple[str, dict[str, Any]], None]:
        res_id = f"gen-{uuid.uuid4().hex[:8]}"
        yield ("progress", {"stage": "started", "resource_id": res_id, "progress": 5})
        chunks: list[str] = []
        progress = 10

        async for evt_type, payload in spark_lite.stream_chat_events(req.prompt, mode="resource"):
            if evt_type == "text":
                chunk = str(payload.get("content", ""))
                if chunk:
                    chunks.append(chunk)
                    progress = min(progress + 8, 90)
                    yield ("text", {"content": chunk, "resource_id": res_id})
                    yield (
                        "progress",
                        {"stage": "generating", "resource_id": res_id, "progress": progress},
                    )
            elif evt_type == "error":
                yield ("error", payload)

        content = "".join(chunks)
        resource = {
            "id": res_id,
            "title": req.prompt[:20] or "新生成资源",
            "type": req.type,
            "status": "completed",
            "created_at": _now_date(),
            "content": f"# {req.prompt}\n\n{content}",
            "progress": 100,
        }

        resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
        resources.append(resource)
        write_json(settings.single_user_id, "resources_index.json", resources)
        append_jsonl(
            settings.single_user_id,
            "resource_usage.jsonl",
            {"type": "resource_generated", "resource_id": res_id},
        )
        yield ("done", {"resource_id": res_id, "resource": resource})

    return StreamingResponse(sse_wrap(gen()), media_type="text/event-stream")


@router.get("/{resource_id}")
async def get_resource_detail(resource_id: str):
    resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
    for item in resources:
        if item["id"] == resource_id:
            return ok(item)
    return ok(None)


@router.delete("/{resource_id}")
async def delete_resource(resource_id: str):
    resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
    before = len(resources)
    next_resources = [r for r in resources if str(r.get("id", "")) != resource_id]
    removed = before - len(next_resources)
    write_json(settings.single_user_id, "resources_index.json", next_resources)
    append_jsonl(
        settings.single_user_id,
        "resource_usage.jsonl",
        {
            "type": "resource_deleted",
            "resource_id": resource_id,
            "removed_count": removed,
        },
    )
    return ok({"resource_id": resource_id, "deleted": removed > 0})


@router.get("/recommendations/list")
async def get_recommendations():
    resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
    if not resources:
        return ok([])

    reason_map = [
        ("因为你当前阶段需要先补基础，建议优先完成这份资源。", "remedial"),
        ("基于你的学习路径，这是下一步最合适的资源。", "stage"),
        ("今日复习建议：用这份资料做一次巩固。", "today"),
    ]

    recs: list[dict[str, Any]] = []
    for idx, resource in enumerate(resources[:3]):
        reason, category = reason_map[idx]
        recs.append(
            {
                "id": f"rec{idx + 1}",
                "resource": resource,
                "reason": reason,
                "category": category,
            }
        )
    return ok(recs)


def _default_resources() -> list[dict[str, Any]]:
    return [
        {
            "id": "r1",
            "title": "变量与数据类型详解",
            "type": "document",
            "status": "completed",
            "created_at": "2026-04-15",
            "content": "# 变量与数据类型\n\n...",
        },
        {
            "id": "r2",
            "title": "Python 函数基础 PPT",
            "type": "ppt",
            "status": "completed",
            "created_at": "2026-04-14",
            "docmee_id": "demo-1",
        },
        {
            "id": "r3",
            "title": "条件逻辑思维导图",
            "type": "mindmap",
            "status": "completed",
            "created_at": "2026-04-13",
            "content": "# 条件逻辑\n\n...",
        },
        {
            "id": "r4",
            "title": "函数练习题集",
            "type": "quiz",
            "status": "completed",
            "created_at": "2026-04-12",
        },
        {
            "id": "r5",
            "title": "Python 标准库扩展阅读",
            "type": "reading",
            "status": "completed",
            "created_at": "2026-04-11",
            "content": "# Python 标准库\n\n...",
        },
        {
            "id": "r6",
            "title": "装饰器代码案例",
            "type": "code",
            "status": "completed",
            "created_at": "2026-04-10",
            "content": "```python\n...\n```",
        },
    ]
