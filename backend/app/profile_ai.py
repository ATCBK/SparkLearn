# -*- coding: utf-8 -*-
"""学习画像的模型融合分析与保守规则降级。"""

from __future__ import annotations

import json
import math
import re
from collections.abc import AsyncIterator, Callable
from datetime import UTC, datetime
from typing import Any


ANALYSIS_SCHEMA_VERSION = "profile-analysis-v1"
ANALYSIS_ARRAY_LIMIT = 5
MODEL_TEXT_LIMIT = 20_000
PROFILE_ARRAY_FIELDS = ("goal", "weak_points", "learning_preference")
PROFILE_TEXT_FIELDS = (
    "major",
    "grade",
    "knowledge_level",
    "cognitive_style",
    "practical_ability",
    "current_stage",
)
ANALYSIS_TEXT_FIELDS = (
    "overview",
    "narrative",
    "goal_gap",
    "learning_strategy",
)
ANALYSIS_LIST_FIELDS = ("strengths", "focus_areas", "next_actions")

StreamEvents = Callable[..., AsyncIterator[tuple[str, dict[str, Any]]]]


def _now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _clean_text(value: Any, *, limit: int = 1200) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:limit]


def _clean_list(value: Any, *, limit: int = ANALYSIS_ARRAY_LIMIT) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned: list[str] = []
    for item in value:
        text = _clean_text(item, limit=300)
        if text and text not in cleaned:
            cleaned.append(text)
        if len(cleaned) >= limit:
            break
    return cleaned


def _safe_version(value: Any) -> int:
    try:
        version = int(value)
    except (TypeError, ValueError):
        return 1
    return max(1, version)


def _safe_confidence(value: Any) -> float:
    confidence = float(value)
    return min(1.0, max(0.0, confidence))


def _is_finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


def _profile_facts(profile: dict[str, Any] | None) -> dict[str, Any]:
    raw = profile if isinstance(profile, dict) else {}
    facts: dict[str, Any] = {field: _clean_text(raw.get(field)) for field in PROFILE_TEXT_FIELDS}
    facts.update({field: _clean_list(raw.get(field)) for field in PROFILE_ARRAY_FIELDS})
    daily_time = raw.get("daily_time", 0)
    try:
        facts["daily_time"] = max(0, min(1440, int(daily_time or 0)))
    except (TypeError, ValueError):
        facts["daily_time"] = 0
    facts["version"] = _safe_version(raw.get("version"))
    return facts


def _has_profile_data(profile: dict[str, Any]) -> bool:
    return any(profile.get(field) for field in (*PROFILE_TEXT_FIELDS, *PROFILE_ARRAY_FIELDS)) or bool(
        profile.get("daily_time")
    )


def _source_label(source_type: str) -> str:
    return {
        "onboarding": "问卷建档字段",
        "dialog": "对话建档字段",
        "manual_update": "用户维护的画像字段",
        "history_analyze": "当前画像与有限历史",
    }.get(source_type, "当前画像字段")


def _base_result(profile: dict[str, Any], source_type: str, generated_by: str) -> dict[str, Any]:
    now = _now_iso()
    has_data = _has_profile_data(profile)
    return {
        "status": "ready",
        "schema_version": ANALYSIS_SCHEMA_VERSION,
        "profile_version": profile["version"],
        "source_type": _clean_text(source_type, limit=80) or "unknown",
        "generated_by": generated_by,
        "model": "configured-default" if generated_by == "llm" else "rule",
        "evidence": (
            [{"source": source_type or "unknown", "label": _source_label(source_type), "captured_at": now}]
            if has_data
            else []
        ),
        "analysis_steps": [],
        "updated_at": now,
    }


