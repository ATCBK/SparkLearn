import json
import uuid
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..db import execute, fetch_one, now_iso
from ..llm import spark_lite
from ..schemas import fail, ok
from ..storage import append_jsonl, write_json
from .common import sse_wrap


router = APIRouter(prefix="/api/profile", tags=["profile"])

_sessions: dict[str, dict[str, Any]] = {}


class ProfileChatReq(BaseModel):
    session_id: str
    message: str


class ProfileOnboardingReq(BaseModel):
    goal: list[str] = []
    level: list[str] = []
    weak: list[str] = []
    preference: list[str] = []
    time: list[str] = []


class ProfileUpdateReq(BaseModel):
    goal: list[str] | None = None
    knowledge_level: str | None = None
    weak_points: list[str] | None = None
    learning_preference: list[str] | None = None
    cognitive_style: str | None = None
    daily_time: int | None = None
    practical_ability: str | None = None
    current_stage: str | None = None


@router.post("/onboarding")
async def onboarding(req: ProfileOnboardingReq):
    profile = _build_profile_from_onboarding(req)
    _upsert_profile(profile)
    _write_profile_snapshot(profile)
    append_jsonl(settings.single_user_id, "learning_events.jsonl", {"type": "profile_onboarding", "profile": profile})
    return ok({"version": profile["version"], "message": "onboarding profile saved"})


@router.post("/initiate")
async def initiate():
    session_id = f"sess_{uuid.uuid4().hex[:8]}"
    _sessions[session_id] = {"round": 1, "messages": []}
    return ok(
        {
            "session_id": session_id,
            "first_question": "你好，我是学习助手。请先告诉我你的专业和当前学习目标。",
            "round": 1,
            "total_rounds": 3,
        }
    )


@router.post("/chat")
async def chat(req: ProfileChatReq):
    if req.session_id not in _sessions:
        return fail("会话已过期")

    async def gen():
        session = _sessions[req.session_id]
        session["messages"].append({"role": "user", "content": req.message, "ts": now_iso()})
        round_no = session["round"]
        history_for_model = [{"role": m["role"], "content": m["content"]} for m in session["messages"][-6:]]
        async for evt_type, payload in spark_lite.stream_chat_events(req.message, mode="general", history=history_for_model):
            if evt_type == "text":
                yield ("text", {"content": str(payload.get("content", ""))})
            elif evt_type == "error":
                yield ("error", payload)
        round_no += 1
        session["round"] = round_no
        if round_no > 3:
            profile = _build_profile_from_dialog(session["messages"])
            _upsert_profile(profile)
            _write_profile_snapshot(profile)
            append_jsonl(
                settings.single_user_id,
                "learning_events.jsonl",
                {"type": "profile_dialog_completed", "session_id": req.session_id, "profile": profile},
            )
            yield ("done", {"round": 3, "total_rounds": 3, "profile_saved": True})
            _sessions.pop(req.session_id, None)
        else:
            yield ("done", {"round": round_no, "total_rounds": 3, "profile_saved": False})

    return StreamingResponse(sse_wrap(gen()), media_type="text/event-stream")


@router.get("")
async def get_profile():
    row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (settings.single_user_id,))
    if not row:
        return fail("profile not found")
    return ok(_row_to_profile(row))


@router.put("")
async def update_profile(req: ProfileUpdateReq):
    row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (settings.single_user_id,))
    if not row:
        return fail("profile not found")
    profile = _row_to_profile(row)
    patch = req.model_dump(exclude_none=True)
    profile.update(patch)
    profile["version"] = int(profile.get("version", 1)) + 1
    profile["updated_at"] = now_iso()
    _upsert_profile(profile)
    _write_profile_snapshot(profile)
    append_jsonl(settings.single_user_id, "learning_events.jsonl", {"type": "profile_updated", "patch": patch})
    return ok({"version": profile["version"]})


def _upsert_profile(profile: dict[str, Any]) -> None:
    execute(
        """
        INSERT INTO profiles(
          user_id, goal, knowledge_level, weak_points, learning_preference, cognitive_style,
          daily_time, practical_ability, current_stage, version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          goal=excluded.goal,
          knowledge_level=excluded.knowledge_level,
          weak_points=excluded.weak_points,
          learning_preference=excluded.learning_preference,
          cognitive_style=excluded.cognitive_style,
          daily_time=excluded.daily_time,
          practical_ability=excluded.practical_ability,
          current_stage=excluded.current_stage,
          version=excluded.version,
          updated_at=excluded.updated_at
        """,
        (
            settings.single_user_id,
            json.dumps(profile.get("goal", []), ensure_ascii=False),
            profile.get("knowledge_level", ""),
            json.dumps(profile.get("weak_points", []), ensure_ascii=False),
            json.dumps(profile.get("learning_preference", []), ensure_ascii=False),
            profile.get("cognitive_style", ""),
            int(profile.get("daily_time", 60)),
            profile.get("practical_ability", ""),
            profile.get("current_stage", ""),
            int(profile.get("version", 1)),
            profile.get("updated_at", now_iso()),
        ),
    )


def _row_to_profile(row) -> dict[str, Any]:
    return {
        "user_id": row["user_id"],
        "goal": json.loads(row["goal"] or "[]"),
        "knowledge_level": row["knowledge_level"],
        "weak_points": json.loads(row["weak_points"] or "[]"),
        "learning_preference": json.loads(row["learning_preference"] or "[]"),
        "cognitive_style": row["cognitive_style"],
        "daily_time": row["daily_time"],
        "practical_ability": row["practical_ability"],
        "current_stage": row["current_stage"],
        "version": row["version"],
    }


def _build_profile_from_onboarding(req: ProfileOnboardingReq) -> dict[str, Any]:
    return {
        "goal": req.goal or ["期末提分"],
        "knowledge_level": req.level[0] if req.level else "有一些基础",
        "weak_points": req.weak or ["函数"],
        "learning_preference": req.preference or ["实践型"],
        "cognitive_style": "归纳型",
        "daily_time": _parse_daily_time(req.time[0] if req.time else "30-60分钟"),
        "practical_ability": "能独立完成小项目",
        "current_stage": "函数与模块",
        "version": 1,
        "updated_at": now_iso(),
    }


def _build_profile_from_dialog(messages: list[dict[str, Any]]) -> dict[str, Any]:
    joined = " ".join(m["content"] for m in messages if m["role"] == "user")
    return {
        "goal": ["竞赛准备"] if "竞赛" in joined else ["期末提分"],
        "knowledge_level": "有一些基础",
        "weak_points": ["函数", "面向对象"],
        "learning_preference": ["实践型", "视觉型"],
        "cognitive_style": "归纳型",
        "daily_time": 60,
        "practical_ability": "能独立完成小项目",
        "current_stage": "函数与模块",
        "version": 1,
        "updated_at": now_iso(),
    }


def _parse_daily_time(raw: str) -> int:
    if "30" in raw and "60" in raw:
        return 45
    if "2小时以上" in raw:
        return 150
    if "1-2" in raw:
        return 90
    return 30


def _write_profile_snapshot(profile: dict[str, Any]) -> None:
    write_json(settings.single_user_id, "profile_snapshot.json", profile)
