import asyncio
import base64
import hashlib
import hmac
import time
from typing import Any
from urllib.parse import quote

import httpx

from .config import settings


class XfyunPptError(RuntimeError):
    pass


def _as_bool_text(value: bool) -> str:
    return "true" if value else "false"


class XfyunPptClient:
    def _headers(self) -> dict[str, str]:
        app_id = settings.xfyun_zw_app_id.strip()
        secret = settings.xfyun_zw_api_secret.strip()
        if not app_id or not secret:
            raise XfyunPptError("讯飞智文配置缺失，请设置 xfyun_zw_app_id / xfyun_zw_api_secret")

        ts = str(int(time.time()))
        md5_text = hashlib.md5(f"{app_id}{ts}".encode("utf-8")).hexdigest()
        sign = base64.b64encode(hmac.new(secret.encode("utf-8"), md5_text.encode("utf-8"), hashlib.sha1).digest()).decode("utf-8")
        return {
            "appId": app_id,
            "timestamp": ts,
            "signature": sign,
        }

    async def create_ppt(self, *, query: str, language: str = "cn", search: bool = False, is_figure: bool = False, ai_image: str = "normal") -> dict[str, Any]:
        url = f"{settings.xfyun_zw_base_url.rstrip('/')}/api/ppt/v2/create"
        data = {
            "query": query,
            "language": language,
            "search": _as_bool_text(search),
            "isFigure": _as_bool_text(is_figure),
            "aiImage": ai_image,
            "author": settings.xfyun_zw_ppt_author,
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=self._headers(), data=data)
            resp.raise_for_status()
            payload = resp.json()
        if not payload.get("flag", False):
            raise XfyunPptError(f"讯飞智文创建失败: code={payload.get('code')} desc={payload.get('desc')}")
        result = payload.get("data") or {}
        sid = str(result.get("sid") or "").strip()
        if not sid:
            raise XfyunPptError("讯飞智文创建返回缺少 sid")
        return result

    async def wait_progress(self, sid: str) -> dict[str, Any]:
        url = f"{settings.xfyun_zw_base_url.rstrip('/')}/api/ppt/v2/progress?sid={quote(sid)}"
        deadline = time.time() + max(30, int(settings.xfyun_zw_timeout_sec))
        last_data: dict[str, Any] = {}
        async with httpx.AsyncClient(timeout=45.0) as client:
            while time.time() < deadline:
                resp = await client.get(url, headers=self._headers())
                resp.raise_for_status()
                payload = resp.json()
                if not payload.get("flag", False):
                    raise XfyunPptError(f"讯飞智文进度查询失败: code={payload.get('code')} desc={payload.get('desc')}")
                data = payload.get("data") or {}
                last_data = data
                status = str(data.get("pptStatus") or "").lower()
                if status == "done" and str(data.get("pptUrl") or "").strip():
                    return data
                if status in {"build_failed", "failed"}:
                    raise XfyunPptError(f"讯飞智文PPT生成失败: {data.get('errMsg') or 'unknown'}")
                await asyncio.sleep(3)
        raise XfyunPptError(f"讯飞智文PPT生成超时（sid={sid}）")


xfyun_ppt_client = XfyunPptClient()

