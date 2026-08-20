import json
import math
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..auth import get_current_user
from ..db import execute, fetch_one, now_iso
from ..llm import spark_lite
from ..profile_ai import build_rule_fallback_analysis, extract_dialog_profile, generate_profile_analysis
from ..schemas import fail, ok
from ..storage import append_jsonl, read_json, update_json, write_json
from .common import sse_wrap


router = APIRouter(prefix="/api/profile", tags=["profile"])

_sessions: dict[str, dict[str, Any]] = {}
PROFILE_HISTORY_FILE = "profile_history.json"
PROFILE_ANALYSIS_FILE = "profile_ai_analysis.json"
PROFILE_HISTORY_INTERVAL_DAYS = 3
PROFILE_LEARNING_FIELDS = (
    "major",
    "grade",
    "goal",
    "knowledge_level",
    "weak_points",
    "learning_preference",
    "cognitive_style",
    "daily_time",
    "practical_ability",
    "current_stage",
    "version",
)
PROFILE_ANALYSIS_REQUIRED_FIELDS = {
    "status",
    "schema_version",
    "profile_version",
    "source_type",
    "generated_by",
    "model",
    "confidence",
    "overview",
    "narrative",
    "goal_gap",
    "strengths",
    "focus_areas",
    "learning_strategy",
    "next_actions",
    "evidence",
    "analysis_steps",
    "updated_at",
}


class ProfileChatReq(BaseModel):
    session_id: str
    message: str


class ProfileOnboardingReq(BaseModel):
    name: str | None = None
    grade: str | None = None
    major: list[str] = []
    goal: list[str] = []
    level: list[str] = []
    weak: list[str] = []
    preference: list[str] = []
    time: list[str] = []


class ProfileUpdateReq(BaseModel):
    name: str | None = None
    email: str | None = None
    major: str | None = None
    grade: str | None = None
    goal: list[str] | None = None
    knowledge_level: str | None = None
    weak_points: list[str] | None = None
    learning_preference: list[str] | None = None
    cognitive_style: str | None = None
    daily_time: int | None = None
    practical_ability: str | None = None
    current_stage: str | None = None


