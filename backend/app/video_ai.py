import json
import re
from typing import Any

import httpx

from .config import settings


SLIDE_TYPES_FULL = [
    "cover",
    "goals",
    "hook",
    "concept",
    "analogy",
    "process",
    "code",
    "mistake",
    "quiz",
    "summary",
]


class VideoAIScriptError(RuntimeError):
    pass


def generate_video_script_with_ai(
    prompt: str,
    duration_sec: int,
    target_level: str,
    style: str,
) -> dict[str, Any]:
    if not settings.video_ai_enabled:
        raise VideoAIScriptError("video_ai_enabled is false")

    provider = (settings.video_ai_provider or "").strip().lower()
    if provider in {"openai", "openai_compatible", "llm"}:
        raw = _call_openai_compatible(prompt, duration_sec, target_level, style)
    elif provider in {"agent", "agent_http", "webhook"}:
        raw = _call_agent_http(prompt, duration_sec, target_level, style)
    else:
        raise VideoAIScriptError(f"unsupported video_ai_provider: {settings.video_ai_provider}")

    script = _normalize_ai_script(_unwrap_script_payload(raw), prompt, duration_sec)
    script["content_source"] = "ai"
    script["ai_provider"] = settings.video_ai_provider
    script["ai_model"] = settings.video_ai_model
    return script


def expected_slide_types(duration_sec: int) -> list[str]:
    if duration_sec < 60:
        return ["cover", "hook", "concept", "code", "summary"]
    if duration_sec < 120:
        return SLIDE_TYPES_FULL[:8] + ["summary"]
    return SLIDE_TYPES_FULL[:]


def _call_openai_compatible(prompt: str, duration_sec: int, target_level: str, style: str) -> dict[str, Any]:
    if not settings.video_ai_api_key or not settings.video_ai_model:
        raise VideoAIScriptError("video_ai_api_key or video_ai_model is empty")

    base_url = settings.video_ai_base_url.rstrip("/")
    chat_path = "/" + settings.video_ai_chat_path.strip("/")
    url = f"{base_url}{chat_path}"
    payload = {
        "model": settings.video_ai_model,
        "temperature": settings.video_ai_temperature,
        "max_tokens": settings.video_ai_max_tokens,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是 SparkLearn 的教学视频脚本智能体。"
                    "只输出合法 JSON，不要输出 Markdown，不要输出解释。"
                ),
            },
            {
                "role": "user",
                "content": _script_prompt(prompt, duration_sec, target_level, style),
            },
        ],
    }
    headers = {"Authorization": f"Bearer {settings.video_ai_api_key}", "Content-Type": "application/json"}
    with httpx.Client(timeout=settings.video_ai_timeout_sec) as client:
        response = client.post(url, headers=headers, json=payload)
        if response.status_code >= 400:
            payload.pop("response_format", None)
            response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return _loads_json_object(content)


def _call_agent_http(prompt: str, duration_sec: int, target_level: str, style: str) -> dict[str, Any]:
    if not settings.video_ai_agent_url:
        raise VideoAIScriptError("video_ai_agent_url is empty")

    headers = {"Content-Type": "application/json"}
    if settings.video_ai_agent_token:
        headers["Authorization"] = f"Bearer {settings.video_ai_agent_token}"
    payload = {
        "task": "generate_video_script_outline",
        "prompt": prompt,
        "duration_sec": duration_sec,
        "target_level": target_level,
        "style": style,
        "slide_types": expected_slide_types(duration_sec),
        "schema": _schema_contract(),
    }
    with httpx.Client(timeout=settings.video_ai_timeout_sec) as client:
        response = client.post(settings.video_ai_agent_url, headers=headers, json=payload)
        response.raise_for_status()
    return _loads_json_object(response.text)


def _script_prompt(prompt: str, duration_sec: int, target_level: str, style: str) -> str:
    slide_types = expected_slide_types(duration_sec)
    return json.dumps(
        {
            "task": "根据用户主题生成动态微课视频脚本，不要复用固定模板文案。",
            "topic": prompt,
            "duration_sec": duration_sec,
            "target_level": target_level,
            "style": style,
            "required_slide_types": slide_types,
            "output_language": "zh-CN",
            "contract": _schema_contract(),
            "quality_rules": [
                "PPT 展示文字必须短，讲稿 narration 必须比 PPT 文案更完整。",
                "每页内容必须贴合 topic，不能写通用空话。",
                "code 页如主题不适合代码，可给最小案例、公式或伪代码。",
                "quiz 页必须给 interaction 和 answer。",
                "mistake 页必须给 mistake 和 answer。",
            ],
        },
        ensure_ascii=False,
        indent=2,
    )


