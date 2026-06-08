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


def generate_local_video_script(
    prompt: str,
    duration_sec: int,
    target_level: str,
    style: str,
) -> dict[str, Any]:
    slide_types = expected_slide_types(duration_sec)
    keywords = _extract_keywords(prompt)
    topic = keywords[0] if keywords else prompt.strip() or "视频主题"
    style_label = _style_label(style)
    segment_duration = max(7000, int(duration_sec * 1000 / max(1, len(slide_types))))
    outline: list[dict[str, Any]] = []

    for idx, slide_type in enumerate(slide_types, start=1):
        focus = keywords[(idx - 1) % len(keywords)] if keywords else topic
        outline.append(
            _local_slide_segment(
                idx=idx,
                slide_type=slide_type,
                prompt=prompt,
                topic=topic,
                focus=focus,
                target_level=target_level,
                style_label=style_label,
                duration_ms=segment_duration,
            )
        )

    return {
        "title": _make_local_title(prompt, topic),
        "polished_prompt": (
            f"使用{style_label}风格，面向{target_level}学习者，用通俗语言讲清楚「{prompt.strip() or topic}」，"
            f"控制在 {duration_sec} 秒左右，突出关键概念、例子、常见错误和总结。"
        ),
        "script_outline": outline,
        "content_source": "local_fallback",
        "ai_provider": "local_fallback",
        "ai_model": "",
    }


def expected_slide_types(duration_sec: int) -> list[str]:
    if duration_sec < 60:
        return ["cover", "hook", "concept", "code", "summary"]
    if duration_sec < 120:
        return SLIDE_TYPES_FULL[:8] + ["summary"]
    return SLIDE_TYPES_FULL[:]


def _extract_keywords(prompt: str) -> list[str]:
    tokens = re.findall(r"[A-Za-z0-9_]+|[\u4e00-\u9fff]{2,}", prompt or "")
    keywords: list[str] = []
    for token in tokens:
        cleaned = token.strip()
        if not cleaned:
            continue
        if cleaned not in keywords:
            keywords.append(cleaned)
    return keywords[:6]


def _style_label(style: str) -> str:
    return {
        "apple-minimal": "简洁讲解",
        "dark-tech": "技术深色",
        "warm-education": "温暖教学",
        "business-pro": "商务专业",
        "cartoon-playful": "轻松卡通",
        "academic": "学术风格",
    }.get(style, style or "默认")


def _local_code_sample(topic: str, focus: str) -> str:
    lower = f"{topic} {focus}".lower()
    if "变量" in topic or "variable" in lower:
        return 'score = 95\nname = "SparkLearn"\nprint(name, score)'
    if "函数" in topic or "function" in lower:
        return 'def greet(name):\n    return f"Hello, {name}"\n\nprint(greet("Ada"))'
    if "循环" in topic or "loop" in lower:
        return 'total = 0\nfor n in [1, 2, 3]:\n    total += n\nprint(total)'
    if "列表" in topic or "list" in lower:
        return 'items = ["A", "B", "C"]\nitems.append("D")\nprint(items)'
    return '# 最小示例\nidea = "先理解问题，再写代码"\nprint(idea)'


def _make_local_title(prompt: str, topic: str) -> str:
    text = re.sub(r"\s+", " ", prompt).strip(" ，。,.") or topic
    return text if len(text) <= 18 else text[:18] + "..."


