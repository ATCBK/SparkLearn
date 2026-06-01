"""统一外部 API 客户端包

提供各服务的统一封装，基于 BaseAPIClient 实现一致的错误处理、重试和日志。
"""

from .tts_client import tts_client
from .cosyvoice_tts_client import cosyvoice_tts_client
from .ppt_client import ppt_client
from .video_ai_client import video_ai_client

__all__ = ["tts_client", "cosyvoice_tts_client", "ppt_client", "video_ai_client"]