def _schema_contract() -> dict[str, Any]:
    return {
        "type": "object",
        "required": ["title", "polished_prompt", "script_outline"],
        "properties": {
            "title": "视频标题",
            "polished_prompt": "用于记录的增强提示词",
            "script_outline": [
                {
                    "slide_type": "cover|goals|hook|concept|analogy|process|code|mistake|quiz|summary",
                    "title": "页面标题",
                    "subtitle": "页面副标题",
                    "slide_text": ["PPT 短要点 1", "PPT 短要点 2"],
                    "narration": "给 TTS 朗读的完整讲稿",
                    "visual_hint": "画面布局提示",
                    "teacher_note": "教师提示",
                    "interaction": "学习者互动问题",
                    "code": "最小代码/案例/伪代码",
                    "mistake": "常见错误理解",
                    "answer": "参考答案",
                    "duration_ms": 12000,
                }
            ],
        },
    }


def _loads_json_object(text: Any) -> dict[str, Any]:
    if isinstance(text, dict):
        return text
    if not isinstance(text, str):
        raise VideoAIScriptError("AI response is not JSON object")
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.S)
        if not match:
            raise VideoAIScriptError("AI response has no JSON object")
        data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise VideoAIScriptError("AI response root is not object")
    return data


def _unwrap_script_payload(raw: dict[str, Any]) -> dict[str, Any]:
    if "script_outline" in raw:
        return raw
    for key in ("data", "result", "output"):
        value = raw.get(key)
        if isinstance(value, dict) and "script_outline" in value:
            return value
        if isinstance(value, str):
            parsed = _loads_json_object(value)
            if "script_outline" in parsed:
                return parsed
    return raw


def _normalize_ai_script(raw: dict[str, Any], prompt: str, duration_sec: int) -> dict[str, Any]:
    outline = raw.get("script_outline")
    if not isinstance(outline, list) or not outline:
        raise VideoAIScriptError("script_outline is empty")

    slide_types = expected_slide_types(duration_sec)
    selected = outline[: len(slide_types)]
    if len(selected) < max(4, len(slide_types) - 1):
        raise VideoAIScriptError("script_outline has too few slides")

    segment_duration = max(7, int(duration_sec / len(selected)))
    normalized: list[dict[str, Any]] = []
    for idx, item in enumerate(selected, start=1):
        if not isinstance(item, dict):
            raise VideoAIScriptError(f"script_outline[{idx}] is not object")
        expected_type = slide_types[idx - 1] if idx - 1 < len(slide_types) else "concept"
        slide_type = str(item.get("slide_type") or expected_type).strip()
        if slide_type not in SLIDE_TYPES_FULL:
            slide_type = expected_type
        title = str(item.get("title") or f"第 {idx} 页").strip()
        narration = str(item.get("narration") or "").strip()
        if not narration:
            raise VideoAIScriptError(f"script_outline[{idx}] narration is empty")
        slide_text = item.get("slide_text")
        if not isinstance(slide_text, list):
            slide_text = item.get("bullets") if isinstance(item.get("bullets"), list) else []
        normalized.append(
            {
                "segment_id": f"seg_{idx:03d}",
                "slide_type": slide_type,
                "title": title,
                "subtitle": str(item.get("subtitle") or "").strip(),
                "slide_text": [str(x).strip() for x in slide_text if str(x).strip()][:5],
                "narration": narration,
                "visual_hint": str(item.get("visual_hint") or "").strip(),
                "teacher_note": str(item.get("teacher_note") or "").strip(),
                "interaction": str(item.get("interaction") or "").strip(),
                "code": str(item.get("code") or "").strip(),
                "mistake": str(item.get("mistake") or "").strip(),
                "answer": str(item.get("answer") or "").strip(),
                "duration_ms": _coerce_duration_ms(item.get("duration_ms"), segment_duration),
            }
        )

    return {
        "title": str(raw.get("title") or _make_title(prompt)).strip(),
        "polished_prompt": str(raw.get("polished_prompt") or prompt).strip(),
        "script_outline": normalized,
    }


def _coerce_duration_ms(value: Any, fallback_sec: int) -> int:
    try:
        ms = int(value)
    except (TypeError, ValueError):
        ms = fallback_sec * 1000
    return max(6000, min(ms, 45000))


def _make_title(prompt: str) -> str:
    text = re.sub(r"\s+", " ", prompt).strip(" ，。,.") or "AI 讲解视频"
    return text if len(text) <= 18 else text[:18] + "..."
