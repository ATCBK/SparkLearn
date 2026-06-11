"""OpenAI 兼容 API 视频脚本生成客户端统一封装

基于 BaseAPIClient 提供统一的错误处理、重试和日志。
"""

import json
import logging
from typing import Any

import httpx

from ..api_client import BaseAPIClient
from ..api_errors import APIAuthError, APIError
from ..config import settings

logger = logging.getLogger("api.video_ai")


class VideoAIClient(BaseAPIClient):
    """OpenAI 兼容 API 客户端（用于视频脚本生成）"""

    service_name = "video_ai"
    timeout = 45
    max_retries = 2

    def _get_headers(self) -> dict[str, str]:
        api_key = settings.video_ai_api_key.strip()
        if not api_key:
            raise APIAuthError(self.service_name, "Video AI API Key 未配置")
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _get_url(self) -> str:
        base = settings.video_ai_base_url.rstrip("/")
        path = settings.video_ai_chat_path
        return f"{base}{path}"

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        *,
        model: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> dict[str, Any]:
        """发送聊天补全请求"""
        url = self._get_url()
        body = {
            "model": model or settings.video_ai_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        resp = await self._request_with_retry(
            "POST", url, headers=self._get_headers(), json=body, timeout=self.timeout
        )
        return resp.json()

    async def generate_script(
        self,
        prompt: str,
        *,
        style_guidance: str = "",
        target_level: str = "beginner",
        duration_sec: int = 90,
    ) -> str:
        """生成视频脚本文本"""
        system_msg = (
            "你是一个专业的教学视频脚本撰写助手。"
            "请根据用户的要求生成结构化的视频脚本。"
        )
        if style_guidance:
            system_msg += f"\n\n风格要求：{style_guidance}"

        user_msg = (
            f"请为以下主题撰写一个 {duration_sec} 秒的教学视频脚本：\n\n"
            f"{prompt}\n\n"
            f"目标受众水平：{target_level}\n"
            "请用 JSON 数组格式输出，每个元素包含 slide_type、title、content、narration 字段。"
        )

        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ]

        result = await self.chat_completion(messages)

        # 提取回复文本
        choices = result.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
        return ""


video_ai_client = VideoAIClient()
