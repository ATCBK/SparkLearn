"""统一外部 API 客户端基类

提供重试、日志、超时、错误处理等通用能力。
各服务客户端（Spark、Coze、TTS、PPT、VideoAI）继承此基类。
"""

import logging
import time
from typing import Any

import httpx

from .api_errors import (
    APIAuthError,
    APIConnectionError,
    APIError,
    APIRateLimitError,
    APIResponseError,
    APITimeoutError,
)

logger = logging.getLogger("api")


class BaseAPIClient:
    """外部 API 客户端基类"""

    service_name: str = "unknown"
    base_url: str = ""
    timeout: int = 30
    max_retries: int = 2

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        json: Any = None,
        data: Any = None,
        timeout: int | None = None,
    ) -> httpx.Response:
        """带重试的 HTTP 请求"""
        _timeout = timeout or self.timeout
        last_error: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            start = time.monotonic()
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(_timeout, read=_timeout * 2)) as client:
                    resp = await client.request(method, url, headers=headers, json=json, data=data)
                    elapsed = time.monotonic() - start
                    self._log_request(method, url, elapsed, resp.status_code)

                    if resp.status_code == 401:
                        raise APIAuthError(self.service_name)
                    if resp.status_code == 429:
                        raise APIRateLimitError(self.service_name)
                    if resp.status_code >= 400:
                        body = resp.text[:500]
                        raise APIResponseError(self.service_name, resp.status_code, body)

                    return resp

            except httpx.TimeoutException as ex:
                elapsed = time.monotonic() - start
                self._log_request(method, url, elapsed, "TIMEOUT")
                last_error = APITimeoutError(self.service_name, _timeout)
                if attempt < self.max_retries:
                    logger.warning("[%s] 第 %d 次请求超时，重试中...", self.service_name, attempt)
                    continue
                raise last_error from ex

            except (APIAuthError, APIRateLimitError, APIResponseError):
                raise

            except httpx.ConnectError as ex:
                elapsed = time.monotonic() - start
                self._log_request(method, url, elapsed, "CONN_ERR")
                last_error = APIConnectionError(self.service_name, str(ex))
                if attempt < self.max_retries:
                    logger.warning("[%s] 第 %d 次连接失败，重试中...", self.service_name, attempt)
                    continue
                raise last_error from ex

            except Exception as ex:
                elapsed = time.monotonic() - start
                self._log_request(method, url, elapsed, "ERR")
                raise APIError(self.service_name, str(ex)) from ex

        raise last_error or APIError(self.service_name, "未知错误")

    def _log_request(self, method: str, url: str, elapsed: float, status: Any) -> None:
        """统一请求日志"""
        logger.info(
            "[%s] %s %s -> %s (%.2fs)",
            self.service_name,
            method.upper(),
            url,
            status,
            elapsed,
        )

    def _handle_error(self, error: Exception, context: str = "") -> dict:
        """统一错误处理，返回错误字典"""
        if isinstance(error, APIError):
            logger.error("[%s] %s: %s", self.service_name, context, error)
            return {"code": error.code, "message": str(error), "service": self.service_name}
        logger.error("[%s] %s: %s", self.service_name, context, error)
        return {"code": -1, "message": str(error), "service": self.service_name}
