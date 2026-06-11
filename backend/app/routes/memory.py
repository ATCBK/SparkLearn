from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings
from ..memory_engine import (
    add_memory_item,
    build_injected_context,
    consolidate_memory,
    forget_memory,
    load_user_memory,
    save_user_memory,
    search_memory,
)
from ..schemas import fail, ok

router = APIRouter(prefix="/api/memory", tags=["memory"])


class AddMemoryReq(BaseModel):
    memory_type: str
    content: str
    tags: list[str] = []
    source: str = "manual"
    importance: float = 0.5
    confidence: float = 0.8
    pinned: bool = False
    expires_at: str = ""


class SearchMemoryReq(BaseModel):
    query: str
    types: list[str] = []
    top_k: int = 12


class ForgetReq(BaseModel):
    max_age_days: int = 30
    importance_below: float = 0.35
    clear_working: bool = False


class InjectContextReq(BaseModel):
    question: str
    top_k: int = 8


class ConsolidateReq(BaseModel):
    threshold: float = 0.7


class PatchSemanticReq(BaseModel):
    goals: list[str] | None = None
    preferences: list[str] | None = None
    constraints: list[str] | None = None
    facts: list[str] | None = None
    skills: list[str] | None = None
    weak_points: list[str] | None = None
    learning_stage: str | None = None


@router.get("")
async def get_memory():
    return ok(load_user_memory(settings.single_user_id))


@router.get("/profile/{user_id}")
async def get_profile(user_id: str):
    if user_id != settings.single_user_id:
        return fail("user not found")
    return ok(load_user_memory(user_id).get("semantic", {}))


@router.post("/add")
async def add_memory(req: AddMemoryReq):
    try:
        item = add_memory_item(
            user_id=settings.single_user_id,
            memory_type=req.memory_type,
            content=req.content,
            tags=req.tags,
            source=req.source,
            importance=req.importance,
            confidence=req.confidence,
            pinned=req.pinned,
            expires_at=req.expires_at,
        )
    except ValueError as ex:
        return fail(str(ex))
    return ok(item)


@router.post("/search")
async def search(req: SearchMemoryReq):
    rows = search_memory(settings.single_user_id, req.query, req.types, req.top_k)
    return ok(rows)


@router.post("/inject-context")
async def inject_context(req: InjectContextReq):
    context_text = build_injected_context(settings.single_user_id, req.question, req.top_k)
    return ok({"context": context_text})


@router.post("/consolidate")
async def consolidate(req: ConsolidateReq):
    data = consolidate_memory(settings.single_user_id, req.threshold)
    return ok(data)


@router.post("/forget")
async def forget(req: ForgetReq):
    data = forget_memory(
        settings.single_user_id,
        max_age_days=req.max_age_days,
        importance_below=req.importance_below,
        clear_working=req.clear_working,
    )
    return ok(data)


@router.put("/profile")
async def patch_profile(req: PatchSemanticReq):
    mem = load_user_memory(settings.single_user_id)
    sem = mem.get("semantic", {})
    patch = req.model_dump(exclude_none=True)
    for k, v in patch.items():
        sem[k] = v
    mem["semantic"] = sem
    saved = save_user_memory(settings.single_user_id, mem)
    return ok(saved.get("semantic", {}))
