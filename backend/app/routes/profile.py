import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..db import execute, fetch_one, now_iso
from ..llm import spark_lite
from ..schemas import fail, ok
from ..storage import append_jsonl, read_json, write_json
from .common import sse_wrap


router = APIRouter(prefix="/api/profile", tags=["profile"])

_sessions: dict[str, dict[str, Any]] = {}
PROFILE_HISTORY_FILE = "profile_history.json"
PROFILE_ANALYSIS_FILE = "profile_ai_analysis.json"
PROFILE_HISTORY_INTERVAL_DAYS = 3


class ProfileChatReq(BaseModel):
    session_id: str
    message: str


class ProfileOnboardingReq(BaseModel):
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
async def onboarding(req: ProfileOnboardingReq):
    profile = _build_profile_from_onboarding(req)
    major = _first_nonempty(req.major)
    if major:
        _upsert_student_major(major)
        profile["major"] = major
    _upsert_profile(profile)
    _write_profile_snapshot(profile)
    _record_profile_history(profile, reason="onboarding")
    append_jsonl(settings.single_user_id, "learning_events.jsonl", {"type": "profile_onboarding", "profile": profile})
    return ok({"version": profile["version"], "message": "onboarding profile saved"})


@router.post("/initiate")
async def initiate():
    session_id = f"sess_{uuid.uuid4().hex[:8]}"
    _sessions[session_id] = {"round": 1, "messages": []}
    return ok(
        {
            "session_id": session_id,
            "first_question": "你好，我是小星同学。请先告诉我你的专业和当前学习目标。",
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
            if profile.get("major"):
                _upsert_student_major(str(profile["major"]))
            _upsert_profile(profile)
            _write_profile_snapshot(profile)
            _record_profile_history(profile, reason="dialog")
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
    profile_row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (settings.single_user_id,))
    if not profile_row:
        return fail("profile not found")
    student_row = fetch_one("SELECT * FROM students WHERE user_id = ?", (settings.single_user_id,))
    return ok(_row_to_profile(profile_row, student_row))


@router.put("")
async def update_profile(req: ProfileUpdateReq):
    row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (settings.single_user_id,))
    if not row:
        return fail("profile not found")
    student_patch = req.model_dump(include={"name", "email", "major", "grade"}, exclude_none=True)
    profile_patch = req.model_dump(
        exclude={"name", "email", "major", "grade"},
        exclude_none=True,
    )

    if student_patch:
        current_student = fetch_one("SELECT * FROM students WHERE user_id = ?", (settings.single_user_id,))
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
                    settings.single_user_id,
                ),
            )

    updated_student = fetch_one("SELECT * FROM students WHERE user_id = ?", (settings.single_user_id,))
    profile = _row_to_profile(row, updated_student)
    profile.update(profile_patch)
    profile["version"] = int(profile.get("version", 1)) + 1
    profile["updated_at"] = now_iso()
    _upsert_profile(profile)
    _write_profile_snapshot(profile)
    _record_profile_history(profile, reason="manual_update")
    append_jsonl(
        settings.single_user_id,
        "learning_events.jsonl",
        {"type": "profile_updated", "patch": {**student_patch, **profile_patch}},
    )
    return ok({"version": profile["version"]})


@router.get("/history")
async def get_profile_history():
    row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (settings.single_user_id,))
    student_row = fetch_one("SELECT * FROM students WHERE user_id = ?", (settings.single_user_id,))
    current_profile = _row_to_profile(row, student_row) if row else {}
    if row:
        _record_profile_history(current_profile, reason="history_view")

    history = _with_mock_profile_history(_load_profile_history(), current_profile)
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
async def analyze_profile_history():
    row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (settings.single_user_id,))
    student_row = fetch_one("SELECT * FROM students WHERE user_id = ?", (settings.single_user_id,))
    current_profile = _row_to_profile(row, student_row) if row else {}
    history = _with_mock_profile_history(_load_profile_history(), current_profile)
    steps = _build_profile_analysis_steps(current_profile, history)
    prompt = _build_profile_analysis_prompt(current_profile, history)
    analysis = await _collect_profile_analysis(prompt)
    payload = {"analysis": analysis, "analysis_steps": steps, "updated_at": now_iso()}
    write_json(settings.single_user_id, PROFILE_ANALYSIS_FILE, payload)
    return ok(payload)


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


