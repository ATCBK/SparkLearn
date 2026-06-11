import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse

import httpx

from .config import settings


def _http_date() -> str:
    return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")


def _build_auth_headers(*, host: str, path: str, api_key: str, api_secret: str) -> str:
    date = _http_date()
    sign_src = f"host: {host}\ndate: {date}\nPOST {path} HTTP/1.1"
    digest = hmac.new(api_secret.encode("utf-8"), sign_src.encode("utf-8"), hashlib.sha256).digest()
    signature = base64.b64encode(digest).decode("utf-8")
    auth_src = f'api_key="{api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature}"'
    authorization = base64.b64encode(auth_src.encode("utf-8")).decode("utf-8")
    return urlencode({"authorization": authorization, "date": date, "host": host})


async def generate_image_base64(
    *,
    prompt: str,
    width: int = 512,
    height: int = 512,
    uid: str = "single_user",
) -> str:
    app_id = settings.spark_app_id
    api_key = settings.spark_api_key
    api_secret = settings.spark_api_secret
    if not app_id or not api_key or not api_secret:
        raise RuntimeError("image generation credentials are not configured")

    base_url = "https://spark-api.cn-huabei-1.xf-yun.com/v2.1/tti"
    parsed = urlparse(base_url)
    query = _build_auth_headers(
        host=parsed.netloc,
        path=parsed.path,
        api_key=api_key,
        api_secret=api_secret,
    )
    url = f"{base_url}?{query}"
    body = {
        "header": {"app_id": app_id, "uid": uid[:32]},
        "parameter": {"chat": {"domain": "general", "width": width, "height": height}},
        "payload": {"message": {"text": [{"role": "user", "content": prompt[:1000]}]}},
    }
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(url, json=body, headers={"Content-Type": "application/json;charset=UTF-8"})
        resp.raise_for_status()
        data = resp.json()

    header = data.get("header", {})
    code = int(header.get("code", -1))
    if code != 0:
        msg = str(header.get("message", "image generation failed"))
        raise RuntimeError(f"tti error {code}: {msg}")

    text_arr = data.get("payload", {}).get("choices", {}).get("text", [])
    if not text_arr:
        raise RuntimeError("tti empty response")
    content = str(text_arr[0].get("content", "")).strip()
    if not content:
        raise RuntimeError("tti empty image content")
    return content

