from __future__ import annotations

import json
import threading
from datetime import UTC, datetime, timedelta
from typing import Any

from .db import fetch_one, get_conn, now_iso
from .storage import append_jsonl, read_json, update_json, write_json


PROFILE_RESET_ARCHIVE_FILE = "profile_reset_archive.json"
PROFILE_RESET_CONFIRMATION_FILE = "profile_reset_confirmation.json"
PROFILE_RESET_CONFIRMATION_MINUTES = 10
PROFILE_RESET_ARCHIVE_LIMIT = 5
PROFILE_SEMANTIC_FIELDS = (
    "goals",
    "preferences",
    "constraints",
    "skills",
    "weak_points",
)

profile_sessions: dict[str, dict[str, Any]] = {}
_reset_locks_guard = threading.Lock()
_reset_locks: dict[str, threading.RLock] = {}

CONFIRMATION_NONE = "none"
CONFIRMATION_ACTIVE = "active"
CONFIRMATION_EXPIRED = "expired"
CONFIRMATION_CLAIMED = "claimed"


def _user_reset_lock(user_id: str) -> threading.RLock:
    with _reset_locks_guard:
        lock = _reset_locks.get(user_id)
        if lock is None:
            lock = threading.RLock()
            _reset_locks[user_id] = lock
        return lock


def _safe_read_json(user_id: str, filename: str, default: Any) -> Any:
    try:
        return read_json(user_id, filename, default)
    except (json.JSONDecodeError, UnicodeError):
        return dict(default) if isinstance(default, dict) else list(default) if isinstance(default, list) else default


def _safe_update_json(user_id: str, filename: str, default: Any, mutator) -> Any:
    try:
        return update_json(user_id, filename, default, mutator)
    except (json.JSONDecodeError, UnicodeError):
        repaired = dict(default) if isinstance(default, dict) else list(default) if isinstance(default, list) else default
        write_json(user_id, filename, repaired)
        return update_json(user_id, filename, default, mutator)