@router.post("/onboarding")
async def onboarding(req: ProfileOnboardingReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    if not _onboarding_has_learning_data(req):
        return fail("请至少提供一项学习画像信息")
    profile = _build_profile_from_onboarding(req)
    profile["version"] = _next_profile_version(user_id)
    major = _first_nonempty(req.major)
    _upsert_student_identity(user_id, name=req.name, grade=req.grade, major=major)
    _sync_profile_student_identity(user_id, profile)
    _upsert_profile(user_id, profile)
    _write_profile_snapshot(user_id, profile)
    source_text = json.dumps(_onboarding_source_payload(req), ensure_ascii=False)
    analysis = await _generate_and_store_analysis(user_id, profile, "onboarding", source_text)
    _record_profile_history(user_id, profile, reason="onboarding", analysis=analysis)
    append_jsonl(
        user_id,
        "learning_events.jsonl",
        {"type": "profile_onboarding", "profile": profile, "source_text": source_text},
    )
    return ok({"version": profile["version"], "message": "onboarding profile saved"})


@router.post("/initiate")
async def initiate(current_user: dict = Depends(get_current_user)):
    session_id = f"sess_{uuid.uuid4().hex[:8]}"
    _sessions[session_id] = {"round": 1, "messages": [], "user_id": current_user["user_id"]}
    return ok(
        {
            "session_id": session_id,
            "first_question": "你好，我是小星同学。请先告诉我你的专业和当前学习目标。",
            "round": 1,
            "total_rounds": 3,
        }
    )


@router.post("/chat")
async def chat(req: ProfileChatReq, current_user: dict = Depends(get_current_user)):
    session = _sessions.get(req.session_id)
    if not session or session.get("user_id") != current_user["user_id"]:
        return fail("会话不存在或无权访问")

    async def gen():
        session["messages"].append({"role": "user", "content": req.message, "ts": now_iso()})
        round_no = session["round"]
        history_for_model = [{"role": m["role"], "content": m["content"]} for m in session["messages"][-6:]]
        assistant_parts: list[str] = []
        async for evt_type, payload in spark_lite.stream_chat_events(req.message, mode="general", history=history_for_model):
            if evt_type == "text":
                content = str(payload.get("content", ""))
                if content:
                    assistant_parts.append(content)
                yield ("text", {"content": content})
            elif evt_type == "error":
                yield ("error", payload)
        assistant_text = "".join(assistant_parts).strip()
        if assistant_text:
            session["messages"].append({"role": "assistant", "content": assistant_text, "ts": now_iso()})
        round_no += 1
        session["round"] = round_no
        if round_no > 3:
            user_id = current_user["user_id"]
            fallback_profile = _build_profile_from_dialog(session["messages"])
            profile = await extract_dialog_profile(
                session["messages"],
                fallback_profile=fallback_profile,
                stream_events=spark_lite.stream_chat_events,
            )
            profile["version"] = _next_profile_version(user_id)
            if profile.get("major") or profile.get("grade"):
                _upsert_student_identity(
                    user_id,
                    major=str(profile.get("major", "")),
                    grade=str(profile.get("grade", "")),
                )
            _sync_profile_student_identity(user_id, profile)
            _upsert_profile(user_id, profile)
            _write_profile_snapshot(user_id, profile)
            source_messages = [
                {"role": message.get("role", "user"), "content": str(message.get("content", ""))}
                for message in session["messages"]
            ]
            source_text = "\n".join(message["content"] for message in source_messages if message["role"] == "user")
            analysis = await _generate_and_store_analysis(user_id, profile, "dialog", source_text)
            _record_profile_history(user_id, profile, reason="dialog", analysis=analysis)
            append_jsonl(
                user_id,
                "learning_events.jsonl",
                {
                    "type": "profile_dialog_completed",
                    "session_id": req.session_id,
                    "profile": profile,
                    "source_messages": source_messages,
                },
            )
            yield ("done", {"round": 3, "total_rounds": 3, "profile_saved": True})
            _sessions.pop(req.session_id, None)
        else:
            yield ("done", {"round": round_no, "total_rounds": 3, "profile_saved": False})

    return StreamingResponse(sse_wrap(gen()), media_type="text/event-stream")


@router.get("")
async def get_profile(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    profile_row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    if not profile_row:
        return fail("profile not found")
    student_row = fetch_one("SELECT * FROM students WHERE user_id = ?", (user_id,))
    return ok(_row_to_profile(profile_row, student_row))


@router.get("/analysis/current")
async def get_current_profile_analysis(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    if not row:
        return fail("profile not found")
    student_row = fetch_one("SELECT * FROM students WHERE user_id = ?", (user_id,))
    current_profile = _row_to_profile(row, student_row)
    saved = read_json(user_id, PROFILE_ANALYSIS_FILE, None)
    if _is_current_profile_analysis(saved, int(current_profile["version"])):
        return ok(saved)

    fallback = build_rule_fallback_analysis(
        current_profile,
        source_type="current_profile",
        reason="尚无已保存的融合分析",
    )
    return ok(fallback)


@router.put("")
async def update_profile(req: ProfileUpdateReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    if not row:
        return fail("profile not found")
    student_patch = req.model_dump(include={"name", "email", "major", "grade"}, exclude_none=True)
    profile_patch = req.model_dump(
        exclude={"name", "email", "major", "grade"},
        exclude_none=True,
    )

    if student_patch:
        current_student = fetch_one("SELECT * FROM students WHERE user_id = ?", (user_id,))
        if current_student:
            next_student = {
                "name": current_student["name"],
                "email": current_student["email"] if "email" in current_student.keys() else "",
                "major": current_student["major"],
                "grade": current_student["grade"],
                **student_patch,
            }
            execute(
                """
                UPDATE students
                SET name = ?, email = ?, major = ?, grade = ?, updated_at = ?
                WHERE user_id = ?
                """,
                (
                    str(next_student.get("name", "")).strip(),
                    str(next_student.get("email", "")).strip(),
                    str(next_student.get("major", "")).strip(),
                    str(next_student.get("grade", "")).strip(),
                    now_iso(),
                    user_id,
                ),
            )

    updated_student = fetch_one("SELECT * FROM students WHERE user_id = ?", (user_id,))
    profile = _row_to_profile(row, updated_student)
    profile.update(profile_patch)
    profile["version"] = int(profile.get("version", 1)) + 1
    profile["updated_at"] = now_iso()
    _upsert_profile(user_id, profile)
    _write_profile_snapshot(user_id, profile)
    learning_patch = {
        key: value
        for key, value in {**student_patch, **profile_patch}.items()
        if key in PROFILE_LEARNING_FIELDS
    }
    source_text = json.dumps(learning_patch, ensure_ascii=False)
    analysis = await _generate_and_store_analysis(user_id, profile, "manual_update", source_text)
    _record_profile_history(user_id, profile, reason="manual_update", analysis=analysis)
    append_jsonl(
        user_id,
        "learning_events.jsonl",
        {"type": "profile_updated", "patch": learning_patch},
    )
    return ok({"version": profile["version"]})


@router.get("/history")
async def get_profile_history(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    student_row = fetch_one("SELECT * FROM students WHERE user_id = ?", (user_id,))
    current_profile = _row_to_profile(row, student_row) if row else {}
    if row and _profile_has_meaningful_data(current_profile):
        saved_analysis = read_json(user_id, PROFILE_ANALYSIS_FILE, {})
        _record_profile_history(
            user_id,
            current_profile,
            reason="history_view",
            analysis=(
                saved_analysis
                if _is_current_profile_analysis(saved_analysis, int(current_profile["version"]))
                else None
            ),
        )

    history = _load_profile_history(user_id)
    latest = history[0] if history else None
    next_update_at = _next_history_update_at(str(latest.get("captured_at", ""))) if latest else ""
    return ok(
        {
            "items": history,
            "update_interval_days": PROFILE_HISTORY_INTERVAL_DAYS,
            "next_update_at": next_update_at,
        }
    )


@router.post("/history/analyze")
async def analyze_profile_history(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    if not row:
        return fail("profile not found")
    student_row = fetch_one("SELECT * FROM students WHERE user_id = ?", (user_id,))
    current_profile = _row_to_profile(row, student_row)
    history = _load_profile_history(user_id)
    source_text = json.dumps(
        {"current_profile": _learning_profile_payload(current_profile), "history": history[:5]},
        ensure_ascii=False,
    )
    analysis = await _generate_and_store_analysis(
        user_id,
        current_profile,
        source_type="history_analyze",
        source_text=source_text,
    )
    _record_profile_history(user_id, current_profile, reason="history_analyze", analysis=analysis)
    return ok({**analysis, "analysis": analysis["narrative"]})


async def _generate_and_store_analysis(
    user_id: str,
    profile: dict[str, Any],
    source_type: str,
    source_text: str,
) -> dict[str, Any]:
    analysis = await generate_profile_analysis(
        profile,
        history=_load_profile_history(user_id),
        source_type=source_type,
        source_text=source_text,
        stream_events=spark_lite.stream_chat_events,
    )
    write_json(user_id, PROFILE_ANALYSIS_FILE, analysis)
    return analysis


def _is_current_profile_analysis(value: Any, profile_version: int) -> bool:
    if not isinstance(value, dict) or not PROFILE_ANALYSIS_REQUIRED_FIELDS.issubset(value):
        return False
    saved_version = value.get("profile_version")
    if isinstance(saved_version, bool) or not isinstance(saved_version, int) or saved_version != profile_version:
        return False
    if value.get("status") != "ready" or value.get("schema_version") != "profile-analysis-v1":
        return False
    if value.get("generated_by") not in {"llm", "rule_fallback", "legacy_unverified"}:
        return False
    text_fields = ("source_type", "model", "overview", "narrative", "goal_gap", "learning_strategy", "updated_at")
    if not all(isinstance(value.get(field), str) and value[field].strip() for field in text_fields):
        return False
    list_fields = ("strengths", "focus_areas", "next_actions", "evidence", "analysis_steps")
    if not all(isinstance(value.get(field), list) for field in list_fields):
        return False
    confidence = value.get("confidence")
    return (
        isinstance(confidence, (int, float))
        and not isinstance(confidence, bool)
        and math.isfinite(float(confidence))
        and 0.0 <= float(confidence) <= 1.0
    )


def _learning_profile_payload(profile: dict[str, Any]) -> dict[str, Any]:
    return {key: profile.get(key) for key in PROFILE_LEARNING_FIELDS if key in profile}


def _onboarding_source_payload(req: ProfileOnboardingReq) -> dict[str, Any]:
    return {
        "major": _clean_string_list(req.major),
        "grade": str(req.grade or "").strip(),
        "goal": _clean_string_list(req.goal),
        "level": _clean_string_list(req.level),
        "weak": _clean_string_list(req.weak),
        "preference": _clean_string_list(req.preference),
        "time": _clean_string_list(req.time),
    }


def _onboarding_has_learning_data(req: ProfileOnboardingReq) -> bool:
    source = _onboarding_source_payload(req)
    return any(value for value in source.values())


def _next_profile_version(user_id: str) -> int:
    versions: list[int] = []
    row = fetch_one("SELECT version FROM profiles WHERE user_id = ?", (user_id,))
    if row:
        try:
            versions.append(int(row["version"] or 1))
        except (TypeError, ValueError):
            pass
    try:
        snapshot = read_json(user_id, "profile_snapshot.json", None)
    except (json.JSONDecodeError, OSError, UnicodeError):
        snapshot = None
    if isinstance(snapshot, dict) and snapshot:
        try:
            versions.append(int(snapshot.get("version", 1) or 1))
        except (TypeError, ValueError):
            pass
    return max(versions) + 1 if versions else 1


def _upsert_profile(user_id: str, profile: dict[str, Any]) -> None:
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
            user_id,
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


def _upsert_student_identity(user_id: str, name: str | None = None, grade: str | None = None, major: str | None = None) -> None:
    current_student = fetch_one("SELECT * FROM students WHERE user_id = ?", (user_id,))
    if current_student:
        next_name = str(name).strip() if name is not None and str(name).strip() else current_student["name"]
        next_major = str(major).strip() if major is not None and str(major).strip() else current_student["major"]
        next_grade = str(grade).strip() if grade is not None and str(grade).strip() else current_student["grade"]
        execute(
            "UPDATE students SET name = ?, major = ?, grade = ?, updated_at = ? WHERE user_id = ?",
            (next_name, next_major, next_grade, now_iso(), user_id),
        )
        return

    execute(
        """
        INSERT INTO students(user_id, name, email, major, grade, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            str(name or "").strip(),
            "",
            str(major or "").strip(),
            str(grade or "").strip(),
            now_iso(),
            now_iso(),
        ),
    )


def _sync_profile_student_identity(user_id: str, profile: dict[str, Any]) -> None:
    student = fetch_one("SELECT major, grade FROM students WHERE user_id = ?", (user_id,))
    if not student:
        return
    profile["major"] = str(student["major"] or "").strip()
    profile["grade"] = str(student["grade"] or "").strip()


def _row_to_profile(row, student_row=None) -> dict[str, Any]:
    return {
        "user_id": row["user_id"],
        "name": student_row["name"] if student_row else "",
        "email": student_row["email"] if student_row and "email" in student_row.keys() else "",
        "major": student_row["major"] if student_row else "",
        "grade": student_row["grade"] if student_row else "",
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
        "major": _first_nonempty(req.major),
        "grade": str(req.grade or "").strip(),
        "goal": _clean_string_list(req.goal),
        "knowledge_level": _first_nonempty(req.level),
        "weak_points": _clean_string_list(req.weak),
        "learning_preference": _clean_string_list(req.preference),
        "cognitive_style": "",
        "daily_time": _parse_daily_time(_first_nonempty(req.time)) if _first_nonempty(req.time) else 0,
        "practical_ability": "",
        "current_stage": "",
        "version": 1,
        "updated_at": now_iso(),
    }


def _build_profile_from_dialog(messages: list[dict[str, Any]]) -> dict[str, Any]:
    joined = " ".join(m["content"] for m in messages if m["role"] == "user")
    return {
        "major": _extract_major(joined),
        "goal": [],
        "knowledge_level": "",
        "weak_points": [],
        "learning_preference": [],
        "cognitive_style": "",
        "daily_time": 0,
        "practical_ability": "",
        "current_stage": "",
        "version": 1,
        "updated_at": now_iso(),
    }


def _parse_daily_time(raw: str) -> int:
    return {
        "5小时以下": 30,
        "5-10小时": 60,
        "10-20小时": 120,
        "20小时以上": 180,
        "30-60分钟": 45,
        "1-2小时": 90,
        "2小时以上": 150,
    }.get(str(raw).strip(), 0)


def _first_nonempty(values: list[str]) -> str:
    for value in values or []:
        text = str(value).strip()
        if text:
            return text
    return ""


def _clean_string_list(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    for value in values or []:
        text = str(value).strip()
        if text and text not in cleaned:
            cleaned.append(text)
    return cleaned


def _extract_major(text: str) -> str:
    known_majors = ["计算机科学", "软件工程", "人工智能", "数据科学", "信息安全", "网络工程"]
    for major in known_majors:
        if major in text:
            return major
    return ""


def _load_profile_history(user_id: str) -> list[dict[str, Any]]:
    raw = read_json(user_id, PROFILE_HISTORY_FILE, [])
    if not isinstance(raw, list):
        return []
    items = [item for item in raw if isinstance(item, dict)]
    return sorted(items, key=lambda item: str(item.get("captured_at", "")), reverse=True)


def _profile_has_meaningful_data(profile: dict[str, Any]) -> bool:
    if not profile:
        return False
    for key in ("goal", "weak_points", "learning_preference"):
        value = profile.get(key)
        if isinstance(value, list) and any(str(item).strip() for item in value):
            return True
    return any(str(profile.get(key, "")).strip() for key in ("major", "grade", "knowledge_level", "cognitive_style", "practical_ability", "current_stage"))


def _record_profile_history(
    user_id: str,
    profile: dict[str, Any],
    reason: str,
    analysis: dict[str, Any] | None = None,
) -> None:
    if not profile:
        return

    now = now_iso()
    snapshot = _profile_history_snapshot(profile, now, reason, analysis)

    def merge_history(raw: Any) -> list[dict[str, Any]]:
        history = [item for item in raw if isinstance(item, dict)] if isinstance(raw, list) else []
        history.sort(key=lambda item: str(item.get("captured_at", "")), reverse=True)
        latest = history[0] if history else None
        if latest and not _should_create_history_snapshot(str(latest.get("captured_at", "")), now):
            history[0] = {
                **latest,
                **snapshot,
                "id": latest.get("id") or snapshot["id"],
                "captured_at": latest.get("captured_at") or snapshot["captured_at"],
                "updated_at": now,
            }
        else:
            history.insert(0, snapshot)
        return history[:12]

    update_json(user_id, PROFILE_HISTORY_FILE, [], merge_history)


def _profile_history_snapshot(
    profile: dict[str, Any],
    captured_at: str,
    reason: str,
    analysis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    goals = profile.get("goal", [])
    weak_points = profile.get("weak_points", [])
    preferences = profile.get("learning_preference", [])
    stage = str(profile.get("current_stage", "")).strip()
    return {
        "id": f"profile-{captured_at.replace(':', '').replace('-', '').replace('.', '')}",
        "captured_at": captured_at,
        "reason": reason,
        "version": int(profile.get("version", 1) or 1),
        "major": str(profile.get("major", "")).strip(),
        "grade": str(profile.get("grade", "")).strip(),
        "goals": goals if isinstance(goals, list) else [],
        "knowledge_level": str(profile.get("knowledge_level", "")).strip(),
        "weak_points": weak_points if isinstance(weak_points, list) else [],
        "learning_preference": preferences if isinstance(preferences, list) else [],
        "cognitive_style": str(profile.get("cognitive_style", "")).strip(),
        "daily_time": int(profile.get("daily_time", 0) or 0),
        "practical_ability": str(profile.get("practical_ability", "")).strip(),
        "current_stage": stage,
        "summary": _profile_snapshot_summary(profile),
        "narrative": str((analysis or {}).get("narrative") or _profile_snapshot_summary(profile)).strip(),
        "analysis_source": str((analysis or {}).get("generated_by") or "legacy_unverified"),
        "confidence": float((analysis or {}).get("confidence") or 0.0),
    }


def _profile_snapshot_summary(profile: dict[str, Any]) -> str:
    weak = "、".join(str(item) for item in profile.get("weak_points", [])[:2]) or "待提升点尚未采集"
    goal = "、".join(str(item) for item in profile.get("goal", [])[:2]) or "学习目标尚未采集"
    stage = str(profile.get("current_stage", "")).strip() or "当前阶段尚未采集"
    return f"目标：{goal}；阶段：{stage}；关注：{weak}"


def _should_create_history_snapshot(latest_at: str, current_at: str) -> bool:
    latest = _parse_iso(latest_at)
    current = _parse_iso(current_at)
    if not latest or not current:
        return True
    return current - latest >= timedelta(days=PROFILE_HISTORY_INTERVAL_DAYS)


def _next_history_update_at(latest_at: str) -> str:
    latest = _parse_iso(latest_at)
    if not latest:
        return ""
    return (latest + timedelta(days=PROFILE_HISTORY_INTERVAL_DAYS)).isoformat() + "Z"


def _parse_iso(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def _write_profile_snapshot(user_id: str, profile: dict[str, Any]) -> None:
    write_json(user_id, "profile_snapshot.json", profile)
