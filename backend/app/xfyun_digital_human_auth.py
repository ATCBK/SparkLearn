import base64
import hashlib
import hmac
from datetime import UTC, datetime
from email.utils import format_datetime
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


def build_xfyun_digital_human_signed_url(
    base_url: str,
    api_key: str,
    api_secret: str,
    *,
    now: datetime | None = None,
) -> str:
    """按讯飞 WebSocket 鉴权规范生成短期签名地址。"""
    if not api_key or not api_secret:
        raise ValueError("讯飞数字人鉴权配置不完整")

    parsed = urlparse(base_url)
    if parsed.scheme != "wss" or not parsed.netloc:
        raise ValueError("讯飞数字人服务地址必须是安全的绝对地址")

    current = now or datetime.now(UTC)
    if current.tzinfo is None:
        current = current.replace(tzinfo=UTC)
    date = format_datetime(current.astimezone(UTC), usegmt=True)
    path = parsed.path or "/"

    signature_origin = (
        f"host: {parsed.netloc}\n"
        f"date: {date}\n"
        f"GET {path} HTTP/1.1"
    )
    signature = base64.b64encode(
        hmac.new(
            api_secret.encode("utf-8"),
            signature_origin.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).digest()
    ).decode("utf-8")
    authorization_origin = (
        f'api_key="{api_key}", algorithm="hmac-sha256", '
        f'headers="host date request-line", signature="{signature}"'
    )
    authorization = base64.b64encode(
        authorization_origin.encode("utf-8")
    ).decode("utf-8")

    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.update(
        {
            "authorization": authorization,
            "date": date,
            "host": parsed.netloc,
        }
    )
    return urlunparse(parsed._replace(query=urlencode(query)))
