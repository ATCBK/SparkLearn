import argparse
import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse

import websockets

from app.config import settings


def build_auth_url(base_url: str, api_key: str, api_secret: str) -> str:
    parsed = urlparse(base_url)
    host = parsed.netloc
    path = parsed.path
    date = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
    signature_origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
    signature_sha = hmac.new(
        api_secret.encode("utf-8"),
        signature_origin.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    signature = base64.b64encode(signature_sha).decode("utf-8")
    authorization_origin = (
        f'api_key="{api_key}", algorithm="hmac-sha256", '
        f'headers="host date request-line", signature="{signature}"'
    )
    authorization = base64.b64encode(authorization_origin.encode("utf-8")).decode("utf-8")
    query = urlencode({"authorization": authorization, "date": date, "host": host})
    return f"{base_url}?{query}"


async def probe_once(domain: str, prompt: str) -> dict:
    ws_url = build_auth_url(settings.spark_api_url, settings.spark_api_key, settings.spark_api_secret)
    req = {
        "header": {"app_id": settings.spark_app_id, "uid": settings.single_user_id},
        "parameter": {"chat": {"domain": domain, "temperature": 0.5, "max_tokens": 512}},
        "payload": {"message": {"text": [{"role": "user", "content": prompt}]}},
    }
    out = {"domain": domain, "url": settings.spark_api_url, "code": None, "message": None, "sid": None}
    chunks: list[str] = []
    try:
        async with websockets.connect(ws_url, ping_interval=20, ping_timeout=20) as ws:
            await ws.send(json.dumps(req, ensure_ascii=False))
            while True:
                raw = await ws.recv()
                data = json.loads(raw)
                header = data.get("header", {})
                out["code"] = int(header.get("code", 0))
                out["message"] = str(header.get("message", ""))
                out["sid"] = str(header.get("sid", ""))
                if out["code"] != 0:
                    break
                text = data.get("payload", {}).get("choices", {}).get("text", [])
                if text:
                    content = text[0].get("content", "")
                    if content:
                        chunks.append(content)
                if int(header.get("status", 0)) == 2:
                    break
    except Exception as ex:
        out["code"] = -1
        out["message"] = f"exception: {ex}"
    out["text_preview"] = "".join(chunks)[:120]
    out["ok"] = out["code"] == 0
    return out


async def main() -> None:
    parser = argparse.ArgumentParser(description="Spark WebSocket probe")
    parser.add_argument("--prompt", default="你好")
    parser.add_argument("--domains", default="lite,general")
    args = parser.parse_args()

    domains = [d.strip() for d in args.domains.split(",") if d.strip()]
    if not domains:
        domains = ["lite"]

    print(
        json.dumps(
            {
                "app_id": settings.spark_app_id,
                "url": settings.spark_api_url,
                "domains": domains,
                "api_key_len": len(settings.spark_api_key or ""),
                "api_secret_len": len(settings.spark_api_secret or ""),
            },
            ensure_ascii=False,
        )
    )

    for domain in domains:
        result = await probe_once(domain=domain, prompt=args.prompt)
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
