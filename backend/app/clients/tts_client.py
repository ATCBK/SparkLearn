"""讯飞 TTS 客户端统一封装

基于 BaseAPIClient 提供统一的错误处理和日志。
封装 WebSocket 调用为同步接口（TTS 需要实时返回音频）。
"""

import base64
import hashlib
import hmac
import io
import json
import logging
import ssl
import time
import wave
from email.utils import formatdate
from urllib.parse import urlencode, urlparse

from ..api_errors import APIAuthError, APIConnectionError, APIError, APITimeoutError
from ..config import settings

logger = logging.getLogger("api.tts")


class TTSClient:
    """讯飞 TTS 客户端"""

    service_name = "xfyun_tts"

    def is_configured(self) -> bool:
        return bool(settings.xf_tts_app_id and settings.xf_tts_api_key and settings.xf_tts_api_secret)

    def synthesize(
        self,
        text: str,
        voice: str = "",
        speed: int = 50,
        volume: int = 60,
        pitch: int = 50,
    ) -> tuple[bool, bytes | None, str]:
        """合成语音，返回 (success, wav_bytes, message)"""
        if not text.strip():
            return False, None, "文本为空"
        if not self.is_configured():
            return False, None, "TTS 未配置（缺少讯飞密钥）"

        try:
            from websockets.sync.client import connect
        except Exception as ex:
            return False, None, f"websockets 库不可用：{ex}"

        vcn = voice or settings.xf_tts_default_voice
        limit = settings.xf_tts_text_limit
        chunks = [text[i : i + limit] for i in range(0, len(text), limit)] if len(text) > limit else [text]

        all_pcm = bytearray()
        for chunk in chunks:
            start = time.monotonic()
            try:
                auth_url = self._build_auth_url()
                payload = {
                    "common": {"app_id": settings.xf_tts_app_id},
                    "business": {
                        "aue": "raw",
                        "auf": "audio/L16;rate=16000",
                        "vcn": vcn,
                        "tte": "utf8",
                        "speed": speed,
                        "volume": volume,
                        "pitch": pitch,
                    },
                    "data": {
                        "status": 2,
                        "text": base64.b64encode(chunk.encode("utf-8")).decode("ascii"),
                    },
                }
                timeout_sec = max(5, settings.xf_tts_timeout_ms / 1000)
                pcm = bytearray()
                ssl_ctx = ssl.create_default_context()
                ssl_ctx.check_hostname = False
                ssl_ctx.verify_mode = ssl.CERT_NONE
                with connect(auth_url, open_timeout=timeout_sec, ssl=ssl_ctx) as ws:
                    ws.send(json.dumps(payload, ensure_ascii=False))
                    while True:
                        raw = ws.recv(timeout=timeout_sec)
                        data = json.loads(raw)
                        header = data.get("header", {})
                        code = int(header.get("code", 0))
                        if code != 0:
                            elapsed = time.monotonic() - start
                            logger.error("[%s] TTS 错误 %s: %s (%.2fs)", self.service_name, code, header.get("message", ""), elapsed)
                            return False, None, f"讯飞 TTS 错误 {code}: {header.get('message', '')}"
                        audio_b64 = data.get("data", {}).get("audio", "")
                        if audio_b64:
                            pcm.extend(base64.b64decode(audio_b64))
                        if int(data.get("data", {}).get("status", 0)) == 2:
                            break
                elapsed = time.monotonic() - start
                logger.info("[%s] TTS 合成完成 chunk_len=%d audio=%d (%.2fs)", self.service_name, len(chunk), len(pcm), elapsed)
                all_pcm.extend(pcm)

            except Exception as ex:
                elapsed = time.monotonic() - start
                logger.error("[%s] TTS 调用异常 (%.2fs): %s", self.service_name, elapsed, ex)
                return False, None, f"讯飞 TTS 调用失败：{ex}"

        if not all_pcm:
            return False, None, "讯飞 TTS 未返回音频数据"

        wav_bytes = self._pcm_to_wav(bytes(all_pcm))
        return True, wav_bytes, "ok"

    def _build_auth_url(self) -> str:
        parsed = urlparse(settings.xf_tts_base_url)
        host = parsed.netloc
        path = parsed.path or "/v2/tts"
        date = formatdate(timeval=None, localtime=False, usegmt=True)
        signature_origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
        digest = hmac.new(
            settings.xf_tts_api_secret.encode("utf-8"),
            signature_origin.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        signature = base64.b64encode(digest).decode("ascii")
        authorization_origin = (
            f'api_key="{settings.xf_tts_api_key}", algorithm="hmac-sha256", '
            f'headers="host date request-line", signature="{signature}"'
        )
        query = urlencode(
            {
                "authorization": base64.b64encode(authorization_origin.encode("utf-8")).decode("ascii"),
                "date": date,
                "host": host,
            }
        )
        return f"{settings.xf_tts_base_url}?{query}"

    @staticmethod
    def _pcm_to_wav(pcm: bytes, sample_rate: int = 16000) -> bytes:
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(pcm)
        return buf.getvalue()


tts_client = TTSClient()
