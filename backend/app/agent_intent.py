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
_RESOURCE_MARKER_RE = re.compile(r"学习资料|教程|课程|资源|文献|论文|链接|网址|书籍|视频")
_SEARCH_QUALIFIER_RE = re.compile(r"推荐|最新")
_RESPOND_MARKER_RE = re.compile(r"解释|讲解|说明|是什么|什么意思|为什么|怎么理解|如何理解|有何区别|区别是什么")
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
        text = re.sub(r"^关于\s*", "", text).strip()

    text = _GENERIC_QUERY_SUFFIX_RE.sub("", text).strip(" ，,。；;：:")
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


def _rule_fallback_plan(input_text: str) -> dict[str, Any]:
    readable_input = _clean_display_text(input_text, limit=500)
    query = normalize_search_query(readable_input)
    requests_explanation = bool(_RESPOND_MARKER_RE.search(readable_input))
    negates_search = bool(_NEGATED_SEARCH_RE.search(readable_input))

    if requests_explanation or negates_search:
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

    substantive_query = _NON_SUBSTANTIVE_QUERY_RE.sub(" ", query)
    substantive_query = re.sub(r"[^A-Za-z0-9\u4e00-\u9fff]+", "", substantive_query)
    has_substantive_query = len(substantive_query) >= 2
    has_explicit_search_command = bool(
        _CONTEXTUAL_SEARCH_COMMAND_RE.search(readable_input) or _BARE_SEARCH_COMMAND_RE.search(readable_input)
    )
    asks_for_search = has_explicit_search_command or (
        has_substantive_query
        and bool(_RESOURCE_MARKER_RE.search(readable_input) or _SEARCH_QUALIFIER_RE.search(readable_input))
    )

    if asks_for_search and query and has_substantive_query:
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


def _intent_prompt(input_text: str) -> str:
    schema_fields = [
        "decision",
        "goal",
        "normalized_query",
        "constraints",
        "output_focus",
        "clarification_question",
        "confidence",
    ]
    return (
        "你是学习伙伴的搜索意图规划器。判断用户请求应当联网搜索、追问澄清，还是直接回答。\n"
        "只返回一个 JSON 对象，不要输出 Markdown、解释或思维过程。\n"
        "decision 只能是 search、clarify、respond；只有 search 可以填写 normalized_query。\n"
        "normalized_query 必须是一行、最多 100 字符的搜索关键词，不得包含脚本、本机命令或用户指令冗余。\n"
        "clarify 必须给出一个具体 clarification_question；respond 和 clarify 的 normalized_query 必须为空。\n"
        f"JSON 字段必须且只能为：{json.dumps(schema_fields, ensure_ascii=False)}。confidence 为 0 到 1 的数字。\n"
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


async def plan_search_intent(input_text: str, stream_llm: StreamLLM) -> dict[str, Any]:
    """先让模型输出结构化规划；任何不可用情况都进行确定性规则降级。"""

    prompt = _intent_prompt(input_text)
    model_text, unusable = await _collect_model_text(prompt, stream_llm)
    parsed_candidates = [] if unusable else _extract_json_objects(model_text)
    for parsed in parsed_candidates:
        normalized = _normalize_llm_plan(parsed)
        if normalized is not None:
            return normalized
    return _rule_fallback_plan(input_text)
