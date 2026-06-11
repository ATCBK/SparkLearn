import asyncio
import base64
import hashlib
import hmac
import json
import logging
from collections.abc import AsyncGenerator
from datetime import datetime
from urllib.parse import urlencode, urlparse

import websockets

from .config import settings
from .deepseek_adapter import DeepSeekAdapter

logger = logging.getLogger("spark")

_deepseek: DeepSeekAdapter | None = None


def _get_deepseek() -> DeepSeekAdapter:
    global _deepseek
    if _deepseek is None:
        _deepseek = DeepSeekAdapter()
    return _deepseek


class SparkLiteAdapter:
    def _model_config(self, model: str = "") -> dict:
        """根据模型标识获取 ws_url 和 domain，默认使用 spark_default_model。"""
        key = (model or "").strip().lower() or settings.spark_default_model
        return settings.spark_model_map.get(key, settings.spark_model_map.get("lite", {}))

    async def stream_chat(
        self,
        prompt: str,
        mode: str = "general",
        history: list[dict] | None = None,
        model: str = "",
    ) -> AsyncGenerator[str, None]:
        async for event_type, payload in self.stream_chat_events(prompt, mode=mode, history=history, model=model):
            if event_type == "text":
                content = str(payload.get("content", ""))
                if content:
                    yield content

    async def stream_chat_events(
        self,
        prompt: str,
        mode: str = "general",
        history: list[dict] | None = None,
        model: str = "",
    ) -> AsyncGenerator[tuple[str, dict], None]:
        # DeepSeek 模型走 OpenAI 兼容 HTTP 协议
        mc = self._model_config(model)
        if mc.get("provider") == "deepseek":
            async for evt in _get_deepseek().stream_chat_events(prompt, mode=mode, history=history, model=model):
                yield evt
            return

        if settings.spark_use_bridge and settings.spark_bridge_exe.exists():
            async for evt in self._stream_events_from_bridge(prompt, mode=mode, model=model):
                yield evt
            return

        async for evt in self._stream_events_from_ws(prompt, mode=mode, history=history or [], model=model):
            yield evt

    async def summarize(self, prompt: str) -> str:
        chunks: list[str] = []
        async for c in self.stream_chat(f"请用不超过120字总结：{prompt}", mode="general"):
            chunks.append(c)
        text = "".join(chunks).strip()
        if text:
            return text
        return f"本周期你在{prompt}方面保持了稳定进步，建议优先补齐薄弱点并维持每日练习。"

    async def _stream_events_from_bridge(self, prompt: str, mode: str, model: str = "") -> AsyncGenerator[tuple[str, dict], None]:
        mc = self._model_config(model)
        cmd = [
            str(settings.spark_bridge_exe),
            "--app_id",
            settings.spark_app_id,
            "--api_key",
            settings.spark_api_key,
            "--api_secret",
            settings.spark_api_secret,
            "--domain",
            mc.get("domain", self._normalize_domain(mode or settings.spark_model)),
            "--input",
            prompt,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        assert proc.stdout is not None
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            try:
                evt = json.loads(line.decode("utf-8", errors="ignore").strip())
            except json.JSONDecodeError:
                continue
            evt_type = evt.get("type")
            payload = evt.get("payload", {})
            if evt_type in {"text", "error", "meta", "done"}:
                if evt_type == "error":
                    logger.warning("spark bridge error: %s", payload)
                yield (evt_type, payload)
                if evt_type in {"error", "done"}:
                    break
        await proc.wait()

    async def _stream_events_from_ws(
        self,
        prompt: str,
        mode: str,
        history: list[dict],
        model: str = "",
    ) -> AsyncGenerator[tuple[str, dict], None]:
        if not settings.spark_app_id or not settings.spark_api_key or not settings.spark_api_secret:
            for chunk in self._chunk_text(f"关于“{prompt}”，我来分步骤讲解：先理解概念，再看示例，最后给你练习建议。"):
                yield ("text", {"content": chunk})
            yield ("done", {"fallback": True})
            return

        mc = self._model_config(model)
        base_url = mc.get("url", settings.spark_api_url)
        ws_url = self._build_auth_url(
            base_url,
            settings.spark_api_key,
            settings.spark_api_secret,
        )
        domain = mc.get("domain", self._normalize_domain(mode or settings.spark_model))
        messages = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in history][-6:]
        messages.append({"role": "user", "content": prompt})
        req = {
            "header": {"app_id": settings.spark_app_id, "uid": settings.single_user_id},
            "parameter": {"chat": {"domain": domain, "temperature": 0.6, "max_tokens": 4096}},
            "payload": {"message": {"text": messages}},
        }

        produced = False
        cloud_error_payload: dict | None = None
        try:
            async with websockets.connect(ws_url, ping_interval=20, ping_timeout=20) as ws:
                await ws.send(json.dumps(req, ensure_ascii=False))
                while True:
                    raw = await ws.recv()
                    data = json.loads(raw)
                    header = data.get("header", {})
                    code = int(header.get("code", 0))
                    if code != 0:
                        cloud_error_payload = {
                            "code": code,
                            "message": str(header.get("message", "spark cloud error")),
                            "sid": str(header.get("sid", "")),
                            "domain": domain,
                            "api_url": base_url,
                        }
                        logger.warning("spark ws error: %s", cloud_error_payload)
                        break
                    choices = data.get("payload", {}).get("choices", {}).get("text", [])
                    if choices:
                        content = choices[0].get("content", "")
                        if content:
                            produced = True
                            yield ("text", {"content": content})
                    if int(header.get("status", 0)) == 2:
                        break
        except Exception as ex:
            cloud_error_payload = {
                "code": -1,
                "message": f"websocket exception: {ex}",
                "sid": "",
                "domain": domain,
                "api_url": base_url,
            }
            logger.exception("spark ws exception")

        if cloud_error_payload:
            yield ("error", cloud_error_payload)

        if not produced:
            fallback = (
                f"当前模型服务返回错误，先给你一个离线解释：关于“{prompt}”，"
                "建议先掌握概念定义，再通过一个小例子验证理解。"
                if cloud_error_payload
                else f"关于“{prompt}”，我来分步骤讲解：先理解概念，再看示例，最后给你练习建议。"
            )
            for chunk in self._chunk_text(fallback):
                yield ("text", {"content": chunk})

        yield ("done", {"produced": produced, "fallback": not produced})

    def _build_auth_url(self, base_url: str, api_key: str, api_secret: str) -> str:
        parsed = urlparse(base_url)
        host = parsed.netloc
        path = parsed.path
        date = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
        signature_origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
        signature_sha = hmac.new(api_secret.encode("utf-8"), signature_origin.encode("utf-8"), digestmod=hashlib.sha256).digest()
        signature = base64.b64encode(signature_sha).decode("utf-8")
        authorization_origin = (
            f'api_key="{api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature}"'
        )
        authorization = base64.b64encode(authorization_origin.encode("utf-8")).decode("utf-8")
        query = urlencode({"authorization": authorization, "date": date, "host": host})
        return f"{base_url}?{query}"

    def _chunk_text(self, text: str, size: int = 8) -> list[str]:
        return [text[i : i + size] for i in range(0, len(text), size)]

    def _normalize_domain(self, raw: str) -> str:
        candidate = (raw or "").strip().lower()
        if candidate in {"lite", "general-lite", "spark-lite"}:
            return "lite"
        # Spark Lite websocket (v1.1/chat) rejects "general", must use "lite".
        if candidate == "general":
            return "lite"
        if candidate in {"knowledge_qa", "step_hint", "follow_up", "resource"}:
            return "lite"
        return candidate or "lite"


spark_lite = SparkLiteAdapter()
