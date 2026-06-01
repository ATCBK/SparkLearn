"""讯飞智文 PPT 客户端统一封装

基于 BaseAPIClient 提供统一的错误处理、重试和日志。
"""

import asyncio
import base64
import hashlib
import hmac
import logging
import time
from typing import Any
from urllib.parse import quote

import httpx

from ..api_client import BaseAPIClient
from ..api_errors import APIAuthError, APIError, APITimeoutError
from ..config import settings

logger = logging.getLogger("api.ppt")


class PPTClient(BaseAPIClient):
    """讯飞智文 PPT 客户端"""

    service_name = "xfyun_ppt"
    timeout = 60
    max_retries = 2

    def _headers(self) -> dict[str, str]:
        app_id = settings.xfyun_zw_app_id.strip()
        secret = settings.xfyun_zw_api_secret.strip()
        if not app_id or not secret:
            raise APIAuthError(self.service_name, "讯飞智文配置缺失，请设置 xfyun_zw_app_id / xfyun_zw_api_secret")

        ts = str(int(time.time()))
        md5_text = hashlib.md5(f"{app_id}{ts}".encode("utf-8")).hexdigest()
        sign = base64.b64encode(
            hmac.new(secret.encode("utf-8"), md5_text.encode("utf-8"), hashlib.sha1).digest()
        ).decode("utf-8")
        return {"appId": app_id, "timestamp": ts, "signature": sign}

    async def create_ppt(
        self,
        *,
        query: str,
        language: str = "cn",
        search: bool = False,
        is_figure: bool = False,
        ai_image: str = "normal",
    ) -> dict[str, Any]:
        url = f"{settings.xfyun_zw_base_url.rstrip('/')}/api/ppt/v2/create"
        data = {
            "query": query,
            "language": language,
            "search": "true" if search else "false",
            "isFigure": "true" if is_figure else "false",
            "aiImage": ai_image,
            "author": settings.xfyun_zw_ppt_author,
        }

        resp = await self._request_with_retry("POST", url, headers=self._headers(), data=data)
        payload = resp.json()

        if not payload.get("flag", False):
            raise APIError(self.service_name, f"创建失败: code={payload.get('code')} desc={payload.get('desc')}")

        result = payload.get("data") or {}
        sid = str(result.get("sid") or "").strip()
        if not sid:
            raise APIError(self.service_name, "创建返回缺少 sid")

        logger.info("[%s] PPT 创建成功 sid=%s", self.service_name, sid)
        return result

    async def wait_progress(self, sid: str) -> dict[str, Any]:
        url = f"{settings.xfyun_zw_base_url.rstrip('/')}/api/ppt/v2/progress?sid={quote(sid)}"
        deadline = time.time() + max(30, int(settings.xfyun_zw_timeout_sec))
        last_data: dict[str, Any] = {}

        async with httpx.AsyncClient(timeout=45.0) as client:
            while time.time() < deadline:
                try:
                    resp = await client.get(url, headers=self._headers())
                    resp.raise_for_status()
                except httpx.TimeoutException:
                    logger.warning("[%s] 进度查询超时，重试...", self.service_name)
                    await asyncio.sleep(2)
                    continue
                except httpx.HTTPStatusError as ex:
                    raise APIError(self.service_name, f"进度查询 HTTP 错误: {ex.response.status_code}") from ex

                payload = resp.json()
                if not payload.get("flag", False):
                    raise APIError(self.service_name, f"进度查询失败: code={payload.get('code')} desc={payload.get('desc')}")

                data = payload.get("data") or {}
                last_data = data
                status = str(data.get("pptStatus") or "").lower()

                if status == "done" and str(data.get("pptUrl") or "").strip():
                    logger.info("[%s] PPT 生成完成 sid=%s", self.service_name, sid)
                    return data
                if status in {"build_failed", "failed"}:
                    raise APIError(self.service_name, f"PPT 生成失败: {data.get('errMsg') or 'unknown'}")

                await asyncio.sleep(3)

        raise APITimeoutError(self.service_name, settings.xfyun_zw_timeout_sec)


ppt_client = PPTClient()