def _upsert_student_major(major: str) -> None:
    current_student = fetch_one("SELECT * FROM students WHERE user_id = ?", (settings.single_user_id,))
    if current_student:
        execute(
            "UPDATE students SET major = ?, updated_at = ? WHERE user_id = ?",
            (major.strip(), now_iso(), settings.single_user_id),
        )
        return

    execute(
        """
        INSERT INTO students(user_id, name, email, major, grade, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (settings.single_user_id, "", "", major.strip(), "", now_iso(), now_iso()),
    )


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
        "major": _extract_major(joined),
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


def _first_nonempty(values: list[str]) -> str:
    for value in values or []:
        text = str(value).strip()
        if text:
            return text
    return ""


def _extract_major(text: str) -> str:
    known_majors = ["计算机科学", "软件工程", "人工智能", "数据科学", "信息安全", "网络工程"]
    for major in known_majors:
        if major in text:
            return major
    return ""


def _load_profile_history() -> list[dict[str, Any]]:
    raw = read_json(settings.single_user_id, PROFILE_HISTORY_FILE, [])
    if not isinstance(raw, list):
        return []
    items = [item for item in raw if isinstance(item, dict)]
    return sorted(items, key=lambda item: str(item.get("captured_at", "")), reverse=True)


def _with_mock_profile_history(history: list[dict[str, Any]], current_profile: dict[str, Any]) -> list[dict[str, Any]]:
    items = list(history)
    if len(items) >= 4:
        return items

    base_time = _parse_iso(str(items[0].get("captured_at", ""))) if items else datetime.now(UTC).replace(tzinfo=None)
    mock_profiles = _mock_profile_profiles(current_profile)
    used_ids = {str(item.get("id", "")) for item in items}

    for idx, mock_profile in enumerate(mock_profiles, start=1):
        if len(items) >= 4:
            break
        captured_at = (base_time - timedelta(days=PROFILE_HISTORY_INTERVAL_DAYS * idx)).isoformat() + "Z"
        snapshot = _profile_history_snapshot(mock_profile, captured_at, reason="mock_history")
        snapshot["id"] = f"mock-profile-{idx}"
        if snapshot["id"] not in used_ids:
            items.append(snapshot)
            used_ids.add(snapshot["id"])

    return sorted(items, key=lambda item: str(item.get("captured_at", "")), reverse=True)


def _mock_profile_profiles(current_profile: dict[str, Any]) -> list[dict[str, Any]]:
    major = str(current_profile.get("major", "")).strip() or "计算机科学"
    grade = str(current_profile.get("grade", "")).strip() or "大二"
    return [
        {
            "major": major,
            "grade": grade,
            "goal": ["完成 Python 小项目", "巩固函数与模块"],
            "knowledge_level": "有一些基础",
            "weak_points": ["函数返回值", "作用域"],
            "learning_preference": ["代码案例", "短练习"],
            "cognitive_style": "归纳型",
            "daily_time": 60,
            "practical_ability": "可以完成小功能，需要加强拆解能力",
            "current_stage": "函数与模块补弱",
            "version": 3,
        },
        {
            "major": major,
            "grade": grade,
            "goal": ["掌握基础语法", "提升做题稳定性"],
            "knowledge_level": "入门阶段",
            "weak_points": ["循环嵌套", "条件判断"],
            "learning_preference": ["视频讲解", "示例驱动"],
            "cognitive_style": "视觉型",
            "daily_time": 45,
            "practical_ability": "能跟写示例，独立迁移还不稳定",
            "current_stage": "基础语法巩固",
            "version": 2,
        },
        {
            "major": major,
            "grade": grade,
            "goal": ["建立编程学习节奏"],
            "knowledge_level": "零基础",
            "weak_points": ["变量类型", "表达式理解"],
            "learning_preference": ["图解", "低难度练习"],
            "cognitive_style": "演示型",
            "daily_time": 30,
            "practical_ability": "需要跟随步骤完成练习",
            "current_stage": "入门建档",
            "version": 1,
        },
    ]


def _record_profile_history(profile: dict[str, Any], reason: str) -> None:
    if not profile:
        return

    history = _load_profile_history()
    now = now_iso()
    latest = history[0] if history else None
    snapshot = _profile_history_snapshot(profile, now, reason)

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

    write_json(settings.single_user_id, PROFILE_HISTORY_FILE, history[:12])


def _profile_history_snapshot(profile: dict[str, Any], captured_at: str, reason: str) -> dict[str, Any]:
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
        "daily_time": int(profile.get("daily_time", 60) or 60),
        "practical_ability": str(profile.get("practical_ability", "")).strip(),
        "current_stage": stage,
        "summary": _profile_snapshot_summary(profile),
    }


def _profile_snapshot_summary(profile: dict[str, Any]) -> str:
    weak = "、".join(str(item) for item in profile.get("weak_points", [])[:2]) or "暂无明显薄弱点"
    goal = "、".join(str(item) for item in profile.get("goal", [])[:2]) or "提升学习能力"
    stage = str(profile.get("current_stage", "")).strip() or "当前阶段未标记"
    return f"目标：{goal}；阶段：{stage}；关注：{weak}"


def _build_profile_analysis_steps(current_profile: dict[str, Any], history: list[dict[str, Any]]) -> list[dict[str, str]]:
    latest = history[0] if history else {}
    previous = history[1] if len(history) > 1 else {}
    latest_weak = latest.get("weak_points", []) if isinstance(latest.get("weak_points", []), list) else []
    previous_weak = previous.get("weak_points", []) if isinstance(previous.get("weak_points", []), list) else []
    new_weak = [str(item) for item in latest_weak if item not in previous_weak]
    resolved = [str(item) for item in previous_weak if item not in latest_weak]
    trend = _profile_trend_text(history)
    risk = "、".join(str(item) for item in latest_weak[:2]) or "暂无明显薄弱点"
    preference = "、".join(str(item) for item in latest.get("learning_preference", [])[:2]) or "常规讲解与练习"

    return [
        {
            "title": "读取当前画像",
            "detail": f"专业方向：{current_profile.get('major') or latest.get('major') or '未知'}；当前阶段：{current_profile.get('current_stage') or latest.get('current_stage') or '未标记'}。",
            "status": "done",
        },
        {
            "title": "载入历史快照",
            "detail": f"已载入 {len(history)} 条画像记录，按 {PROFILE_HISTORY_INTERVAL_DAYS} 天更新窗口进行对比。",
            "status": "done",
        },
        {
            "title": "对比变化",
            "detail": f"{trend} 新增关注点：{'、'.join(new_weak) or '无'}；已缓解关注点：{'、'.join(resolved) or '无'}。",
            "status": "done",
        },
        {
            "title": "识别学习风险",
            "detail": f"当前优先风险集中在 {risk}，需要避免直接进入综合项目导致基础概念再次混淆。",
            "status": "done",
        },
        {
            "title": "生成资源与路径建议",
            "detail": f"建议采用“{preference}”资源组合，先补弱再推进路径节点。",
            "status": "done",
        },
    ]


def _profile_trend_text(history: list[dict[str, Any]]) -> str:
    if len(history) < 2:
        return "历史样本较少，暂以当前画像作为判断依据。"
    latest_stage = str(history[0].get("current_stage", "")).strip() or "未标记阶段"
    earliest_stage = str(history[-1].get("current_stage", "")).strip() or "未标记阶段"
    return f"画像阶段从“{earliest_stage}”推进到“{latest_stage}”。"


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


def _build_profile_analysis_prompt(current_profile: dict[str, Any], history: list[dict[str, Any]]) -> str:
    compact_history = history[:5]
    return (
        "你是 SparkLearn 的学习画像分析师。请基于当前用户画像和历史画像变化，输出一段简洁、可执行的分析。\n"
        "要求：1) 说明画像变化趋势；2) 指出当前最重要的学习风险；3) 给出下一阶段资源和路径建议；"
        "4) 150字以内；5) 不要编造不存在的数据。\n\n"
        f"当前画像: {json.dumps(current_profile, ensure_ascii=False)}\n"
        f"历史画像: {json.dumps(compact_history, ensure_ascii=False)}"
    )


async def _collect_profile_analysis(prompt: str) -> str:
    parts: list[str] = []
    try:
        async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode="general", history=[]):
            if evt_type == "text":
                chunk = str(payload.get("content", ""))
                if chunk:
                    parts.append(chunk)
    except Exception:
        parts = []

    text = "".join(parts).strip()
    if text:
        return text
    return "AI 暂未生成新的画像分析。建议先查看最近一次画像：结合学习目标、薄弱点和当前阶段，优先完成一组短练习并更新错题记录。"


def _write_profile_snapshot(profile: dict[str, Any]) -> None:
    write_json(settings.single_user_id, "profile_snapshot.json", profile)
