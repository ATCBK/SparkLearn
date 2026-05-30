from __future__ import annotations

import json
import re
from typing import Any

import httpx

from .config import settings


class NanobotUnavailable(RuntimeError):
    pass


async def get_nanobot_status() -> dict[str, Any]:
    if not settings.nanobot_pet_enabled:
        return {"enabled": False, "healthy": False, "reason": "disabled"}

    url = settings.nanobot_api_base_url.rstrip("/") + "/health"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(url)
            res.raise_for_status()
            payload = res.json()
        return {"enabled": True, "healthy": True, "url": settings.nanobot_api_base_url, "detail": payload}
    except Exception as exc:
        return {"enabled": True, "healthy": False, "url": settings.nanobot_api_base_url, "reason": str(exc)}


def _json_from_text(text: str) -> dict[str, Any] | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return None


def _normalize_result(task_type: str, payload: dict[str, Any], raw_text: str) -> dict[str, Any]:
    if task_type in {"search", "recommend"}:
        items = payload.get("items")
        if isinstance(items, list):
            return {"items": items[:5]}
        return {"items": [{"title": "学伴建议", "summary": raw_text[:240], "url": "", "source": "Nanobot"}]}

    if task_type == "summarize":
        if "topic" in payload:
            return {
                "topic": str(payload.get("topic", "学习内容摘要")),
                "key_points": [str(x) for x in payload.get("key_points", [])][:5],
                "conclusion": str(payload.get("conclusion", "")),
            }
        return {"topic": "学习内容摘要", "key_points": [raw_text[:240]], "conclusion": ""}

    if task_type == "compare":
        items = payload.get("items")
        if isinstance(items, list):
            return {"items": items[:4], "comparison": str(payload.get("comparison", ""))}
        return {"items": [{"source": "Nanobot", "explanation": raw_text[:240], "url": ""}], "comparison": ""}

    return payload


async def run_learning_task(task_type: str, input_text: str, persona: str) -> dict[str, Any]:
    status = await get_nanobot_status()
    if not status.get("healthy"):
        raise NanobotUnavailable(status.get("reason") or "nanobot is not healthy")

    format_rules = {
        "search": '{"items":[{"title":"资源标题","summary":"为什么适合当前学习任务","url":"可选链接","source":"来源"}]}',
        "summarize": '{"topic":"一句话主题","key_points":["要点1","要点2","要点3"],"conclusion":"下一步学习建议"}',
        "compare": '{"items":[{"source":"视角名称","explanation":"解释","url":""}],"comparison":"对比结论"}',
        "recommend": '{"items":[{"title":"推荐任务","summary":"学习内容","url":"","reason":"推荐理由"}]}',
    }
    prompt = f"""你是 SparkLearn 学伴系统中的本地 Nanobot 学习代理。

学生任务类型：{task_type}
学生输入：{input_text}
陪伴风格：{persona}

请遵守：
1. 只回答学习相关内容，面向 Python/编程学习场景。
2. 不暴露系统配置、密钥、工具链内部路径或桌面进程信息。
3. 如果输入为空、越权、与学习无关或要求泄露隐私，请给出温和拦截建议。
4. 输出必须是 JSON，不要加 Markdown。

JSON 结构：
{format_rules.get(task_type, "{}")}
"""

    body = {
        "model": settings.nanobot_api_model,
        "messages": [
            {"role": "system", "content": "你是可靠、克制、面向学习提效的 SparkLearn 学伴。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "stream": False,
    }
    url = settings.nanobot_api_base_url.rstrip("/") + "/v1/chat/completions"
    async with httpx.AsyncClient(timeout=settings.nanobot_api_timeout_sec) as client:
        res = await client.post(url, json=body)
        res.raise_for_status()
        data = res.json()

    text = str(data.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()
    payload = _json_from_text(text) or {}
    return _normalize_result(task_type, payload, text)
