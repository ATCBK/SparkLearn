import json
import math
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..auth import get_current_user
from ..config import settings
from ..db import execute, fetch_one, now_iso
from ..llm import spark_lite
from ..profile_ai import build_rule_fallback_analysis, extract_dialog_profile, generate_profile_analysis
from ..profile_reset import profile_sessions, reset_learning_profile
from ..schemas import fail, ok
from ..storage import append_jsonl, read_json, update_json, write_json
from .common import sse_wrap


router = APIRouter(prefix="/api/profile", tags=["profile"])

_sessions = profile_sessions
PROFILE_HISTORY_FILE = "profile_history.json"
PROFILE_ANALYSIS_FILE = "profile_ai_analysis.json"
PROFILE_DIALOG_HISTORY_FILE = "profile_dialog_history.json"
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
    _record_profile_dialog_history(
        user_id,
        session_id=f"onboarding_{uuid.uuid4().hex[:8]}",
        source_type="onboarding",
        messages=_build_onboarding_dialog_messages(req),
        profile_version=int(profile["version"]),
        title=f"{str(req.name or '').strip() or '同学'}的问卷建档",
    )
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
            _record_profile_dialog_history(
                user_id,
                session_id=req.session_id,
                source_type="dialog",
                messages=session["messages"],
                profile_version=int(profile["version"]),
                title=_profile_dialog_title(source_messages, "对话建档"),
            )
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
async def get_profile(response: Response, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    profile_row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    if not profile_row:
        response.status_code = 404
        return fail("profile not found")
    student_row = fetch_one("SELECT * FROM students WHERE user_id = ?", (user_id,))
    profile = _row_to_profile(profile_row, student_row)
    if not _profile_has_meaningful_data(profile):
        response.status_code = 404
        return fail("profile not found")
    return ok(profile)


@router.delete("")
async def delete_profile(response: Response, current_user: dict = Depends(get_current_user)):
    try:
        return ok(reset_learning_profile(current_user["user_id"]))
    except Exception:
        response.status_code = 500
        return fail("学习画像重置失败，请稍后重试")


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


@router.get("/dialog-history")
async def get_profile_dialog_history(current_user: dict = Depends(get_current_user)):
    return ok({"items": _load_profile_dialog_history(current_user["user_id"])})


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


def _load_profile_dialog_history(user_id: str) -> list[dict[str, Any]]:
    raw = read_json(user_id, PROFILE_DIALOG_HISTORY_FILE, [])
    items = [_normalize_profile_dialog_history_item(item) for item in raw if isinstance(item, dict)] if isinstance(raw, list) else []
    if not items:
        items = _load_legacy_profile_dialog_history(user_id)
    return sorted(items, key=lambda item: str(item.get("completed_at") or item.get("created_at") or ""), reverse=True)


def _load_legacy_profile_dialog_history(user_id: str) -> list[dict[str, Any]]:
    path = settings.data_dir / "users" / user_id / "learning_events.jsonl"
    if not path.exists():
        return []
    items: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except (OSError, UnicodeError):
        return []
    for idx, line in enumerate(lines):
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        item = _legacy_profile_event_to_dialog_history(event, idx)
        if item:
            items.append(item)
    items.sort(key=lambda item: str(item.get("completed_at") or item.get("created_at") or ""), reverse=True)
    return items[:12]


def _legacy_profile_event_to_dialog_history(event: dict[str, Any], idx: int) -> dict[str, Any] | None:
    event_type = str(event.get("type") or "")
    if event_type not in {"profile_onboarding", "profile_dialog_completed"}:
        return None
    timestamp = str(event.get("ts") or event.get("created_at") or "")
    profile = event.get("profile") if isinstance(event.get("profile"), dict) else {}
    source_type = "dialog" if event_type == "profile_dialog_completed" else "onboarding"
    messages = _normalize_profile_dialog_messages(event.get("source_messages") if isinstance(event.get("source_messages"), list) else [])
    if not messages and source_type == "onboarding":
        source_payload = _parse_legacy_onboarding_source_text(event.get("source_text"))
        messages = _build_onboarding_messages_from_payload(source_payload or _profile_to_onboarding_source_payload(profile), timestamp)
    if not messages:
        messages = _build_profile_summary_messages(profile, timestamp)
    if not messages:
        return None
    return {
        "id": f"legacy-{source_type}-{timestamp.replace(':', '').replace('-', '').replace('.', '') or idx}",
        "session_id": str(event.get("session_id") or f"legacy_{idx}"),
        "source_type": source_type,
        "title": "历史对话建档" if source_type == "dialog" else "历史问卷建档",
        "created_at": timestamp,
        "completed_at": timestamp,
        "profile_version": int(profile.get("version") or event.get("profile_version") or 1),
        "message_count": len(messages),
        "messages": messages,
    }


def _parse_legacy_onboarding_source_text(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _profile_to_onboarding_source_payload(profile: dict[str, Any]) -> dict[str, Any]:
    return {
        "major": [str(profile.get("major") or "").strip()] if str(profile.get("major") or "").strip() else [],
        "grade": str(profile.get("grade") or "").strip(),
        "goal": profile.get("goal") if isinstance(profile.get("goal"), list) else [],
        "level": [str(profile.get("knowledge_level") or "").strip()] if str(profile.get("knowledge_level") or "").strip() else [],
        "weak": profile.get("weak_points") if isinstance(profile.get("weak_points"), list) else [],
        "preference": profile.get("learning_preference") if isinstance(profile.get("learning_preference"), list) else [],
        "time": [f"{int(profile.get('daily_time') or 0)} 分钟/天"] if int(profile.get("daily_time") or 0) > 0 else [],
    }


def _build_onboarding_messages_from_payload(payload: dict[str, Any], timestamp: str) -> list[dict[str, str]]:
    step_values: list[tuple[str, str]] = [
        ("你现在是大几？", _payload_text(payload.get("grade"))),
        ("你想学习哪个学科？", _payload_text(payload.get("major"))),
        ("你希望达成什么样的学习目标？", _payload_text(payload.get("goal"))),
        ("你目前的基础水平是？", _payload_text(payload.get("level"))),
        ("哪些方面需要重点加强？", _payload_text(payload.get("weak"))),
        ("你更喜欢哪种学习方式？", _payload_text(payload.get("preference"))),
        ("你每天大概能投入多少时间学习？", _payload_text(payload.get("time"))),
    ]
    messages: list[dict[str, str]] = []
    for question, answer in step_values:
        if not answer:
            continue
        messages.append({"role": "assistant", "content": question, "ts": timestamp})
        messages.append({"role": "user", "content": answer, "ts": timestamp})
    return messages


def _build_profile_summary_messages(profile: dict[str, Any], timestamp: str) -> list[dict[str, str]]:
    parts = []
    if profile.get("major"):
        parts.append(f"学科方向：{profile['major']}")
    if profile.get("grade"):
        parts.append(f"当前年级：{profile['grade']}")
    if isinstance(profile.get("goal"), list) and profile["goal"]:
        parts.append(f"学习目标：{'、'.join(str(item) for item in profile['goal'])}")
    if profile.get("knowledge_level"):
        parts.append(f"学习基础：{profile['knowledge_level']}")
    if isinstance(profile.get("weak_points"), list) and profile["weak_points"]:
        parts.append(f"薄弱环节：{'、'.join(str(item) for item in profile['weak_points'])}")
    if isinstance(profile.get("learning_preference"), list) and profile["learning_preference"]:
        parts.append(f"学习偏好：{'、'.join(str(item) for item in profile['learning_preference'])}")
    if not parts:
        return []
    return [
        {"role": "assistant", "content": "已从历史画像记录恢复采集完成状态。", "ts": timestamp},
        {"role": "user", "content": "；".join(parts), "ts": timestamp},
    ]


def _payload_text(value: Any) -> str:
    if isinstance(value, list):
        return "、".join(str(item).strip() for item in value if str(item).strip())
    return str(value or "").strip()


def _record_profile_dialog_history(
    user_id: str,
    session_id: str,
    source_type: str,
    messages: list[dict[str, Any]],
    profile_version: int,
    title: str,
) -> None:
    completed_at = now_iso()
    normalized_messages = _normalize_profile_dialog_messages(messages)
    if not normalized_messages:
        return
    created_at = str(normalized_messages[0].get("ts") or completed_at)
    item = {
        "id": f"{source_type}-{completed_at.replace(':', '').replace('-', '').replace('.', '')}",
        "session_id": session_id,
        "source_type": source_type,
        "title": title,
        "created_at": created_at,
        "completed_at": completed_at,
        "profile_version": int(profile_version or 1),
        "message_count": len(normalized_messages),
        "messages": normalized_messages,
    }

    def merge_history(raw: Any) -> list[dict[str, Any]]:
        history = [_normalize_profile_dialog_history_item(existing) for existing in raw if isinstance(existing, dict)] if isinstance(raw, list) else []
        history = [existing for existing in history if existing.get("session_id") != session_id]
        history.insert(0, item)
        history.sort(key=lambda existing: str(existing.get("completed_at") or existing.get("created_at") or ""), reverse=True)
        return history[:12]

    update_json(user_id, PROFILE_DIALOG_HISTORY_FILE, [], merge_history)


def _normalize_profile_dialog_history_item(item: dict[str, Any]) -> dict[str, Any]:
    messages = _normalize_profile_dialog_messages(item.get("messages") if isinstance(item.get("messages"), list) else [])
    completed_at = str(item.get("completed_at") or item.get("created_at") or "")
    created_at = str(item.get("created_at") or completed_at)
    source_type = str(item.get("source_type") or "dialog")
    return {
        "id": str(item.get("id") or f"{source_type}-{completed_at}"),
        "session_id": str(item.get("session_id") or ""),
        "source_type": source_type,
        "title": str(item.get("title") or ("问卷建档" if source_type == "onboarding" else "对话建档")),
        "created_at": created_at,
        "completed_at": completed_at,
        "profile_version": int(item.get("profile_version") or item.get("version") or 1),
        "message_count": int(item.get("message_count") or len(messages)),
        "messages": messages,
    }


def _normalize_profile_dialog_messages(messages: list[dict[str, Any]]) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role") or "user").strip()
        if role not in {"assistant", "user"}:
            role = "user"
        content = str(message.get("content") or "").strip()
        if not content:
            continue
        normalized.append({"role": role, "content": content, "ts": str(message.get("ts") or "")})
    return normalized


def _build_onboarding_dialog_messages(req: ProfileOnboardingReq) -> list[dict[str, str]]:
    step_values: list[tuple[str, str]] = [
        ("怎么称呼你？", str(req.name or "").strip()),
        ("你现在是大几？", str(req.grade or "").strip()),
        ("你想学习哪个学科？", "、".join(_clean_string_list(req.major))),
        ("你希望达成什么样的学习目标？", "、".join(_clean_string_list(req.goal))),
        ("你目前的基础水平是？", "、".join(_clean_string_list(req.level))),
        ("哪些方面需要重点加强？", "、".join(_clean_string_list(req.weak))),
        ("你更喜欢哪种学习方式？", "、".join(_clean_string_list(req.preference))),
        ("你每天大概能投入多少时间学习？", "、".join(_clean_string_list(req.time))),
    ]
    timestamp = now_iso()
    messages: list[dict[str, str]] = []
    for question, answer in step_values:
        if not answer:
            continue
        messages.append({"role": "assistant", "content": question, "ts": timestamp})
        messages.append({"role": "user", "content": answer, "ts": timestamp})
    return messages


def _profile_dialog_title(messages: list[dict[str, str]], fallback: str) -> str:
    first_user_message = next((message["content"] for message in messages if message.get("role") == "user" and message.get("content")), "")
    if not first_user_message:
        return fallback
    suffix = "..." if len(first_user_message) > 18 else ""
    return f"{first_user_message[:18]}{suffix}"


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