def _parse_iso(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _iso_after(minutes: int) -> str:
    value = datetime.now(UTC) + timedelta(minutes=minutes)
    return value.replace(tzinfo=None).isoformat() + "Z"


def _current_profile(user_id: str) -> dict[str, Any]:
    row = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    if not row:
        return {}
    student = fetch_one("SELECT major, grade FROM students WHERE user_id = ?", (user_id,))
    profile = dict(row)
    for field in ("goal", "weak_points", "learning_preference"):
        try:
            value = json.loads(profile.get(field) or "[]")
        except (json.JSONDecodeError, TypeError):
            value = []
        profile[field] = value if isinstance(value, list) else []
    profile["major"] = str(student["major"] or "").strip() if student else ""
    profile["grade"] = str(student["grade"] or "").strip() if student else ""
    return profile


def _archive_current_profile(
    user_id: str,
    reset_at: str,
    profile: dict[str, Any],
    analysis: Any,
    history: Any,
) -> None:
    if not profile and not analysis and not history:
        return
    entry = {
        "reset_at": reset_at,
        "profile": profile,
        "analysis": analysis if isinstance(analysis, dict) else {},
        "history": history if isinstance(history, list) else [],
    }

    def append_archive(raw: Any) -> list[dict[str, Any]]:
        items = [item for item in raw if isinstance(item, dict)] if isinstance(raw, list) else []
        items.append(entry)
        return items[-PROFILE_RESET_ARCHIVE_LIMIT:]

    _safe_update_json(user_id, PROFILE_RESET_ARCHIVE_FILE, [], append_archive)


def _default_memory(reset_at: str) -> dict[str, Any]:
    return {
        "version": 1,
        "updated_at": reset_at,
        "working": [],
        "episodic": [],
        "semantic": {
            "goals": [],
            "preferences": [],
            "constraints": [],
            "facts": [],
            "skills": [],
            "weak_points": [],
            "learning_stage": "",
        },
        "perceptual": [],
    }


def _clear_profile_memory(user_id: str, reset_at: str) -> None:
    def clear_semantic(raw: Any) -> dict[str, Any]:
        base = _default_memory(reset_at)
        memory = dict(raw) if isinstance(raw, dict) else {}
        existing_semantic = memory.get("semantic")
        semantic = dict(existing_semantic) if isinstance(existing_semantic, dict) else {}
        try:
            version = int(memory.get("version", 1) or 1)
        except (TypeError, ValueError):
            version = 1
        return {
            "version": version,
            "updated_at": reset_at,
            "working": memory.get("working") if isinstance(memory.get("working"), list) else base["working"],
            "episodic": memory.get("episodic") if isinstance(memory.get("episodic"), list) else base["episodic"],
            "semantic": {
                **{field: [] for field in PROFILE_SEMANTIC_FIELDS},
                "facts": semantic.get("facts") if isinstance(semantic.get("facts"), list) else [],
                "learning_stage": "",
            },
            "perceptual": memory.get("perceptual") if isinstance(memory.get("perceptual"), list) else base["perceptual"],
        }

    _safe_update_json(user_id, "memory_store.json", _default_memory(reset_at), clear_semantic)


def _clear_profile_sessions(user_id: str) -> None:
    for session_id, session in list(profile_sessions.items()):
        if session.get("user_id") == user_id:
            profile_sessions.pop(session_id, None)


def _reset_learning_profile_locked(user_id: str) -> dict[str, Any]:
    reset_at = now_iso()
    profile = _current_profile(user_id)
    file_defaults = {
        "profile_snapshot.json": {},
        "profile_ai_analysis.json": {},
        "profile_history.json": [],
        PROFILE_RESET_ARCHIVE_FILE: [],
        "memory_store.json": _default_memory(reset_at),
        PROFILE_RESET_CONFIRMATION_FILE: {},
    }
    previous_files = {
        filename: _safe_read_json(user_id, filename, default)
        for filename, default in file_defaults.items()
    }
    analysis = previous_files["profile_ai_analysis.json"]
    history = previous_files["profile_history.json"]

    try:
        with get_conn() as conn:
            conn.execute("DELETE FROM profiles WHERE user_id = ?", (user_id,))
            conn.execute(
                "UPDATE students SET major = '', grade = '', updated_at = ? WHERE user_id = ?",
                (reset_at, user_id),
            )
            _archive_current_profile(user_id, reset_at, profile, analysis, history)
            write_json(user_id, "profile_snapshot.json", {})
            write_json(user_id, "profile_ai_analysis.json", {})
            write_json(user_id, "profile_history.json", [])
            _clear_profile_memory(user_id, reset_at)
            _safe_update_json(user_id, PROFILE_RESET_CONFIRMATION_FILE, {}, lambda _: {})
    except Exception:
        for filename, payload in previous_files.items():
            try:
                write_json(user_id, filename, payload)
            except Exception:
                continue
        raise

    _clear_profile_sessions(user_id)
    audit_logged = True
    try:
        append_jsonl(user_id, "learning_events.jsonl", {"type": "profile_reset", "reset_at": reset_at})
    except Exception:
        audit_logged = False
    return {
        "reset": True,
        "redirect": "/onboarding",
        "reset_at": reset_at,
        "audit_logged": audit_logged,
    }


def reset_learning_profile(user_id: str) -> dict[str, Any]:
    with _user_reset_lock(user_id):
        return _reset_learning_profile_locked(user_id)


def request_reset_confirmation(user_id: str) -> dict[str, Any]:
    with _user_reset_lock(user_id):
        current_time = datetime.now(UTC)
        confirmation = {
            "requested_at": now_iso(),
            "expires_at": _iso_after(PROFILE_RESET_CONFIRMATION_MINUTES),
        }

        def request(raw: Any) -> dict[str, Any]:
            if _confirmation_state(raw, current_time) == CONFIRMATION_CLAIMED:
                return raw
            return confirmation

        return _safe_update_json(user_id, PROFILE_RESET_CONFIRMATION_FILE, {}, request)


def _confirmation_state(raw: Any, current_time: datetime) -> str:
    if not isinstance(raw, dict) or not raw.get("requested_at"):
        return CONFIRMATION_NONE
    expires_at = _parse_iso(raw.get("expires_at"))
    if expires_at is None or expires_at <= current_time:
        return CONFIRMATION_EXPIRED
    if raw.get("claimed_at"):
        return CONFIRMATION_CLAIMED
    return CONFIRMATION_ACTIVE


def consume_pending_reset(user_id: str) -> str:
    state = CONFIRMATION_NONE

    with _user_reset_lock(user_id):
        current_time = datetime.now(UTC)

        def consume(raw: Any) -> dict[str, Any]:
            nonlocal state
            state = _confirmation_state(raw, current_time)
            return raw if state == CONFIRMATION_CLAIMED and isinstance(raw, dict) else {}

        _safe_update_json(user_id, PROFILE_RESET_CONFIRMATION_FILE, {}, consume)
    return state


def claim_pending_reset(user_id: str) -> str:
    state = CONFIRMATION_NONE

    with _user_reset_lock(user_id):
        current_time = datetime.now(UTC)

        def claim(raw: Any) -> dict[str, Any]:
            nonlocal state
            state = _confirmation_state(raw, current_time)
            if state == CONFIRMATION_ACTIVE:
                return {**raw, "claimed_at": now_iso()}
            if state == CONFIRMATION_EXPIRED:
                return {}
            return raw if isinstance(raw, dict) else {}

        _safe_update_json(user_id, PROFILE_RESET_CONFIRMATION_FILE, {}, claim)
    return state


def restore_pending_reset(user_id: str) -> None:
    with _user_reset_lock(user_id):
        current_time = datetime.now(UTC)

        def restore(raw: Any) -> dict[str, Any]:
            state = _confirmation_state(raw, current_time)
            if state in {CONFIRMATION_ACTIVE, CONFIRMATION_CLAIMED}:
                restored = dict(raw)
                restored.pop("claimed_at", None)
                return restored
            return {}

        _safe_update_json(user_id, PROFILE_RESET_CONFIRMATION_FILE, {}, restore)


def confirm_pending_reset(user_id: str) -> bool:
    return consume_pending_reset(user_id) == CONFIRMATION_ACTIVE


def cancel_pending_reset(user_id: str) -> bool:
    return consume_pending_reset(user_id) == CONFIRMATION_ACTIVE
