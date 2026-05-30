"""DeepSeek 适配器 —— 使用 OpenAI 兼容的 HTTP API 格式调用 DeepSeek 模型。"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

import httpx

from .config import settings

logger = logging.getLogger("deepseek")


class DeepSeekAdapter:
    """通过 OpenAI 兼容接口调用 DeepSeek，支持流式输出。"""

    async def stream_chat(
        self,
        prompt: str,
        mode: str = "general",
        history: list[dict] | None = None,
        model: str = "ds-pro",
    ) -> AsyncGenerator[str, None]:
        async for event_type, payload in self.stream_chat_events(prompt, mode=mode, history=history, model=model):
            if event_type == "text":
                content = str(payload.get("content", ""))
                if content:
                    yield content

    async def stream_chat_events(
        self,
        prompt: str,
        mode: str = "general",
        history: list[dict] | None = None,
        model: str = "ds-pro",
    ) -> AsyncGenerator[tuple[str, dict], None]:
        if not settings.deepseek_api_key:
            yield ("error", {"code": -1, "message": "DeepSeek API key not configured"})
            yield ("done", {"fallback": True})
            return

        model_name = "deepseek-v4-pro" if model == "ds-pro" else "deepseek-v4-flash"
        messages: list[dict] = []
        for m in (history or [])[-20:]:
            role = m.get("role", "user")
            if role == "system":
                messages.append({"role": "system", "content": m.get("content", "")})
            elif role == "assistant":
                messages.append({"role": "assistant", "content": m.get("content", "")})
            else:
                messages.append({"role": "user", "content": m.get("content", "")})
        messages.append({"role": "user", "content": prompt})

        body = {
            "model": model_name,
            "messages": messages,
            "stream": True,
            "temperature": 0.7,
            "max_tokens": 4096,
        }

        base_url = settings.deepseek_base_url.rstrip("/")
        url = f"{base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.deepseek_api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }

        produced = False
        error_msg = ""
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream("POST", url, json=body, headers=headers) as resp:
                    if resp.status_code != 200:
                        error_text = await resp.aread()
                        error_msg = f"DeepSeek HTTP {resp.status_code}: {error_text.decode()[:200]}"
                        logger.warning(error_msg)
                        yield ("error", {"code": resp.status_code, "message": error_msg})
                    else:
                        async for line in resp.aiter_lines():
                            if not line or not line.startswith("data: "):
                                continue
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                            except json.JSONDecodeError:
                                continue
                            choices = chunk.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    produced = True
                                    yield ("text", {"content": content})
        except Exception as ex:
            error_msg = f"DeepSeek exception: {ex}"
            logger.exception("deepseek stream error")
            yield ("error", {"code": -1, "message": error_msg})

        if not produced and not error_msg:
            fallback_text = f"关于{prompt}，我来为你分析一下。"
            yield ("text", {"content": fallback_text})

        yield ("done", {"produced": produced, "fallback": not produced})
