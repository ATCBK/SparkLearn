import json
from typing import Any, AsyncGenerator

import httpx

from .config import settings
from .video_memory_service import search, get_memory, MemoryNotFoundError


SYSTEM_PROMPT = """你是一位AI学习伴侣。根据以下视频内容回答用户问题。

视频标题：{video_title}

相关视频片段：
{segment_contexts}

对话规则：
1. 如果视频内容覆盖了用户的问题，请基于视频内容准确回答
2. 如果视频内容没有覆盖到用户的问题，请诚实说明"这个问题视频中没有讲到，但据我所知……"
3. 回答要简洁、友好，像一位学习伙伴，控制在150字以内
4. 使用中文回答"""


async def chat_stream(
    memory_id: str,
    message: str,
    history: list[dict[str, str]],
) -> AsyncGenerator[tuple[str, dict[str, Any]], None]:
    memory_info = get_memory(memory_id)
    if not memory_info:
        yield ("error", {"code": "NP_MEMORY_NOT_FOUND", "message": "记忆已过期，请重新选择视频"})
        return

    try:
        segments = search(memory_id, message, top_k=3)
    except MemoryNotFoundError:
        yield ("error", {"code": "NP_MEMORY_NOT_FOUND", "message": "记忆已过期，请重新选择视频"})
        return
    except Exception:
        yield ("error", {"code": "NP_RETRIEVE_FAILED", "message": "视频内容检索失败"})
        return

    # Build segment context string
    contexts = []
    for i, seg in enumerate(segments):
        contexts.append(f"{i + 1}. [{seg['segment_id']}] {seg['title']}\n   {seg['narration']}")
    segment_text = "\n\n".join(contexts) if contexts else "（暂无相关视频片段）"

    system_prompt = SYSTEM_PROMPT.format(
        video_title=memory_info["video_title"],
        segment_contexts=segment_text,
    )

    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-10:]:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": message})

    try:
        async for token_data in _stream_llm(messages):
            yield token_data
    except Exception as e:
        yield ("error", {"code": "NP_LLM_FAILED", "message": f"对话生成失败: {str(e)}"})


async def _stream_llm(messages: list[dict[str, str]]) -> AsyncGenerator[tuple[str, dict[str, Any]], None]:
    base_url = settings.video_ai_base_url.rstrip("/")
    chat_path = "/" + settings.video_ai_chat_path.strip("/")
    url = f"{base_url}{chat_path}"

    headers = {
        "Authorization": f"Bearer {settings.video_ai_api_key}",
        "Content-Type": "application/json",
    }

    # Prefer qwen-plus for chat if configured; fall back to video model
    model = getattr(settings, "video_ai_chat_model", None) or settings.video_ai_model

    payload = {
        "model": model,
        "temperature": 0.7,
        "max_tokens": min(settings.video_ai_max_tokens, 1024),
        "messages": messages,
        "stream": True,
    }

    total_tokens = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            if response.status_code >= 400:
                error_text = await response.aread()
                raise Exception(f"LLM API error ({response.status_code}): {error_text.decode()[:200]}")

            async for line in response.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data_str = line[6:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        total_tokens += 1
                        yield ("token", {"text": content})
                except (json.JSONDecodeError, KeyError):
                    continue

    yield ("done", {"total_tokens": total_tokens})
