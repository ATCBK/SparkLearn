"""统一存储抽象层

提供本地存储和阿里云 OSS 存储的统一接口。
"""

import json
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from .config import settings
from .db import now_iso

logger = logging.getLogger("storage")


class StorageBackend(ABC):
    """存储后端抽象基类"""

    @abstractmethod
    async def save(self, user_id: str, category: str, filename: str, data: bytes) -> str:
        """保存文件，返回存储路径或 URL"""

    @abstractmethod
    async def load(self, path: str) -> bytes:
        """加载文件内容"""

    @abstractmethod
    async def delete(self, path: str) -> bool:
        """删除文件"""

    @abstractmethod
    async def get_url(self, path: str) -> str:
        """获取文件访问 URL"""

    @abstractmethod
    def get_download_url(self, path: str) -> str:
        """获取文件下载 URL（用于 API 返回给前端）"""


class LocalStorage(StorageBackend):
    """本地文件存储"""

    async def save(self, user_id: str, category: str, filename: str, data: bytes) -> str:
        user_dir = settings.data_dir / "users" / user_id / category
        user_dir.mkdir(parents=True, exist_ok=True)
        import time
        ts = int(time.time())
        safe_name = filename.replace(" ", "_")
        path = user_dir / f"{ts}_{safe_name}"
        path.write_bytes(data)
        return str(path)

    async def load(self, path: str) -> bytes:
        return Path(path).read_bytes()

    async def delete(self, path: str) -> bool:
        try:
            Path(path).unlink(missing_ok=True)
            return True
        except Exception:
            return False

    async def get_url(self, path: str) -> str:
        return path

    def get_download_url(self, path: str) -> str:
        return path


class OSSStorage(StorageBackend):
    """阿里云 OSS 存储"""

    async def save(self, user_id: str, category: str, filename: str, data: bytes) -> str:
        from .oss import oss_client

        key = oss_client.build_key(user_id, category, filename)
        url = await oss_client.upload_file(key, data)
        # 返回 OSS key 作为存储路径（而非完整 URL）
        return key

    async def load(self, path: str) -> str:
        from .oss import oss_client

        # path 是 OSS key
        url = await oss_client.get_signed_url(path)
        return url

    async def delete(self, path: str) -> bool:
        from .oss import oss_client

        return await oss_client.delete_file(path)

    async def get_url(self, path: str) -> str:
        from .oss import oss_client

        # 如果是本地路径（兼容旧数据），直接返回
        if not path.startswith("users/"):
            return path
        return oss_client.get_file_url(path)

    def get_download_url(self, path: str) -> str:
        from .oss import oss_client

        if not path.startswith("users/"):
            return path
        return oss_client.get_file_url(path)


_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    """获取存储后端单例"""
    global _storage
    if _storage is None:
        if settings.aliyun_oss_bucket_name:
            _storage = OSSStorage()
            logger.info("使用阿里云 OSS 存储")
        else:
            _storage = LocalStorage()
            logger.info("使用本地文件存储")
    return _storage


# ─── 向后兼容的旧接口 ─────────────────────────────────────────────────────────────

def _user_dir(user_id: str) -> Path:
    base = settings.data_dir / "users" / user_id
    base.mkdir(parents=True, exist_ok=True)
    return base


def read_json(user_id: str, filename: str, default: Any) -> Any:
    path = _user_dir(user_id) / filename
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(user_id: str, filename: str, payload: Any) -> None:
    path = _user_dir(user_id) / filename
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def append_jsonl(user_id: str, filename: str, record: dict[str, Any]) -> None:
    path = _user_dir(user_id) / filename
    line = json.dumps({"ts": now_iso(), **record}, ensure_ascii=False)
    with path.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
