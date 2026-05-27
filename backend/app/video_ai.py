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


def _style_content_guidance(style_id: str) -> str:
    """Generate per-style content guidance for the AI prompt.

    Five dimensions: wording, metaphor, visual, code, hook.
    Eight quality rules apply universally.
    """
    guidance_map = {
        "apple-minimal": (
            "【措辞】简洁克制，每页不超过3个要点，用「我们」拉近距离。"
            "【隐喻】用「工具箱」「流水线」「开关」等工业设计类比喻。"
            "【视觉】白底大图，文字极简，留白充足，强调单一焦点。"
            "【代码】展示最小可行示例，不展开无关细节。"
            "【引入】从一个具体的任务场景直接切入，不铺垫。"
        ),
        "dark-tech": (
            "【措辞】直接、技术化，可用「注意」「关键」「核心」等强调词。"
            "【隐喻】用「引擎」「管线」「信号」「堆栈」等工程隐喻。"
            "【视觉】深色终端风格，代码是主角，注释用亮色标注。"
            "【代码】展开关键实现细节，配合行内注释逐步解析。"
            "【引入】从一段输出结果或错误信息倒推原理。"
        ),
        "warm-education": (
            "【措辞】像老师一对一辅导，用「别担心」「慢慢来」「很好，你已经……」等鼓励语。"
            "【隐喻】用「做菜」「搭积木」「寄快递」等生活化类比。"
            "【视觉】暖色卡片，圆角按钮，步骤用大数字标记。"
            "【代码】先给完整可运行的小例子，再逐步解释每一行。"
            "【引入】先说「你是不是经常遇到这个问题？」唤醒共鸣。"
        ),
        "business-pro": (
            "【措辞】正式、结构化，用「我们将……」「关键结论」「落地建议」等商务用语。"
            "【隐喻】用「供应链」「决策树」「仪表盘」等管理类比喻。"
            "【视觉】深蓝专业感，数据用图表呈现，逻辑用箭头连接。"
            "【代码】强调工程最佳实践、性能考量、可维护性。"
            "【引入】先展示业务场景和KPI目标,再引出技术方案。"
        ),
        "cartoon-playful": (
            "【措辞】活泼、拟人化，用「小变量」「函数小助手」「循环大冒险」等角色化表达。"
            "【隐喻】用「魔法咒语」「探险地图」「通关秘籍」等游戏化类比。"
            "【视觉】多彩渐变背景，大圆角气泡卡片，表情符号点缀。"
            "【代码】用故事串联代码片段，每一步都是「关卡」。"
            "【引入】「嘿！准备好今天的编程冒险了吗？」"
        ),
        "academic": (
            "【措辞】严谨、定义先行，用「根据……」「定理」「推论」等学术用语。"
            "【隐喻】用数学归纳、逻辑推导替代类比，保持知识密度。"
            "【视觉】米色学术底色，衬线字体标题，公式居中对齐。"
            "【代码】先给形式化定义，再给具体实现，最后分析复杂度。"
            "【引入】「我们先回顾一下前置知识……」建立知识锚点。"
        ),
    }
    return guidance_map.get(style_id, guidance_map["apple-minimal"])


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
    if not settings.video_ai_base_url or not settings.video_ai_base_url.startswith("http"):
        raise VideoAIScriptError("未配置视频 AI 服务商地址，请在后台设置中配置 OpenAI 兼容接口或 Agent 地址。")
    if not settings.video_ai_api_key:
        raise VideoAIScriptError("API 认证失败，请检查后台配置的 API Key 是否有效。")
    if not settings.video_ai_model:
        raise VideoAIScriptError("未配置 AI 模型名称，请在后台设置中指定模型。")

    base_url = settings.video_ai_base_url.rstrip("/")
    chat_path = "/" + settings.video_ai_chat_path.strip("/")
    url = f"{base_url}{chat_path}"

    # Dynamic timeout & token budget: longer videos need more time and output tokens.
    dynamic_timeout = max(settings.video_ai_timeout_sec, int(duration_sec * 1.2))
    dynamic_max_tokens = max(settings.video_ai_max_tokens, int(settings.video_ai_max_tokens * (duration_sec / 60)))

    payload = {
        "model": settings.video_ai_model,
        "temperature": settings.video_ai_temperature,
        "max_tokens": dynamic_max_tokens,
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
    try:
        with httpx.Client(timeout=dynamic_timeout) as client:
            response = client.post(url, headers=headers, json=payload)
            if response.status_code >= 400:
                payload.pop("response_format", None)
                response = client.post(url, headers=headers, json=payload)
            response.raise_for_status()
    except httpx.TimeoutException:
        raise VideoAIScriptError(
            f"AI 模型调用超时（{dynamic_timeout} 秒），视频时长越长脚本越复杂，可考虑缩短视频时长或更换更快的模型重试。"
        )
    except httpx.HTTPStatusError as ex:
        status = ex.response.status_code
        if status == 401 or status == 403:
            raise VideoAIScriptError("API 认证失败，请检查后台配置的 API Key 是否有效。")
        if status == 429:
            raise VideoAIScriptError("API 请求过于频繁，请稍后重试。")
        if status >= 500:
            raise VideoAIScriptError(f"AI 服务暂时不可用（{status}），请稍后重试。")
        raise VideoAIScriptError(f"AI 调用失败（HTTP {status}），请检查服务配置。")
    except httpx.ConnectError:
        raise VideoAIScriptError(
            f"无法连接到 AI 服务 ({base_url})，请检查网络连接和服务地址是否正确。"
        )
    except httpx.RequestError as ex:
        raise VideoAIScriptError(f"AI 服务请求失败：{ex}")

    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    try:
        return _loads_json_object(content)
    except VideoAIScriptError:
        raise
    except Exception as ex:
        raise VideoAIScriptError(f"AI 返回内容解析失败：{ex}")


def _call_agent_http(prompt: str, duration_sec: int, target_level: str, style: str) -> dict[str, Any]:
    if not settings.video_ai_agent_url:
        raise VideoAIScriptError("未配置视频 AI Agent 地址，请在后台设置中配置 Agent HTTP 地址。")

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
    try:
        with httpx.Client(timeout=settings.video_ai_timeout_sec) as client:
            response = client.post(settings.video_ai_agent_url, headers=headers, json=payload)
            response.raise_for_status()
    except httpx.TimeoutException:
        raise VideoAIScriptError(
            f"Agent 调用超时（{settings.video_ai_timeout_sec} 秒），请稍后重试或检查 Agent 服务状态。"
        )
    except httpx.HTTPStatusError as ex:
        status = ex.response.status_code
        if status == 401 or status == 403:
            raise VideoAIScriptError("Agent 认证失败，请检查后台配置的 Agent Token 是否有效。")
        if status >= 500:
            raise VideoAIScriptError(f"Agent 服务暂时不可用（{status}），请稍后重试。")
        raise VideoAIScriptError(f"Agent 调用失败（HTTP {status}），请检查服务配置。")
    except httpx.ConnectError:
        raise VideoAIScriptError(
            f"无法连接到 Agent 服务 ({settings.video_ai_agent_url})，请检查网络连接和服务地址。"
        )
    except httpx.RequestError as ex:
        raise VideoAIScriptError(f"Agent 服务请求失败：{ex}")

    try:
        return _loads_json_object(response.text)
    except VideoAIScriptError:
        raise
    except Exception as ex:
        raise VideoAIScriptError(f"Agent 返回内容解析失败：{ex}")


def _script_prompt(prompt: str, duration_sec: int, target_level: str, style: str) -> str:
    slide_types = expected_slide_types(duration_sec)
    style_guidance = _style_content_guidance(style)
    return json.dumps(
        {
            "task": "根据用户主题生成动态微课视频脚本，严格按照风格指引撰写每一页内容。",
            "topic": prompt,
            "duration_sec": duration_sec,
            "target_level": target_level,
            "style": style,
            "style_guidance": style_guidance,
            "required_slide_types": slide_types,
            "output_language": "zh-CN",
            "contract": _schema_contract(),
            "quality_rules": [
                "PPT 展示文字必须短，讲稿 narration 必须比 PPT 文案更完整。",
                "每页内容必须贴合 topic，不能写通用空话。",
                "code 页如主题不适合代码，可给最小案例、公式或伪代码。",
                "quiz 页必须给 interaction 和 answer。",
                "mistake 页必须给 mistake 和 answer。",
                "措辞和语调必须严格遵循 style_guidance 中的指引。",
                "比喻和视觉描述必须与风格一致，不同风格产出应明显不同。",
                "代码示例的风格和复杂度必须匹配目标难度级别。",
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