def build_rule_fallback_analysis(
    profile: dict[str, Any],
    source_type: str,
    reason: str,
) -> dict[str, Any]:
    """只根据已传入的画像事实生成保守分析，不补充默认画像。"""

    facts = _profile_facts(profile)
    result = _base_result(facts, source_type, "rule_fallback")
    goals = facts["goal"]
    weak_points = facts["weak_points"]
    preferences = facts["learning_preference"]
    knowledge_level = facts["knowledge_level"]
    practical_ability = facts["practical_ability"]
    stage = facts["current_stage"]
    major = facts["major"]
    daily_time = facts["daily_time"]

    if not _has_profile_data(facts):
        overview = "当前画像信息尚未采集。"
        narrative = "当前画像字段尚未采集，暂时无法形成有依据的综合判断。"
    else:
        identity = "、".join(part for part in (major, stage) if part)
        overview = f"已采集当前画像：{identity}。" if identity else "已采集部分当前画像信息。"
        fragments: list[str] = []
        if knowledge_level:
            fragments.append(f"当前基础为“{knowledge_level}”")
        if goals:
            fragments.append(f"学习目标为“{'、'.join(goals)}”")
        if weak_points:
            fragments.append(f"已记录的待提升点为“{'、'.join(weak_points)}”")
        narrative = "；".join(fragments) + "。" if fragments else overview

    if goals and (knowledge_level or weak_points):
        current_basis = knowledge_level or f"待提升点包括“{'、'.join(weak_points)}”"
        goal_gap = f"当前已知基础为“{current_basis}”，目标为“{'、'.join(goals)}”；具体差距仍需在学习过程中验证。"
    elif goals:
        goal_gap = f"已采集目标“{'、'.join(goals)}”，当前基础尚未采集，差距待验证。"
    else:
        goal_gap = "学习目标或当前基础尚未采集，目标差距待验证。"

    strengths: list[str] = []
    if knowledge_level:
        strengths.append(f"当前基础：{knowledge_level}")
    if practical_ability:
        strengths.append(f"实践情况：{practical_ability}")

    if preferences and daily_time:
        learning_strategy = f"按已记录的“{'、'.join(preferences)}”偏好安排学习，每日可用时间约 {daily_time} 分钟。"
    elif preferences:
        learning_strategy = f"可优先采用已记录的“{'、'.join(preferences)}”学习偏好；可用时间尚未采集。"
    elif daily_time:
        learning_strategy = f"每日可用时间约 {daily_time} 分钟，学习偏好尚未采集。"
    else:
        learning_strategy = "学习偏好与可用时间尚未采集。"

    next_actions: list[str] = []
    if weak_points:
        next_actions.append(f"围绕“{weak_points[0]}”完成一次针对性学习并记录结果")
    if goals:
        next_actions.append(f"将“{goals[0]}”拆分为可验证的近期步骤")

    result.update(
        {
            "confidence": 0.35 if _has_profile_data(facts) else 0.0,
            "overview": overview,
            "narrative": narrative,
            "goal_gap": goal_gap,
            "strengths": strengths[:ANALYSIS_ARRAY_LIMIT],
            "focus_areas": weak_points,
            "learning_strategy": learning_strategy,
            "next_actions": next_actions[:ANALYSIS_ARRAY_LIMIT],
            "analysis_steps": [
                {
                    "title": "使用规则生成基础分析",
                    "detail": _clean_text(reason, limit=300) or "模型输出不可用",
                    "status": "done",
                }
            ],
        }
    )
    return result


def _extract_json_objects(text: str) -> list[dict[str, Any]]:
    raw = text.strip()
    if not raw:
        return []

    candidates = [raw]
    candidates.extend(match.group(1).strip() for match in re.finditer(r"```(?:json)?\s*(.*?)```", raw, re.I | re.S))
    decoder = json.JSONDecoder()
    objects: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add_candidate(parsed: Any) -> None:
        if not isinstance(parsed, dict):
            return
        identity = json.dumps(parsed, ensure_ascii=False, sort_keys=True)
        if identity not in seen:
            seen.add(identity)
            objects.append(parsed)

    for candidate in candidates:
        try:
            add_candidate(json.loads(candidate))
        except json.JSONDecodeError:
            pass
        for start, char in enumerate(candidate):
            if char != "{":
                continue
            try:
                parsed, _ = decoder.raw_decode(candidate[start:])
            except json.JSONDecodeError:
                continue
            add_candidate(parsed)
    return objects


