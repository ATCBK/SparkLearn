import json
import logging
import re
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import httpx

from .config import settings

logger = logging.getLogger("coze")


@dataclass
class _StreamState:
    last_full_text: str = ""


class CozeAdapter:
    def resolve_resource_bot_id(self, resource_type: str) -> str:
        mapping = {
            "document": settings.coze_bot_id_resource_document,
            "mindmap": settings.coze_bot_id_resource_mindmap,
            "quiz": settings.coze_bot_id_resource_quiz,
            "reading": settings.coze_bot_id_resource_reading,
            "code": settings.coze_bot_id_resource_code,
        }
        return (mapping.get(resource_type, "") or settings.coze_bot_id_resource_default).strip()

    async def stream_resource_text(
        self,
        *,
        resource_type: str,
        prompt: str,
        user_id: str | None = None,
    ) -> AsyncGenerator[tuple[str, dict[str, Any]], None]:
        token = settings.coze_api_token.strip()
        bot_id = self.resolve_resource_bot_id(resource_type)
        uid = (user_id or settings.coze_default_user_id or settings.single_user_id).strip() or "single_user"

        if not token:
            yield ("error", {"code": 4001, "message": "缺少 Coze 令牌", "provider": "coze"})
            yield ("done", {"produced": False, "provider": "coze"})
            return
        if not bot_id:
            yield (
                "error",
                {
                    "code": 4002,
                    "message": f"资源类型缺少 Coze bot_id：{resource_type}",
                    "provider": "coze",
                },
            )
            yield ("done", {"produced": False, "provider": "coze"})
            return

        url = f"{settings.coze_base_url.rstrip('/')}{settings.coze_api_path_chat}"
        req = {
            "bot_id": bot_id,
            "user_id": uid,
            "stream": True,
            "auto_save_history": True,
            "additional_messages": [
                {
                    "role": "user",
                    "type": "question",
                    "content_type": "text",
                    "content": prompt,
                }
            ],
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "token": token,
            "Content-Type": "application/json",
        }

        produced = False
        state = _StreamState()
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=120.0)) as client:
                async with client.stream("POST", url, headers=headers, json=req) as resp:
                    if resp.status_code >= 400:
                        body = (await resp.aread()).decode("utf-8", errors="ignore")
                        yield (
                            "error",
                            {
                                "code": resp.status_code,
                                "message": f"Coze 接口请求失败：{body[:500]}",
                                "provider": "coze",
                            },
                        )
                        yield ("done", {"produced": False, "provider": "coze"})
                        return

                    async for event_name, data_text in self._iter_sse_frames(resp):
                        payload = self._decode_payload(data_text)

                        err = self._extract_error(payload)
                        if err:
                            yield ("error", {"provider": "coze", **err})
                            continue

                        links = self._extract_links(payload)
                        if links:
                            yield ("meta", {"links": links, "event": event_name, "provider": "coze"})

                        full_text = self._extract_text(payload)
                        delta = self._to_delta_text(full_text, state)
                        if delta:
                            produced = True
                            yield ("text", {"content": delta, "event": event_name, "provider": "coze"})

        except Exception as ex:
            logger.exception("coze stream error")
            yield ("error", {"code": -1, "message": f"Coze 调用异常：{ex}", "provider": "coze"})

        yield ("done", {"produced": produced, "provider": "coze"})

    async def _iter_sse_frames(self, resp: httpx.Response) -> AsyncGenerator[tuple[str, str], None]:
        event_name = ""
        data_lines: list[str] = []
        async for raw_line in resp.aiter_lines():
            line = raw_line.rstrip("\r")
            if not line:
                if data_lines:
                    yield (event_name, "\n".join(data_lines))
                    event_name = ""
                    data_lines = []
                continue
            if line.startswith("event:"):
                event_name = line.split(":", 1)[1].strip()
                continue
            if line.startswith("data:"):
                data_lines.append(line.split(":", 1)[1].strip())
                continue
        if data_lines:
            yield (event_name, "\n".join(data_lines))

    def _decode_payload(self, data_text: str) -> Any:
        raw = (data_text or "").strip()
        if not raw or raw in {"[DONE]", "done"}:
            return {}
        obj = self._json_or_raw(raw)
        return self._inflate(obj)

    def _inflate(self, obj: Any) -> Any:
        if isinstance(obj, dict):
            out: dict[str, Any] = {}
            for k, v in obj.items():
                out[k] = self._inflate(v)
            # common envelope: {"data": "{...json...}"}
            if "data" in out and isinstance(out["data"], (dict, list)):
                if isinstance(out["data"], dict):
                    merged = dict(out["data"])
                    for k, v in out.items():
                        if k != "data" and k not in merged:
                            merged[k] = v
                    return merged
                return out["data"]
            return out
        if isinstance(obj, list):
            return [self._inflate(x) for x in obj]
        if isinstance(obj, str):
            decoded = obj.strip()
            if decoded.startswith("{") or decoded.startswith("["):
                nested = self._json_or_raw(decoded)
                if nested is not decoded:
                    return self._inflate(nested)
            return decoded
        return obj

    def _json_or_raw(self, raw: str) -> Any:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw

    def _extract_text(self, payload: Any) -> str:
        if isinstance(payload, list):
            parts = [self._extract_text(x) for x in payload]
            return "".join([p for p in parts if p])
        if not isinstance(payload, dict):
            return ""

        role = str(payload.get("role", "")).lower()
        msg_type = str(payload.get("type", "")).lower()
        msg_kind = str(payload.get("msg_type", "")).lower()
        if role == "user" or msg_type in {"question", "function_call", "tool_response", "tool_output"}:
            return ""
        if msg_kind.endswith("finish"):
            return ""

        # structured content object
        content = payload.get("content")
        if isinstance(content, dict):
            text = content.get("text")
            if isinstance(text, str):
                return text.strip()
        if isinstance(content, str):
            c = content.strip()
            if not self._looks_like_control_payload(c):
                return c

        for key in ("answer", "text"):
            v = payload.get(key)
            if isinstance(v, str):
                vv = v.strip()
                if not self._looks_like_control_payload(vv):
                    return vv

        return ""

    def _to_delta_text(self, full_text: str, state: _StreamState) -> str:
        text = (full_text or "").strip()
        if not text:
            return ""
        if self._looks_like_control_payload(text):
            return ""

        # Handle cumulative streaming chunks to avoid duplicate content.
        if state.last_full_text and text.startswith(state.last_full_text):
            delta = text[len(state.last_full_text) :].strip()
            state.last_full_text = text
            return delta

        # Occasional out-of-order small chunk; avoid hard reset duplication.
        if state.last_full_text and state.last_full_text.startswith(text):
            return ""

        state.last_full_text = text
        return text

    def _extract_links(self, payload: Any) -> list[str]:
        found: list[str] = []

        def walk(v: Any) -> None:
            if isinstance(v, dict):
                for key, value in v.items():
                    if key in {"file_url", "url", "link", "image_url"} and isinstance(value, str):
                        u = value.strip()
                        if self._is_valid_http_url(u):
                            found.append(u)
                    else:
                        walk(value)
            elif isinstance(v, list):
                for item in v:
                    walk(item)
            elif isinstance(v, str):
                # strict URL discovery from plain text
                for m in re.finditer(r"https?://[^\s)]+", v):
                    u = m.group(0).rstrip(".,;:!?\"'")
                    if self._is_valid_http_url(u):
                        found.append(u)

        walk(payload)
        deduped: list[str] = []
        seen: set[str] = set()
        for u in found:
            if u not in seen:
                seen.add(u)
                deduped.append(u)
        return deduped

    def _extract_error(self, payload: Any) -> dict[str, Any] | None:
        if not isinstance(payload, dict):
            return None
        code = payload.get("code")
        if isinstance(code, int) and code != 0:
            return {"code": code, "message": str(payload.get("msg") or payload.get("message") or "Coze 错误")}
        err = payload.get("error")
        if isinstance(err, dict):
            return {"code": int(err.get("code", -1)), "message": str(err.get("message", "Coze 错误"))}
        return None

    def _looks_like_control_payload(self, text: str) -> bool:
        t = text.strip().lower()
        if not t:
            return True
        if t.startswith("{") and ("msg_type" in t or "generate_answer_finish" in t):
            return True
        return False

    def _is_valid_http_url(self, value: str) -> bool:
        try:
            p = urlparse(value)
            return p.scheme in {"http", "https"} and bool(p.netloc)
        except Exception:
            return False


coze_adapter = CozeAdapter()
