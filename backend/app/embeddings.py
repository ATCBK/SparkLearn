import base64
import hashlib
import hmac
import json
import struct
from email.utils import formatdate
from urllib.parse import urlparse

import httpx

from .config import settings


class XfyunEmbeddingClient:
    def _build_headers(self, base_url: str) -> dict[str, str]:
        parsed = urlparse(base_url)
        host = parsed.netloc
        path = parsed.path or "/"
        date = formatdate(timeval=None, localtime=False, usegmt=True)
        signature_origin = f"host: {host}\ndate: {date}\nPOST {path} HTTP/1.1"
        signature_sha = hmac.new(
            settings.xfyun_emb_api_secret.encode("utf-8"),
            signature_origin.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).digest()
        signature = base64.b64encode(signature_sha).decode("utf-8")
        auth_origin = (
            f'api_key="{settings.xfyun_emb_api_key}", '
            'algorithm="hmac-sha256", '
            'headers="host date request-line", '
            f'signature="{signature}"'
        )
        return {
            "host": host,
            "date": date,
            "authorization": auth_origin,
            "content-type": "application/json",
        }

    def _decode_embedding_text(self, text_b64: str) -> list[float]:
        raw = base64.b64decode(text_b64)
        if not raw:
            return []
        if len(raw) % 4 == 0:
            try:
                return list(struct.unpack(f"<{len(raw) // 4}f", raw))
            except Exception:
                pass
            try:
                return list(struct.unpack(f">{len(raw) // 4}f", raw))
            except Exception:
                pass
        try:
            decoded = raw.decode("utf-8", errors="ignore")
            arr = json.loads(decoded)
            if isinstance(arr, list):
                return [float(x) for x in arr]
        except Exception:
            pass
        return []

    async def embed(self, text: str, domain: str) -> list[float]:
        if not settings.xfyun_emb_app_id or not settings.xfyun_emb_api_key or not settings.xfyun_emb_api_secret:
            raise RuntimeError("missing xfyun embedding credentials")
        if not text.strip():
            return []

        payload_text = {
            "messages": [
                {
                    "content": text[:2000],
                    "role": "user",
                }
            ]
        }
        request_body = {
            "header": {
                "app_id": settings.xfyun_emb_app_id,
                "uid": settings.single_user_id,
                "status": 3,
            },
            "parameter": {
                "emb": {
                    "domain": domain,
                    "feature": {"encoding": "utf8", "compress": "raw", "format": "plain"},
                }
            },
            "payload": {
                "messages": {
                    "encoding": "utf8",
                    "compress": "raw",
                    "format": "json",
                    "status": 3,
                    "text": base64.b64encode(json.dumps(payload_text, ensure_ascii=False).encode("utf-8")).decode("utf-8"),
                }
            },
        }
        headers = self._build_headers(settings.xfyun_emb_base_url)
        timeout = httpx.Timeout(settings.xfyun_emb_timeout_sec)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(settings.xfyun_emb_base_url, headers=headers, json=request_body)
            resp.raise_for_status()
            data = resp.json()

        code = int((data.get("header") or {}).get("code", -1))
        if code != 0:
            message = str((data.get("header") or {}).get("message", "embedding error"))
            sid = str((data.get("header") or {}).get("sid", ""))
            raise RuntimeError(f"embedding failed code={code} sid={sid} message={message}")
        text_b64 = str((((data.get("payload") or {}).get("feature") or {}).get("text")) or "")
        vec = self._decode_embedding_text(text_b64)
        if not vec:
            raise RuntimeError("empty embedding vector")
        return vec

    async def embed_para(self, text: str) -> list[float]:
        return await self.embed(text, domain="para")

    async def embed_query(self, text: str) -> list[float]:
        return await self.embed(text, domain="query")


xfyun_embedding = XfyunEmbeddingClient()