async def _collect_model_text(prompt: str, stream_events: StreamEvents) -> tuple[str, bool]:
    chunks: list[str] = []
    has_error = False
    collected_chars = 0
    try:
        async for event_type, payload in stream_events(prompt, mode="general", history=[]):
            if event_type == "text" and isinstance(payload, dict):
                raw_content = payload.get("content")
                remaining = MODEL_TEXT_LIMIT - collected_chars
                content = raw_content[:remaining] if isinstance(raw_content, str) and remaining > 0 else ""
                if content:
                    chunks.append(content)
                    collected_chars += len(content)
            elif event_type == "error":
                has_error = True
            elif event_type == "done" and isinstance(payload, dict):
                if payload.get("fallback") is True or payload.get("produced") is False:
                    has_error = True
    except Exception:
        return "", True
    return "".join(chunks).strip(), has_error


def _analysis_prompt(
    profile: dict[str, Any],
    history: list[dict[str, Any]],
    source_type: str,
    source_text: str,
) -> str:
    limited_history = [item for item in history[:5] if isinstance(item, dict)]
    input_data = {
        "current_profile": profile,
        "history": limited_history,
        "source_type": _clean_text(source_type, limit=80),
        "source_text": _clean_text(source_text, limit=4000),
    }
    fields = [*ANALYSIS_TEXT_FIELDS, *ANALYSIS_LIST_FIELDS, "confidence"]
    return (
        "你是学习画像融合分析器。只能依据 INPUT_JSON 中的事实进行关联判断，不得补充未提供的信息。\n"
        "只返回一个 JSON 对象，不要输出 Markdown 或解释。无依据的文本字段写“尚未采集”，数组写空数组。\n"
        f"JSON 字段必须且只能为：{json.dumps(fields, ensure_ascii=False)}。confidence 必须为 0 到 1 的数字。\n"
        f"INPUT_JSON={json.dumps(input_data, ensure_ascii=False)}"
    )


def _normalize_llm_analysis(
    parsed: dict[str, Any],
    profile: dict[str, Any],
    source_type: str,
) -> dict[str, Any] | None:
    required = {*ANALYSIS_TEXT_FIELDS, *ANALYSIS_LIST_FIELDS, "confidence"}
    if not required.issubset(parsed):
        return None
    if not all(isinstance(parsed.get(field), str) for field in ANALYSIS_TEXT_FIELDS):
        return None
    if not all(isinstance(parsed.get(field), list) for field in ANALYSIS_LIST_FIELDS):
        return None
    if not _is_finite_number(parsed.get("confidence")):
        return None

    narrative = _clean_text(parsed.get("narrative"))
    if not narrative:
        return None

    result = _base_result(profile, source_type, "llm")
    result.update({field: _clean_text(parsed.get(field)) or "尚未采集" for field in ANALYSIS_TEXT_FIELDS})
    result.update({field: _clean_list(parsed.get(field)) for field in ANALYSIS_LIST_FIELDS})
    result["confidence"] = _safe_confidence(parsed.get("confidence"))
    return result