def _local_slide_segment(
    *,
    idx: int,
    slide_type: str,
    prompt: str,
    topic: str,
    focus: str,
    target_level: str,
    style_label: str,
    duration_ms: int,
) -> dict[str, Any]:
    level_note = {
        "beginner": "从最基础的概念开始讲。",
        "intermediate": "默认听众已经有一点基础，重点讲清连接关系。",
        "advanced": "直接讲核心机制、边界与实践建议。",
    }.get(target_level, "从基础到应用逐步展开。")

    if slide_type == "cover":
        return {
            "slide_type": "cover",
            "title": topic,
            "subtitle": f"{style_label} · {level_note}",
            "slide_text": [topic, "先讲清概念，再给出例子"],
            "narration": f"今天我们用{style_label}风格，围绕「{topic}」展开讲解，先建立整体印象，再逐步拆解重点。",
            "visual_hint": f"封面突出 {topic}，辅以简洁图标和关键词。",
            "teacher_note": "先抛出学习目标，降低理解门槛。",
            "interaction": "",
            "code": "",
            "mistake": "",
            "answer": "",
            "duration_ms": duration_ms,
        }
    if slide_type == "goals":
        return {
            "slide_type": "goals",
            "title": f"学会 {topic}",
            "subtitle": "先知道这节课要解决什么",
            "slide_text": [f"理解 {focus}", "掌握基本用法", "知道常见错误"],
            "narration": f"这一部分先说明学习目标：我们要理解 {focus}，并把它和实际场景联系起来。",
            "visual_hint": "用清单式卡片展示学习目标。",
            "teacher_note": "把复杂任务拆成三个可完成的小目标。",
            "interaction": "",
            "code": "",
            "mistake": "",
            "answer": "",
            "duration_ms": duration_ms,
        }
    if slide_type == "hook":
        return {
            "slide_type": "hook",
            "title": "先想一想",
            "subtitle": f"如果要解释 {focus}，你会怎么说？",
            "slide_text": [f"为什么 {focus} 很重要？"],
            "narration": f"先不要急着记结论，先想一个问题：为什么 {focus} 会影响我们理解整个 {topic}？",
            "visual_hint": "用问题卡引出主题冲突。",
            "teacher_note": "通过提问制造认知张力。",
            "interaction": f"你觉得 {focus} 最容易和什么概念混淆？",
            "code": "",
            "mistake": "",
            "answer": "",
            "duration_ms": duration_ms,
        }
    if slide_type == "concept":
        return {
            "slide_type": "concept",
            "title": f"{focus} 的核心概念",
            "subtitle": "先定义，再理解作用",
            "slide_text": [f"{focus} 是什么", "它解决什么问题", "它如何工作"],
            "narration": f"{focus} 可以理解成 {topic} 的核心结构。我们先看它是什么，再看它为什么必要。",
            "visual_hint": "左侧定义，右侧配流程图。",
            "teacher_note": "把定义、作用、工作方式分开讲。",
            "interaction": "",
            "code": "",
            "mistake": "",
            "answer": "",
            "duration_ms": duration_ms,
        }
    if slide_type == "analogy":
        return {
            "slide_type": "analogy",
            "title": f"{focus} 的类比",
            "subtitle": "用生活经验理解抽象概念",
            "slide_text": [f"把 {focus} 想成一个工具箱", "每一层都有自己的职责"],
            "narration": f"我们可以把 {focus} 想成一个工具箱：不同的工具负责不同的动作，但最终都服务于 {topic}。",
            "visual_hint": "用工具箱、路线图或层级结构做类比。",
            "teacher_note": "类比只负责建立直觉，不要过度展开。",
            "interaction": "",
            "code": "",
            "mistake": "",
            "answer": "",
            "duration_ms": duration_ms,
        }
    if slide_type == "process":
        return {
            "slide_type": "process",
            "title": f"{topic} 的步骤",
            "subtitle": "按顺序理解执行过程",
            "slide_text": [
                f"1. 先识别 {focus}",
                "2. 再组织输入",
                "3. 最后得到输出",
            ],
            "narration": f"理解 {topic} 最好的方式就是看流程：先识别 {focus}，再组织输入，最后得到结果。",
            "visual_hint": "用时间轴或步骤卡片展示流程。",
            "teacher_note": "强调每一步的输入和输出。",
            "interaction": "",
            "code": "",
            "mistake": "",
            "answer": "",
            "duration_ms": duration_ms,
        }
    if slide_type == "code":
        return {
            "slide_type": "code",
            "title": f"{topic} 示例",
            "subtitle": "用一个最小代码片段说明",
            "slide_text": [f"看懂 {focus} 的最小例子", "把概念映射到代码"],
            "narration": f"接下来通过一段最小示例来说明 {focus} 在 {topic} 中到底怎么用。",
            "visual_hint": "展示高亮代码并配注释。",
            "teacher_note": "示例尽量短，避免引入太多噪音。",
            "interaction": "",
            "code": _local_code_sample(topic, focus),
            "mistake": "",
            "answer": "",
            "duration_ms": duration_ms,
        }
    if slide_type == "mistake":
        return {
            "slide_type": "mistake",
            "title": "常见误区",
            "subtitle": "先避免最常见的错误",
            "slide_text": [f"不要把 {focus} 和相似概念混淆"],
            "narration": f"学习 {topic} 时最容易犯的错，是把 {focus} 和它相近的概念混在一起。",
            "visual_hint": "左右对比错误理解与正确理解。",
            "teacher_note": "通过对比纠正直觉偏差。",
            "interaction": "",
            "code": "",
            "mistake": f"把 {focus} 当成了 {topic} 的全部。",
            "answer": f"更准确的理解是：{focus} 只是 {topic} 的一个关键组成部分。",
            "duration_ms": duration_ms,
        }
    if slide_type == "quiz":
        return {
            "slide_type": "quiz",
            "title": "快速自测",
            "subtitle": "用问题巩固记忆",
            "slide_text": [f"你能用自己的话解释 {focus} 吗？"],
            "narration": f"现在用一个小问题检查一下：你能不能用自己的话解释 {focus}？",
            "visual_hint": "用问答卡片收束知识点。",
            "teacher_note": "给学习者一个马上开口回答的机会。",
            "interaction": f"请用一句话解释 {focus} 在 {topic} 中的作用。",
            "code": "",
            "mistake": "",
            "answer": f"答案提示：{focus} 是 {topic} 中用于组织理解和行动的关键点。",
            "duration_ms": duration_ms,
        }
    return {
        "slide_type": "summary",
        "title": "总结回顾",
        "subtitle": "把今天的内容收束起来",
        "slide_text": [f"记住 {focus}", "理解流程", "回到实际场景"],
        "narration": f"最后我们回顾一下：记住 {focus}，理解整体流程，再把它放回实际场景中复习。",
        "visual_hint": "用总结卡片强调三个结论。",
        "teacher_note": "总结页只保留最重要的记忆点。",
        "interaction": "",
        "code": "",
        "mistake": "",
        "answer": "",
        "duration_ms": duration_ms,
    }


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
