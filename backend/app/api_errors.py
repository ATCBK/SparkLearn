"""统一外部 API 异常定义"""


class APIError(Exception):
    """外部 API 调用异常基类"""

    def __init__(self, service: str, message: str, code: int = -1, context: dict | None = None):
        self.service = service
        self.code = code
        self.context = context or {}
        super().__init__(f"[{service}] {message}")


class APITimeoutError(APIError):
    """API 请求超时"""

    def __init__(self, service: str, timeout: int, **kwargs):
        super().__init__(service, f"请求超时 ({timeout}s)", code=-2, **kwargs)


class APIAuthError(APIError):
    """API 认证失败"""

    def __init__(self, service: str, message: str = "认证失败，请检查 API Key/Secret", **kwargs):
        super().__init__(service, message, code=401, **kwargs)


class APIRateLimitError(APIError):
    """API 限流"""

    def __init__(self, service: str, **kwargs):
        super().__init__(service, "请求频率超限", code=429, **kwargs)


class APIResponseError(APIError):
    """API 返回错误响应"""

    def __init__(self, service: str, status_code: int, body: str = "", **kwargs):
        super().__init__(service, f"HTTP {status_code}: {body[:200]}", code=status_code, **kwargs)


class APIConnectionError(APIError):
    """API 连接失败"""

    def __init__(self, service: str, message: str = "连接失败", **kwargs):
        super().__init__(service, message, code=-3, **kwargs)
