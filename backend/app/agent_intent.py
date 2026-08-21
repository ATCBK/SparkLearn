# -*- coding: utf-8 -*-
"""学习伙伴的结构化搜索意图规划与安全查询清洗。"""

from __future__ import annotations

import json
import math
import re
import unicodedata
from collections.abc import AsyncIterator, Callable
from typing import Any


INTENT_SCHEMA_VERSION = "agent-search-intent-v1"
VALID_DECISIONS = {"search", "clarify", "respond"}
MAX_QUERY_LENGTH = 100
MAX_MODEL_TEXT_LENGTH = 20_000

StreamLLM = Callable[..., AsyncIterator[Any]]

_LEADING_POLITE_RE = re.compile(r"^(?:(?:请|麻烦|劳驾)(?:你)?|帮我)\s*")
_CONTEXTUAL_SEARCH_COMMAND_RE = re.compile(
    r"^(?:(?:(?:请|麻烦|劳驾)(?:你)?(?:务必)?|帮我)|我想(?:让你)?|你可以)\s*"
    r"(?:帮我\s*)?(?:查找|搜索|查询|搜一搜|搜一下|找一下)(?:一下)?\s*",
    re.IGNORECASE,
)
_BARE_SEARCH_COMMAND_RE = re.compile(
    r"^(?:查找|搜索|查询|搜一搜|搜一下|找一下)(?:一下)?(?:\s+|[：:])\s*",
    re.IGNORECASE,
)
_NEGATED_SEARCH_RE = re.compile(r"(?:不要|不用|无需|别)\s*(?:再)?(?:查找|搜索|查询|搜|找)")
_LEADING_EXPLANATION_RE = re.compile(
    r"^(?:(?:请|麻烦|劳驾)(?:你)?|帮我)?\s*(?:解释|讲解|说明)(?:一下)?\s*",
    re.IGNORECASE,
)
_CONTEXT_CONTINUATION_RE = re.compile(
    r"^(?:再|继续|另外|还有|换(?:一个|个)?)(?:帮我)?(?:找|搜|查)?(?:一个|个|一下)?\s*",
    re.IGNORECASE,
)
_CONTEXT_PREFERENCE_RE = re.compile(
    r"^(?:更)?(?:简单|基础|入门|详细|深入|权威|新|短|容易|难|实用|通俗)"
    r"(?:一点|一些|点)?(?:的)?(?:教程|资料|资源|视频|文章|课程|例子|示例)?$"
)
_GENERIC_QUERY_SUFFIX_RE = re.compile(r"(?:相关)?(?:资料|资源|内容|信息)\s*$")
_NON_SUBSTANTIVE_QUERY_RE = re.compile(
    r"推荐|最新|教程|课程|资料|资源|内容|信息|文献|论文|链接|网址|书籍|视频|相关|一下"
)
_UNSAFE_SHELL_RE = re.compile(
    r"\b(?:powershell(?:\.exe)?|pwsh(?:\.exe)?)\s+(?:-+[A-Za-z]|/)"
    r"|\bcmd(?:\.exe)?\s+/[ck]\b|\b(?:bash|sh)\s+-c\b|\brm\s+-rf\b|\bRemove-Item\b"
    r"|\bpython(?:\d+(?:\.\d+)?)?(?:\.exe)?\s+-(?:c|m)\b"
    r"|\b(?:curl|wget)(?:\.exe)?\s+(?:-+[A-Za-z]|https?://|ftp://|(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?:[/:]\S*)?)",
    re.IGNORECASE,
)
_UNSAFE_SCRIPT_RE = re.compile(r"<\s*/?\s*script\b|javascript\s*:", re.IGNORECASE)
_UNSAFE_URL_OPERATION_RE = re.compile(
    r"(?:打开|访问|进入)\s*https?://\S+.*(?:点击|输入|提交|执行|运行)"
    r"|https?://\S+.*(?:点击|输入|提交|执行|运行)",
    re.IGNORECASE,
)
_TECHNICAL_SEARCH_TERMS = ("搜索引擎", "搜索算法", "查找算法")
_RESIDUAL_SEARCH_VERB_RE = re.compile(r"搜索|查找|查询|搜一搜|搜一下|找一下|查查|搜搜")
_RESIDUAL_COMMAND_FRAME_RE = re.compile(
    r"^(?:我要|我需要|我想让你|你可以|能不能|可不可以|请你|帮我|帮忙|给我|务必)"
)


