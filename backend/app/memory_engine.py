from __future__ import annotations

import json
import re
import uuid
from typing import Any

from .db import now_iso
from .storage import read_json, write_json


MEMORY_FILENAME = "user_memory_profile.json"


def _default_memory() -> dict[str, Any]:
    return {
        "version": 1,
        "updated_at": now_iso(),
        "long_term": {
            "goals": [],
            "preferences": [],
            "constraints": [],
            "facts": [],
        },
        "episodic": [],
    }


def _sanitize_list(items: Any) -> list[str]:
    if not isinstance(items, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for raw in items:
        text = str(raw or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text[:120])
    return out


def load_user_memory(user_id: str) -> dict[str, Any]:
    raw = read_json(user_id, MEMORY_FILENAME, _default_memory())
    if not isinstance(raw, dict):
        raw = _default_memory()
    long_term = raw.get("long_term") if isinstance(raw.get("long_term"), dict) else {}
    episodic = raw.get("episodic") if isinstance(raw.get("episodic"), list) else []
    mem = {
        "version": int(raw.get("version", 1) or 1),
        "updated_at": str(raw.get("updated_at") or now_iso()),
        "long_term": {
            "goals": _sanitize_list(long_term.get("goals")),
            "preferences": _sanitize_list(long_term.get("preferences")),
            "constraints": _sanitize_list(long_term.get("constraints")),
            "facts": _sanitize_list(long_term.get("facts")),
        },
        "episodic": [],
    }
    clean_ep: list[dict[str, Any]] = []
    for item in episodic[-120:]:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        clean_ep.append(
            {
                "id": str(item.get("id") or uuid.uuid4().hex[:10]),
                "ts": str(item.get("ts") or now_iso()),
                "type": str(item.get("type") or "note"),
                "text": text[:240],
                "tags": _sanitize_list(item.get("tags"))[:6],
                "source": str(item.get("source") or "unknown"),
                "pinned": bool(item.get("pinned", False)),
            }
        )
    mem["episodic"] = clean_ep
    return mem


def save_user_memory(user_id: str, memory: dict[str, Any]) -> dict[str, Any]:
    mem = load_user_memory(user_id)
    mem["version"] = int(memory.get("version", mem["version"]) or mem["version"])
    mem["long_term"] = {
        "goals": _sanitize_list(memory.get("long_term", {}).get("goals", mem["long_term"]["goals"])),
        "preferences": _sanitize_list(memory.get("long_term", {}).get("preferences", mem["long_term"]["preferences"])),
        "constraints": _sanitize_list(memory.get("long_term", {}).get("constraints", mem["long_term"]["constraints"])),
        "facts": _sanitize_list(memory.get("long_term", {}).get("facts", mem["long_term"]["facts"])),
    }
    incoming_ep = memory.get("episodic", mem.get("episodic", []))
    mem["episodic"] = load_user_memory(user_id={"x": "y"} if False else user_id)["episodic"]  # type: ignore[arg-type]
    if isinstance(incoming_ep, list):
        merged: list[dict[str, Any]] = []
        for item in incoming_ep[-120:]:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            merged.append(
                {
                    "id": str(item.get("id") or uuid.uuid4().hex[:10]),
                    "ts": str(item.get("ts") or now_iso()),
                    "type": str(item.get("type") or "note"),
                    "text": text[:240],
                    "tags": _sanitize_list(item.get("tags"))[:6],
                    "source": str(item.get("source") or "unknown"),
                    "pinned": bool(item.get("pinned", False)),
                }
            )
        mem["episodic"] = merged
    mem["updated_at"] = now_iso()
    write_json(user_id, MEMORY_FILENAME, mem)
    return mem


def _tokenize(text: str) -> set[str]:
    s = re.sub(r"[^0-9a-zA-Z\u4e00-\u9fff]+", " ", text.lower())
    parts = [p for p in s.split() if p]
    return set(parts)


def _relevance_score(question_tokens: set[str], item_text: str, item_tags: list[str]) -> int:
    item_tokens = _tokenize(item_text + " " + " ".join(item_tags))
    if not item_tokens:
        return 0
    overlap = len(question_tokens.intersection(item_tokens))
    return overlap


def build_memory_prompt(memory: dict[str, Any], question: str, max_items: int = 6) -> str:
    long_term = memory.get("long_term", {})
    goals = _sanitize_list(long_term.get("goals"))
    prefs = _sanitize_list(long_term.get("preferences"))
    constraints = _sanitize_list(long_term.get("constraints"))
    facts = _sanitize_list(long_term.get("facts"))
    episodic = memory.get("episodic", []) if isinstance(memory.get("episodic"), list) else []

    q_tokens = _tokenize(question)
    scored: list[tuple[int, dict[str, Any]]] = []
    for item in episodic:
        if not isinstance(item, dict):
            continue
        score = _relevance_score(q_tokens, str(item.get("text") or ""), _sanitize_list(item.get("tags")))
        if bool(item.get("pinned", False)):
            score += 100
        scored.append((score, item))
    scored.sort(key=lambda x: x[0], reverse=True)
    chosen = [it for score, it in scored if score > 0][:max_items]
    if not chosen:
        chosen = [it for _, it in scored[: min(max_items, 3)] if isinstance(it, dict)]

    lines: list[str] = []
    lines.append("你必须优先遵循以下用户长期记忆，回答时显式对齐。")
    if goals:
        lines.append(f"长期目标: {json.dumps(goals, ensure_ascii=False)}")
    if prefs:
        lines.append(f"表达偏好: {json.dumps(prefs, ensure_ascii=False)}")
    if constraints:
        lines.append(f"约束条件: {json.dumps(constraints, ensure_ascii=False)}")
    if facts:
        lines.append(f"稳定事实: {json.dumps(facts, ensure_ascii=False)}")
    if chosen:
        recalls = [str(x.get("text") or "") for x in chosen if str(x.get("text") or "").strip()]
        if recalls:
            lines.append(f"相关历史观点: {json.dumps(recalls, ensure_ascii=False)}")
    lines.append("如果用户当前说法与历史冲突，以当前说法为准，并在回答中按最新意图执行。")
    return "\n".join(lines)


def _append_unique(target: list[str], value: str, limit: int = 20) -> bool:
    v = value.strip()
    if not v:
        return False
    lower = v.lower()
    if any(x.lower() == lower for x in target):
        return False
    target.append(v[:120])
    if len(target) > limit:
        del target[0 : len(target) - limit]
    return True


def update_memory_from_turn(
    user_id: str,
    user_message: str,
    assistant_message: str,
    page_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    mem = load_user_memory(user_id)
    lt = mem["long_term"]
    changed = 0
    text = (user_message or "").strip()

    goal_patterns = [
        r"(?:目标|想要|希望|计划|打算)(?:是|为|:)?(.{2,30})",
        r"(?:我要|我想)(.{2,30})",
    ]
    pref_patterns = [
        r"(?:我喜欢|偏好)(.{2,30})",
        r"(?:请你|希望你)(?:用|以)?(.{2,30})(?:讲|解释|回答)",
    ]
    constraint_patterns = [
        r"(?:每天|每周).{0,10}(?:分钟|小时)",
        r"(?:时间不多|没时间|尽量简短|不要太长|直接给结论)",
    ]

    for pat in goal_patterns:
        m = re.search(pat, text)
        if m and _append_unique(lt["goals"], m.group(1)):
            changed += 1
            break
    for pat in pref_patterns:
        m = re.search(pat, text)
        if m and _append_unique(lt["preferences"], m.group(1)):
            changed += 1
            break
    for pat in constraint_patterns:
        m = re.search(pat, text)
        if m and _append_unique(lt["constraints"], m.group(0)):
            changed += 1

    remember_m = re.search(r"(?:记住|请记住|帮我记住)(.{2,60})", text)
    if remember_m:
        if _append_unique(lt["facts"], remember_m.group(1)):
            changed += 1

    ep_item = {
        "id": uuid.uuid4().hex[:10],
        "ts": now_iso(),
        "type": "dialogue",
        "text": f"用户: {text[:120]}",
        "tags": _sanitize_list(
            [
                str((page_context or {}).get("page", "")),
                str((page_context or {}).get("module", "")),
            ]
        ),
        "source": "tutor_chat",
        "pinned": "记住" in text,
    }
    mem["episodic"].append(ep_item)
    mem["episodic"] = mem["episodic"][-120:]
    mem["version"] = int(mem.get("version", 1)) + (1 if changed > 0 else 0)
    mem["updated_at"] = now_iso()
    write_json(user_id, MEMORY_FILENAME, mem)
    return {"changed": changed, "memory": mem, "assistant_preview": assistant_message[:120]}