async def generate_profile_analysis(
    profile: dict[str, Any],
    history: list[dict[str, Any]],
    source_type: str,
    source_text: str,
    stream_events: StreamEvents,
) -> dict[str, Any]:
    """调用模型生成融合分析，任何不可用输出都显式退回规则结果。"""

    facts = _profile_facts(profile)
    if not _has_profile_data(facts):
        return build_rule_fallback_analysis(profile, source_type=source_type, reason="当前画像无可分析数据")
    prompt = _analysis_prompt(facts, history if isinstance(history, list) else [], source_type, source_text)
    model_text, has_error = await _collect_model_text(prompt, stream_events)
    parsed_candidates = [] if has_error else _extract_json_objects(model_text)
    for parsed in parsed_candidates:
        normalized = _normalize_llm_analysis(parsed, facts, source_type)
        if normalized is not None:
            return normalized
    return build_rule_fallback_analysis(profile, source_type=source_type, reason="模型输出不可用")


def _dialog_fallback_profile(fallback_profile: dict[str, Any] | None) -> dict[str, Any]:
    facts = _profile_facts(fallback_profile)
    return {
        **{field: facts[field] for field in PROFILE_TEXT_FIELDS},
        **{field: facts[field] for field in PROFILE_ARRAY_FIELDS},
        "daily_time": facts["daily_time"],
        "version": facts["version"],
        "updated_at": _now_iso(),
    }


def _dialog_prompt(messages: list[dict[str, Any]]) -> str:
    compact_messages = []
    for message in messages[-12:]:
        if not isinstance(message, dict):
            continue
        compact_messages.append(
            {
                "role": "assistant" if message.get("role") == "assistant" else "user",
                "content": _clean_text(message.get("content"), limit=2000),
            }
        )
    fields = [*PROFILE_TEXT_FIELDS, *PROFILE_ARRAY_FIELDS, "daily_time"]
    return (
        "从对话中提取学习画像事实。只能提取用户明确表达的内容，不得推测或填入通用默认值。\n"
        "只返回一个 JSON 对象；未提及的文本字段写空字符串，数组写空数组，学习时长写 0。\n"
        f"JSON 字段必须且只能为：{json.dumps(fields, ensure_ascii=False)}。\n"
        f"MESSAGES_JSON={json.dumps(compact_messages, ensure_ascii=False)}"
    )


async def extract_dialog_profile(
    messages: list[dict[str, Any]],
    fallback_profile: dict[str, Any],
    stream_events: StreamEvents,
) -> dict[str, Any]:
    """从建档对话提取结构化字段；失败时只返回调用方给出的规则事实。"""

    fallback = _dialog_fallback_profile(fallback_profile)
    prompt = _dialog_prompt(messages if isinstance(messages, list) else [])
    model_text, has_error = await _collect_model_text(prompt, stream_events)
    parsed_candidates = [] if has_error else _extract_json_objects(model_text)
    parsed = next((candidate for candidate in parsed_candidates if _is_dialog_profile_candidate(candidate)), None)
    if parsed is None:
        return fallback

    result = dict(fallback)
    for field in PROFILE_TEXT_FIELDS:
        text = _clean_text(parsed.get(field))
        if text:
            result[field] = text
    for field in PROFILE_ARRAY_FIELDS:
        values = _clean_list(parsed.get(field))
        if values:
            result[field] = values
    try:
        daily_time = int(parsed.get("daily_time") or 0)
    except (TypeError, ValueError):
        daily_time = 0
    if daily_time > 0:
        result["daily_time"] = min(1440, daily_time)
    result["updated_at"] = _now_iso()
    return result


def _is_dialog_profile_candidate(candidate: dict[str, Any]) -> bool:
    required_text_fields = tuple(field for field in PROFILE_TEXT_FIELDS if field != "grade")
    required = {*required_text_fields, *PROFILE_ARRAY_FIELDS, "daily_time"}
    if not required.issubset(candidate):
        return False
    if not all(isinstance(candidate.get(field), str) for field in required_text_fields):
        return False
    if not all(isinstance(candidate.get(field), list) for field in PROFILE_ARRAY_FIELDS):
        return False
    daily_time = candidate.get("daily_time")
    if isinstance(daily_time, bool):
        return False
    try:
        return math.isfinite(float(daily_time))
    except (TypeError, ValueError):
        return False