def _clean_display_text(value: Any, *, limit: int = 500) -> str:
    if not isinstance(value, str):
        return ""
    text = "".join(
        " " if unicodedata.category(char) in {"Cc", "Cf", "Zl", "Zp"} else char
        for char in value
    )
    text = re.sub(r"\s+", " ", text).strip(" \t\r\n`\"'，,。；;：:")
    return text[:limit].strip()


def _passes_query_postcondition(query: str) -> bool:
    remaining = query
    for technical_term in _TECHNICAL_SEARCH_TERMS:
        remaining = remaining.replace(technical_term, "")
    return not (
        _RESIDUAL_SEARCH_VERB_RE.search(remaining)
        or _RESIDUAL_COMMAND_FRAME_RE.search(remaining)
    )


def normalize_search_query(value: Any) -> str:
    """把模型或规则产生的文本收敛为浏览器可接收的单行查询词。"""

    text = _clean_display_text(value, limit=2000)
    if not text:
        return ""
    if _UNSAFE_SHELL_RE.search(text) or _UNSAFE_SCRIPT_RE.search(text) or _UNSAFE_URL_OPERATION_RE.search(text):
        return ""

    previous = None
    while text != previous:
        previous = text
        text = _CONTEXTUAL_SEARCH_COMMAND_RE.sub("", text).strip()
        text = _BARE_SEARCH_COMMAND_RE.sub("", text).strip()
        text = _LEADING_POLITE_RE.sub("", text).strip()
        text = _LEADING_EXPLANATION_RE.sub("", text).strip()
        text = re.sub(r"^关于\s*", "", text).strip()

    text = _GENERIC_QUERY_SUFFIX_RE.sub("", text).strip(" ，,。；;：:")
    text = re.sub(r"(?<!\s)(是什么|为什么|怎么理解|如何理解)$", r" \1", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""

    normalized = text[:MAX_QUERY_LENGTH].rstrip(" ，,。；;：:")
    return normalized if _passes_query_postcondition(normalized) else ""


def _safe_confidence(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    confidence = float(value)
    if not math.isfinite(confidence):
        return None
    return min(1.0, max(0.0, confidence))


def _clean_string_list(value: Any, *, limit: int = 5) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned: list[str] = []
    for item in value:
        text = _clean_display_text(item, limit=160)
        if text and text not in cleaned:
            cleaned.append(text)
        if len(cleaned) >= limit:
            break
    return cleaned


def _base_plan(
    *,
    decision: str,
    goal: str,
    normalized_query: str,
    constraints: list[str],
    output_focus: str,
    clarification_question: str,
    confidence: float,
    generated_by: str,
) -> dict[str, Any]:
    return {
        "schema_version": INTENT_SCHEMA_VERSION,
        "decision": decision,
        "goal": goal,
        "normalized_query": normalized_query,
        "constraints": constraints,
        "output_focus": output_focus,
        "clarification_question": clarification_question,
        "confidence": confidence,
        "generated_by": generated_by,
    }


def _recent_query_values(recent_context: list[str] | None) -> list[str]:
    queries: list[str] = []
    for item in recent_context or []:
        query = normalize_search_query(item)
        if query and query not in queries:
            queries.append(query)
        if len(queries) >= 3:
            break
    return queries


def _context_modifier(input_text: str) -> str | None:
    readable_input = _clean_display_text(input_text)
    prefix_match = _CONTEXT_CONTINUATION_RE.search(readable_input)
    if prefix_match:
        modifier = readable_input[prefix_match.end():].strip(" ，,。；;：:")
    elif _CONTEXT_PREFERENCE_RE.fullmatch(readable_input):
        modifier = readable_input
    else:
        return None
    return re.sub(r"[吗呢呀啊]$", "", modifier).strip()


def _uses_recent_topic(input_text: str) -> bool:
    modifier = _context_modifier(input_text)
    return modifier is not None and (not modifier or bool(_CONTEXT_PREFERENCE_RE.fullmatch(modifier)))


def _contextual_query(input_text: str, query: str, recent_context: list[str] | None) -> str:
    recent_queries = _recent_query_values(recent_context)
    if not recent_queries:
        return query

    modifier = _context_modifier(input_text)
    if modifier is None:
        return query
    if not modifier:
        return recent_queries[0]
    if not _CONTEXT_PREFERENCE_RE.fullmatch(modifier):
        return normalize_search_query(modifier) or query
    return normalize_search_query(f"{recent_queries[0]} {modifier}")


def _topic_units(value: str) -> set[str]:
    text = normalize_search_query(value).lower()
    text = _NON_SUBSTANTIVE_QUERY_RE.sub(" ", text)
    text = re.sub(r"是什么|为什么|怎么理解|如何理解|什么意思|有何区别", " ", text)
    units = {
        token
        for token in re.findall(r"[a-z0-9][a-z0-9+#.\-]*", text)
        if len(token) >= 2 or any(symbol in token for symbol in "+#")
    }
    for segment in re.findall(r"[\u4e00-\u9fff]+", text):
        if len(segment) == 1:
            units.add(segment)
        else:
            units.update(segment[index:index + 2] for index in range(len(segment) - 1))
    return units


def _llm_query_matches_request(
    input_text: str,
    model_query: str,
    recent_context: list[str] | None,
) -> bool:
    if _uses_recent_topic(input_text):
        anchors = _recent_query_values(recent_context)[:1]
    else:
        current_query = _contextual_query(input_text, normalize_search_query(input_text), recent_context)
        anchors = [current_query] if current_query else []
    model_units = _topic_units(model_query)
    return bool(model_units and any(model_units & _topic_units(anchor) for anchor in anchors))


def _rule_fallback_plan(input_text: str, recent_context: list[str] | None = None) -> dict[str, Any]:
    readable_input = _clean_display_text(input_text, limit=500)
    query = normalize_search_query(readable_input)
    negates_search = bool(_NEGATED_SEARCH_RE.search(readable_input))

    if negates_search:
        goal = re.sub(r"^(?:请|麻烦(?:你)?|帮我)\s*", "", readable_input).strip()
        goal = goal.replace("一下", "", 1).strip() or "回答用户的解释请求"
        return _base_plan(
            decision="respond",
            goal=goal,
            normalized_query="",
            constraints=[],
            output_focus="直接给出清晰、易理解的解释",
            clarification_question="",
            confidence=0.65,
            generated_by="rule_fallback",
        )

    query = _contextual_query(readable_input, query, recent_context)
    substantive_query = _NON_SUBSTANTIVE_QUERY_RE.sub(" ", query)
    substantive_query = re.sub(r"[^A-Za-z0-9\u4e00-\u9fff]+", "", substantive_query)
    has_substantive_query = len(substantive_query) >= 2

    if query and has_substantive_query:
        return _base_plan(
            decision="search",
            goal=f"查找与“{query}”相关的学习内容",
            normalized_query=query,
            constraints=[],
            output_focus="优先整理相关性高、适合学习的内容",
            clarification_question="",
            confidence=0.55,
            generated_by="rule_fallback",
        )

    return _base_plan(
        decision="clarify",
        goal="确认用户希望查找或了解的具体主题",
        normalized_query="",
        constraints=[],
        output_focus="补充主题和期望的资料类型",
        clarification_question="你希望查找或了解哪个具体主题？也可以补充语言、难度或资料类型。",
        confidence=0.2,
        generated_by="rule_fallback",
    )


def _extract_json_objects(text: str) -> list[dict[str, Any]]:
    raw = text.strip()
    if not raw:
        return []

    candidates = [raw]
    candidates.extend(match.group(1).strip() for match in re.finditer(r"```(?:json)?\s*(.*?)```", raw, re.I | re.S))
    decoder = json.JSONDecoder()
    results: list[dict[str, Any]] = []
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                results.append(parsed)
        except json.JSONDecodeError:
            pass
        cursor = 0
        while len(results) < 20:
            start = candidate.find("{", cursor)
            if start < 0:
                break
            try:
                parsed, consumed = decoder.raw_decode(candidate[start:])
            except json.JSONDecodeError:
                cursor = start + 1
                continue
            if isinstance(parsed, dict):
                results.append(parsed)
            cursor = start + max(consumed, 1)
    return results[:20]


def _intent_prompt(input_text: str, recent_context: list[str] | None = None) -> str:
    schema_fields = [
        "decision",
        "goal",
        "normalized_query",
        "constraints",
        "output_focus",
        "clarification_question",
        "confidence",
    ]
    recent_queries = _recent_query_values(recent_context) if _uses_recent_topic(input_text) else []
    return (
        "你是学习伙伴的浏览器检索词优化器。用户已经明确选择了资料检索模式。\n"
        "只返回一个 JSON 对象，不要输出 Markdown、解释或思维过程。\n"
        "只要当前话语或近期检索能确定主题，decision 必须是 search；不要采访用户，不要改成 respond。\n"
        "仅当当前话语完全没有可搜索主题且近期检索也为空时使用 clarify。用户明确说不要搜索时才可使用 respond。\n"
        "近期检索只用于理解‘继续、再找、简单点’等承接表达，不得覆盖用户本轮明确提出的新主题。\n"
        "normalized_query 必须是一行、最多 100 字符的搜索关键词，不得包含脚本、本机命令或用户指令冗余。\n"
        "clarify 必须给出一个具体 clarification_question；respond 和 clarify 的 normalized_query 必须为空。\n"
        f"JSON 字段必须且只能为：{json.dumps(schema_fields, ensure_ascii=False)}。confidence 为 0 到 1 的数字。\n"
        f"RECENT_SEARCH_QUERIES={json.dumps(recent_queries, ensure_ascii=False)}\n"
        f"USER_INPUT={json.dumps(_clean_display_text(input_text, limit=500), ensure_ascii=False)}"
    )


async def _collect_model_text(prompt: str, stream_llm: StreamLLM) -> tuple[str, bool]:
    chunks: list[str] = []
    total_length = 0
    unusable = False
    try:
        async for event in stream_llm(prompt, mode="general"):
            content = ""
            if isinstance(event, str):
                content = event
            elif not isinstance(event, tuple) or len(event) != 2:
                unusable = True
                continue
            else:
                event_type, payload = event
                payload = payload if isinstance(payload, dict) else {}
                if event_type == "text":
                    raw_content = payload.get("content")
                    content = raw_content if isinstance(raw_content, str) else ""
                elif event_type == "error":
                    unusable = True
                elif event_type == "done" and (
                    payload.get("fallback") is True or payload.get("produced") is False
                ):
                    unusable = True

            if content:
                remaining = MAX_MODEL_TEXT_LENGTH - total_length
                if len(content) > remaining:
                    chunks.append(content[:remaining])
                    unusable = True
                    break
                chunks.append(content)
                total_length += len(content)
    except Exception:
        return "", True
    return "".join(chunks).strip(), unusable


def _normalize_llm_plan(parsed: dict[str, Any]) -> dict[str, Any] | None:
    required = {
        "decision",
        "goal",
        "normalized_query",
        "constraints",
        "output_focus",
        "clarification_question",
        "confidence",
    }
    if not required.issubset(parsed):
        return None

    decision = parsed.get("decision")
    if decision not in VALID_DECISIONS:
        return None
    if not all(
        isinstance(parsed.get(field), str)
        for field in ("goal", "normalized_query", "output_focus", "clarification_question")
    ):
        return None
    if not isinstance(parsed.get("constraints"), list):
        return None

    goal = _clean_display_text(parsed.get("goal"))
    output_focus = _clean_display_text(parsed.get("output_focus"))
    clarification_question = _clean_display_text(parsed.get("clarification_question"))
    if not goal:
        return None

    if decision == "search":
        normalized_query = normalize_search_query(parsed.get("normalized_query"))
        if not normalized_query:
            return None
        clarification_question = ""
    else:
        normalized_query = ""
        if decision == "clarify" and not clarification_question:
            return None
        if decision == "respond":
            clarification_question = ""

    confidence = _safe_confidence(parsed.get("confidence"))
    if confidence is None:
        return None

    return _base_plan(
        decision=decision,
        goal=goal,
        normalized_query=normalized_query,
        constraints=_clean_string_list(parsed.get("constraints")),
        output_focus=output_focus,
        clarification_question=clarification_question,
        confidence=confidence,
        generated_by="llm",
    )


async def plan_search_intent(
    input_text: str,
    stream_llm: StreamLLM,
    recent_context: list[str] | None = None,
) -> dict[str, Any]:
    """让模型优化浏览器检索词；只有无主题或明确拒绝搜索时才不执行。"""

    prompt = _intent_prompt(input_text, recent_context)
    model_text, unusable = await _collect_model_text(prompt, stream_llm)
    parsed_candidates = [] if unusable else _extract_json_objects(model_text)
    negates_search = bool(_NEGATED_SEARCH_RE.search(input_text))
    for parsed in parsed_candidates:
        normalized = _normalize_llm_plan(parsed)
        if normalized is None:
            continue
        if negates_search:
            if normalized["decision"] == "respond":
                return normalized
            continue
        if normalized["decision"] == "search" and _llm_query_matches_request(
            input_text,
            normalized["normalized_query"],
            recent_context,
        ):
            return normalized
    return _rule_fallback_plan(input_text, recent_context)
