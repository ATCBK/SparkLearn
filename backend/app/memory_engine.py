from __future__ import annotations

import json
import re
import uuid
from typing import Any

from .db import now_iso
from .storage import read_json, write_json

MEMORY_FILENAME = "memory_store.json"
WORKING_LIMIT = 80
EPISODIC_LIMIT = 500
PERCEPTUAL_LIMIT = 300


def _default_memory() -> dict[str, Any]:
    return {
        "version": 1,
        "updated_at": now_iso(),
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


def _sanitize_text(value: Any, max_len: int) -> str:
    return str(value or "").strip()[:max_len]


def _sanitize_tags(tags: Any) -> list[str]:
    if not isinstance(tags, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for t in tags:
        txt = _sanitize_text(t, 40)
        if not txt:
            continue
        k = txt.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(txt)
    return out[:8]


def _tokenize(text: str) -> set[str]:
    s = re.sub(r"[^0-9a-zA-Z\u4e00-\u9fff]+", " ", (text or "").lower())
    return {x for x in s.split() if x}


def _append_unique(lst: list[str], item: str, limit: int = 30) -> bool:
    v = _sanitize_text(item, 120)
    if not v:
        return False
    low = v.lower()
    if any(x.lower() == low for x in lst):
        return False
    lst.append(v)
    if len(lst) > limit:
        del lst[0 : len(lst) - limit]
    return True


def load_user_memory(user_id: str) -> dict[str, Any]:
    raw = read_json(user_id, MEMORY_FILENAME, _default_memory())
    if not isinstance(raw, dict):
        raw = _default_memory()

    sem = raw.get("semantic") if isinstance(raw.get("semantic"), dict) else {}
    out = {
        "version": int(raw.get("version", 1) or 1),
        "updated_at": str(raw.get("updated_at") or now_iso()),
        "working": [],
        "episodic": [],
        "semantic": {
            "goals": [_sanitize_text(x, 120) for x in sem.get("goals", []) if _sanitize_text(x, 120)],
            "preferences": [_sanitize_text(x, 120) for x in sem.get("preferences", []) if _sanitize_text(x, 120)],
            "constraints": [_sanitize_text(x, 120) for x in sem.get("constraints", []) if _sanitize_text(x, 120)],
            "facts": [_sanitize_text(x, 120) for x in sem.get("facts", []) if _sanitize_text(x, 120)],
            "skills": [_sanitize_text(x, 120) for x in sem.get("skills", []) if _sanitize_text(x, 120)],
            "weak_points": [_sanitize_text(x, 120) for x in sem.get("weak_points", []) if _sanitize_text(x, 120)],
            "learning_stage": _sanitize_text(sem.get("learning_stage"), 60),
        },
        "perceptual": [],
    }

    def _normalize_item(item: Any, default_type: str) -> dict[str, Any] | None:
        if not isinstance(item, dict):
            return None
        content = _sanitize_text(item.get("content"), 500)
        if not content:
            return None
        return {
            "id": _sanitize_text(item.get("id"), 24) or uuid.uuid4().hex[:12],
            "type": _sanitize_text(item.get("type"), 30) or default_type,
            "content": content,
            "source": _sanitize_text(item.get("source"), 40) or "unknown",
            "tags": _sanitize_tags(item.get("tags")),
            "importance": float(item.get("importance", 0.5) or 0.5),
            "confidence": float(item.get("confidence", 0.7) or 0.7),
            "created_at": _sanitize_text(item.get("created_at"), 40) or now_iso(),
            "last_accessed_at": _sanitize_text(item.get("last_accessed_at"), 40) or "",
            "access_count": int(item.get("access_count", 0) or 0),
            "pinned": bool(item.get("pinned", False)),
            "expires_at": _sanitize_text(item.get("expires_at"), 40) or "",
        }

    for x in (raw.get("working") if isinstance(raw.get("working"), list) else [])[-WORKING_LIMIT:]:
        it = _normalize_item(x, "context")
        if it:
            out["working"].append(it)

    for x in (raw.get("episodic") if isinstance(raw.get("episodic"), list) else [])[-EPISODIC_LIMIT:]:
        it = _normalize_item(x, "learning_event")
        if it:
            out["episodic"].append(it)

    for x in (raw.get("perceptual") if isinstance(raw.get("perceptual"), list) else [])[-PERCEPTUAL_LIMIT:]:
        it = _normalize_item(x, "asset_summary")
        if it:
            out["perceptual"].append(it)

    return out


def save_user_memory(user_id: str, memory: dict[str, Any]) -> dict[str, Any]:
    base = load_user_memory(user_id)
    merged = {
        "version": int(memory.get("version", base["version"]) if isinstance(memory, dict) else base["version"]),
        "updated_at": now_iso(),
        "working": memory.get("working", base["working"]) if isinstance(memory, dict) else base["working"],
        "episodic": memory.get("episodic", base["episodic"]) if isinstance(memory, dict) else base["episodic"],
        "semantic": memory.get("semantic", base["semantic"]) if isinstance(memory, dict) else base["semantic"],
        "perceptual": memory.get("perceptual", base["perceptual"]) if isinstance(memory, dict) else base["perceptual"],
    }
    write_json(user_id, MEMORY_FILENAME, merged)
    mem = load_user_memory(user_id)
    mem["updated_at"] = now_iso()
    write_json(user_id, MEMORY_FILENAME, mem)
    return mem


def add_memory_item(
    user_id: str,
    memory_type: str,
    content: str,
    tags: list[str] | None = None,
    source: str = "manual",
    importance: float = 0.5,
    confidence: float = 0.8,
    pinned: bool = False,
    expires_at: str = "",
) -> dict[str, Any]:
    mem = load_user_memory(user_id)
    item = {
        "id": uuid.uuid4().hex[:12],
        "type": _sanitize_text(memory_type, 30) or "note",
        "content": _sanitize_text(content, 500),
        "source": _sanitize_text(source, 40) or "manual",
        "tags": _sanitize_tags(tags or []),
        "importance": max(0.0, min(float(importance), 1.0)),
        "confidence": max(0.0, min(float(confidence), 1.0)),
        "created_at": now_iso(),
        "last_accessed_at": "",
        "access_count": 0,
        "pinned": bool(pinned),
        "expires_at": _sanitize_text(expires_at, 40),
    }
    if not item["content"]:
        raise ValueError("content is required")

    if memory_type in {"working", "context", "task_state"}:
        mem["working"].append(item)
        mem["working"] = mem["working"][-WORKING_LIMIT:]
    elif memory_type in {"perceptual", "asset", "document"}:
        mem["perceptual"].append(item)
        mem["perceptual"] = mem["perceptual"][-PERCEPTUAL_LIMIT:]
    else:
        mem["episodic"].append(item)
        mem["episodic"] = mem["episodic"][-EPISODIC_LIMIT:]

    mem["updated_at"] = now_iso()
    write_json(user_id, MEMORY_FILENAME, mem)
    return item


def _time_recency_score(created_at: str) -> float:
    if not created_at:
        return 0.3
    try:
        # rough recency without datetime parsing dependency
        days_hint = 0 if created_at[:10] == now_iso()[:10] else 3
        return 1.0 / (1.0 + days_hint)
    except Exception:
        return 0.3


def _semantic_score(query_tokens: set[str], text: str, tags: list[str]) -> float:
    item_tokens = _tokenize(text + " " + " ".join(tags))
    token_score = 0.0
    if item_tokens and query_tokens:
        inter = len(query_tokens.intersection(item_tokens))
        union = len(query_tokens.union(item_tokens)) or 1
        token_score = inter / union

    q = (next(iter(query_tokens)) if len(query_tokens) == 1 else "").strip()
    raw_text = (text or "").lower()
    raw_tags = " ".join(tags).lower()
    substring_boost = 0.0
    if q and (q in raw_text or q in raw_tags):
        substring_boost = 0.65

    # Chinese fallback: character overlap for short/continuous Chinese text.
    cjk_chars_q = {ch for ch in q if "\u4e00" <= ch <= "\u9fff"}
    cjk_chars_t = {ch for ch in raw_text if "\u4e00" <= ch <= "\u9fff"}
    char_score = 0.0
    if cjk_chars_q and cjk_chars_t:
        char_score = len(cjk_chars_q.intersection(cjk_chars_t)) / (len(cjk_chars_q.union(cjk_chars_t)) or 1)

    return max(token_score, substring_boost, char_score)


def search_memory(
    user_id: str,
    query: str,
    types: list[str] | None = None,
    top_k: int = 12,
) -> list[dict[str, Any]]:
    mem = load_user_memory(user_id)
    pools: list[tuple[str, list[dict[str, Any]]]] = [
        ("working", mem["working"]),
        ("episodic", mem["episodic"]),
        ("perceptual", mem["perceptual"]),
    ]
    allowed = {t.strip().lower() for t in (types or []) if t.strip()} if types else set()
    q_tokens = _tokenize(query)
    results: list[dict[str, Any]] = []

    for pool_name, items in pools:
        if allowed and pool_name not in allowed:
            continue
        for item in items:
            semantic = _semantic_score(q_tokens, item["content"], item["tags"])
            recency = _time_recency_score(item.get("created_at", ""))
            importance = max(0.0, min(float(item.get("importance", 0.5)), 1.0))
            score = (semantic * 0.6) + (recency * 0.2) + (importance * 0.15) + (0.05 if item.get("pinned") else 0.0)
            if allowed or semantic > 0.0 or item.get("pinned"):
                results.append({"memory_bucket": pool_name, "score": round(score, 6), **item})

    results.sort(key=lambda x: x["score"], reverse=True)
    top = results[: max(1, min(top_k, 50))]

    if top:
        now = now_iso()
        update_ids = {x["id"] for x in top}
        for bucket in ("working", "episodic", "perceptual"):
            for item in mem[bucket]:
                if item["id"] in update_ids:
                    item["access_count"] = int(item.get("access_count", 0)) + 1
                    item["last_accessed_at"] = now
        mem["updated_at"] = now
        write_json(user_id, MEMORY_FILENAME, mem)

    return top


def consolidate_memory(user_id: str, threshold: float = 0.7) -> dict[str, Any]:
    mem = load_user_memory(user_id)
    semantic = mem["semantic"]
    promoted = 0

    for item in mem["working"]:
        if float(item.get("importance", 0.5)) >= threshold:
            mem["episodic"].append({**item, "type": "promoted_working"})
            promoted += 1

    mem["working"] = [x for x in mem["working"] if float(x.get("importance", 0.5)) < threshold]
    mem["episodic"] = mem["episodic"][-EPISODIC_LIMIT:]

    ep_sorted = sorted(
        mem["episodic"],
        key=lambda x: (float(x.get("importance", 0.5)), float(x.get("confidence", 0.5))),
        reverse=True,
    )
    for item in ep_sorted[:30]:
        txt = str(item.get("content", ""))
        tags = [t.lower() for t in item.get("tags", [])]
        if any(k in txt for k in ["目标", "计划", "打算"]) or "goal" in tags:
            _append_unique(semantic["goals"], txt, 30)
        if any(k in txt for k in ["喜欢", "偏好", "希望"]) or "preference" in tags:
            _append_unique(semantic["preferences"], txt, 30)
        if any(k in txt for k in ["时间", "约束", "限制"]) or "constraint" in tags:
            _append_unique(semantic["constraints"], txt, 30)
        if any(k in txt for k in ["薄弱", "错题", "不会"]) or "weak_point" in tags:
            _append_unique(semantic["weak_points"], txt, 30)
        if any(k in txt for k in ["掌握", "能力"]) or "skill" in tags:
            _append_unique(semantic["skills"], txt, 30)

    mem["version"] = int(mem.get("version", 1)) + 1
    mem["updated_at"] = now_iso()
    write_json(user_id, MEMORY_FILENAME, mem)
    return {"promoted": promoted, "version": mem["version"], "semantic": mem["semantic"]}


def forget_memory(
    user_id: str,
    max_age_days: int = 30,
    importance_below: float = 0.35,
    clear_working: bool = False,
) -> dict[str, Any]:
    mem = load_user_memory(user_id)
    removed = 0
    keep_ep: list[dict[str, Any]] = []
    for item in mem["episodic"]:
        imp = float(item.get("importance", 0.5))
        pinned = bool(item.get("pinned", False))
        # lightweight age proxy: keep all recent date strings same day/month, otherwise rely on importance
        oldish = False
        created = str(item.get("created_at", ""))
        if created and created[:7] != now_iso()[:7]:
            oldish = True
        if pinned or imp >= importance_below or not oldish:
            keep_ep.append(item)
        else:
            removed += 1
    mem["episodic"] = keep_ep[-EPISODIC_LIMIT:]

    keep_per: list[dict[str, Any]] = []
    for item in mem["perceptual"]:
        if bool(item.get("pinned", False)) or float(item.get("importance", 0.5)) >= importance_below:
            keep_per.append(item)
        else:
            removed += 1
    mem["perceptual"] = keep_per[-PERCEPTUAL_LIMIT:]

    if clear_working:
        removed += len(mem["working"])
        mem["working"] = []

    mem["version"] = int(mem.get("version", 1)) + 1
    mem["updated_at"] = now_iso()
    write_json(user_id, MEMORY_FILENAME, mem)
    return {"removed": removed, "version": mem["version"]}


def build_injected_context(user_id: str, question: str, top_k: int = 8) -> str:
    mem = load_user_memory(user_id)
    sem = mem["semantic"]
    recalls = search_memory(user_id, question, types=["working", "episodic", "perceptual"], top_k=top_k)

    lines: list[str] = []
    lines.append("你必须基于以下用户记忆进行个性化回答，并优先遵循当前用户最新意图。")
    if sem.get("goals"):
        lines.append(f"长期目标: {json.dumps(sem['goals'][:8], ensure_ascii=False)}")
    if sem.get("preferences"):
        lines.append(f"学习偏好: {json.dumps(sem['preferences'][:8], ensure_ascii=False)}")
    if sem.get("constraints"):
        lines.append(f"约束条件: {json.dumps(sem['constraints'][:8], ensure_ascii=False)}")
    if sem.get("weak_points"):
        lines.append(f"薄弱点: {json.dumps(sem['weak_points'][:8], ensure_ascii=False)}")
    if sem.get("skills"):
        lines.append(f"能力标签: {json.dumps(sem['skills'][:8], ensure_ascii=False)}")
    if sem.get("learning_stage"):
        lines.append(f"当前学习阶段: {sem['learning_stage']}")
    if recalls:
        recall_lines = [f"[{x['memory_bucket']}|{x.get('type','note')}] {x['content']}" for x in recalls[:top_k]]
        lines.append(f"相关历史记忆: {json.dumps(recall_lines, ensure_ascii=False)}")
    lines.append("若历史记忆与当前问题冲突，以当前问题为准，并在回答中体现调整。")
    return "\n".join(lines)


def update_memory_from_turn(
    user_id: str,
    user_message: str,
    assistant_message: str,
    page_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    mem = load_user_memory(user_id)
    sem = mem["semantic"]
    text = _sanitize_text(user_message, 500)
    page = _sanitize_text((page_context or {}).get("page"), 40)
    module = _sanitize_text((page_context or {}).get("module"), 40)
    tags = [x for x in [page, module] if x]
    changed = 0

    add_memory_item(
        user_id=user_id,
        memory_type="working",
        content=f"用户当前问题: {text}",
        tags=tags + ["current_turn"],
        source="tutor_chat",
        importance=0.6,
        confidence=0.9,
        pinned=False,
    )
    add_memory_item(
        user_id=user_id,
        memory_type="episodic",
        content=f"用户问题: {text} | 助手回答摘要: {_sanitize_text(assistant_message, 200)}",
        tags=tags + ["qa_event"],
        source="tutor_chat",
        importance=0.65,
        confidence=0.8,
        pinned=False,
    )

    goal_m = re.search(r"(?:目标|想要|希望|计划|打算)(?:是|为|:)?(.{2,50})", text)
    if goal_m and _append_unique(sem["goals"], goal_m.group(1), 30):
        changed += 1
    pref_m = re.search(r"(?:我喜欢|偏好|更希望)(.{2,50})", text)
    if pref_m and _append_unique(sem["preferences"], pref_m.group(1), 30):
        changed += 1
    cons_m = re.search(r"(?:每天|每周).{0,12}(?:分钟|小时)", text)
    if cons_m and _append_unique(sem["constraints"], cons_m.group(0), 30):
        changed += 1
    rem_m = re.search(r"(?:记住|请记住|帮我记住)(.{2,80})", text)
    if rem_m and _append_unique(sem["facts"], rem_m.group(1), 30):
        changed += 1

    mem = load_user_memory(user_id)
    mem["semantic"] = sem
    mem["version"] = int(mem.get("version", 1)) + (1 if changed else 0)
    mem["updated_at"] = now_iso()
    write_json(user_id, MEMORY_FILENAME, mem)
    return {"changed": changed, "version": mem["version"]}
