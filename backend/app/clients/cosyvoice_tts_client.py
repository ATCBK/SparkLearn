"""阿里云 CosyVoice TTS 客户端

基于 DashScope SDK 调用 CosyVoice 语音合成服务。
复用项目已有的 DashScope API Key（与 Video AI 共用）。
"""

import logging
import time
import threading

from ..config import settings

logger = logging.getLogger("api.cosyvoice_tts")

# AudioFormat 枚举映射: (格式, 采样率) -> AudioFormat 成员名
_FORMAT_MAP = {
    ("wav", 8000): "WAV_8000HZ_MONO_16BIT",
    ("wav", 16000): "WAV_16000HZ_MONO_16BIT",
    ("wav", 22050): "WAV_22050HZ_MONO_16BIT",
    ("wav", 24000): "WAV_24000HZ_MONO_16BIT",
    ("wav", 44100): "WAV_44100HZ_MONO_16BIT",
    ("wav", 48000): "WAV_48000HZ_MONO_16BIT",
    ("mp3", 8000): "MP3_8000HZ_MONO_128KBPS",
    ("mp3", 16000): "MP3_16000HZ_MONO_128KBPS",
    ("mp3", 22050): "MP3_22050HZ_MONO_256KBPS",
    ("mp3", 24000): "MP3_24000HZ_MONO_256KBPS",
    ("mp3", 44100): "MP3_44100HZ_MONO_256KBPS",
    ("mp3", 48000): "MP3_48000HZ_MONO_256KBPS",
    ("pcm", 8000): "PCM_8000HZ_MONO_16BIT",
    ("pcm", 16000): "PCM_16000HZ_MONO_16BIT",
    ("pcm", 22050): "PCM_22050HZ_MONO_16BIT",
    ("pcm", 24000): "PCM_24000HZ_MONO_16BIT",
    ("pcm", 44100): "PCM_44100HZ_MONO_16BIT",
    ("pcm", 48000): "PCM_48000HZ_MONO_16BIT",
}


def _get_audio_format(fmt: str, sample_rate: int):
    """根据格式和采样率获取 dashscope AudioFormat 枚举值"""
    from dashscope.audio.tts_v2 import AudioFormat
    key = (fmt.lower(), sample_rate)
    attr_name = _FORMAT_MAP.get(key)
    if attr_name and hasattr(AudioFormat, attr_name):
        return getattr(AudioFormat, attr_name)
    # 默认回退
    return AudioFormat.WAV_24000HZ_MONO_16BIT


class CosyVoiceTTSClient:
    """阿里云 CosyVoice TTS 客户端"""

    service_name = "cosyvoice_tts"

    def __init__(self):
        self._semaphore = threading.Semaphore(settings.cosyvoice_max_concurrency)

    def is_configured(self) -> bool:
        return bool(settings.cosyvoice_api_key)

    def synthesize(
        self,
        text: str,
        voice: str = "",
        speech_rate: float = 0.0,
        pitch_rate: float = 0.0,
        volume: float = 0.0,
    ) -> tuple[bool, bytes | None, str]:
        """合成语音，返回 (success, audio_bytes, message)

        audio_bytes 格式取决于 settings.cosyvoice_format（默认 wav）。
        """
        if not text.strip():
            return False, None, "文本为空"
        if not self.is_configured():
            return False, None, "CosyVoice 未配置（缺少 DashScope API Key）"

        # 并发控制
        acquired = self._semaphore.acquire(timeout=settings.cosyvoice_timeout_sec)
        if not acquired:
            return False, None, "CosyVoice 并发超限，请稍后重试"

        try:
            import dashscope
            from dashscope.audio.tts_v2 import SpeechSynthesizer
        except ImportError:
            self._semaphore.release()
            return False, None, "dashscope 库未安装，请执行: pip install dashscope"

        vcn = voice or settings.cosyvoice_default_voice
        sr = speech_rate if speech_rate > 0 else settings.cosyvoice_speech_rate
        pr = pitch_rate if pitch_rate > 0 else settings.cosyvoice_pitch_rate
        vol = volume if volume > 0 else settings.cosyvoice_volume

        audio_format = _get_audio_format(settings.cosyvoice_format, settings.cosyvoice_sample_rate)

        start = time.monotonic()
        try:
            dashscope.api_key = settings.cosyvoice_api_key

            synthesizer = SpeechSynthesizer(
                model=settings.cosyvoice_model,
                voice=vcn,
                format=audio_format,
                speech_rate=sr,
                pitch_rate=pr,
                volume=int(vol * 50),  # SDK volume 范围 0-100，配置是 0.5-2.0 的倍率
            )

            audio_bytes = synthesizer.call(text)

            elapsed = time.monotonic() - start
            if audio_bytes is None or len(audio_bytes) == 0:
                logger.error("[%s] CosyVoice 未返回音频数据 (%.2fs)", self.service_name, elapsed)
                return False, None, "CosyVoice 未返回音频数据"

            logger.info(
                "[%s] CosyVoice 合成完成 text_len=%d audio=%d bytes voice=%s (%.2fs)",
                self.service_name, len(text), len(audio_bytes), vcn, elapsed,
            )
            return True, audio_bytes, "ok"

        except Exception as ex:
            elapsed = time.monotonic() - start
            logger.error("[%s] CosyVoice 调用异常 (%.2fs): %s", self.service_name, elapsed, ex)
            return False, None, f"CosyVoice 调用失败：{ex}"
        finally:
            self._semaphore.release()


cosyvoice_tts_client = CosyVoiceTTSClient()
