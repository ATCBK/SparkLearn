"""阿里云 OSS 存储客户端

提供文件上传、下载、删除、URL 生成等功能。
"""

import logging
import time
from typing import Any

from .config import settings

logger = logging.getLogger("api.oss")


class AliyunOSSClient:
    """阿里云 OSS 存储客户端"""

    service_name = "aliyun_oss"

    def __init__(self):
        self._bucket = None

    def is_configured(self) -> bool:
        return bool(
            settings.aliyun_oss_access_key_id
            and settings.aliyun_oss_access_key_secret
            and settings.aliyun_oss_bucket_name
        )

    def _get_bucket(self):
        """延迟初始化 OSS Bucket 连接"""
        if self._bucket is not None:
            return self._bucket

        try:
            import oss2

            auth = oss2.Auth(
                settings.aliyun_oss_access_key_id,
                settings.aliyun_oss_access_key_secret,
            )
            self._bucket = oss2.Bucket(
                auth,
                settings.aliyun_oss_endpoint,
                settings.aliyun_oss_bucket_name,
            )
            return self._bucket
        except ImportError:
            logger.error("[%s] oss2 库未安装，请运行: pip install oss2", self.service_name)
            return None
        except Exception as ex:
            logger.error("[%s] OSS 初始化失败: %s", self.service_name, ex)
            return None

    def build_key(self, user_id: str, category: str, filename: str) -> str:
        """生成 OSS 对象键"""
        ts = int(time.time())
        # 清理文件名中的特殊字符
        safe_name = filename.replace(" ", "_").replace("/", "_")
        return f"users/{user_id}/{category}/{ts}_{safe_name}"

    async def upload_file(self, key: str, data: bytes) -> str:
        """上传文件到 OSS

        Args:
            key: OSS 对象键
            data: 文件二进制数据

        Returns:
            文件访问 URL
        """
        bucket = self._get_bucket()
        if bucket is None:
            raise RuntimeError("OSS 未初始化")

        try:
            bucket.put_object(key, data)
            url = self.get_file_url(key)
            logger.info("[%s] 文件上传成功: %s", self.service_name, key)
            return url
        except Exception as ex:
            logger.error("[%s] 文件上传失败: %s", self.service_name, ex)
            raise

    async def upload_fileobj(self, key: str, fileobj) -> str:
        """上传文件对象到 OSS

        Args:
            key: OSS 对象键
            fileobj: 文件对象（支持 read() 方法）

        Returns:
            文件访问 URL
        """
        bucket = self._get_bucket()
        if bucket is None:
            raise RuntimeError("OSS 未初始化")

        try:
            bucket.put_object(key, fileobj)
            url = self.get_file_url(key)
            logger.info("[%s] 文件上传成功: %s", self.service_name, key)
            return url
        except Exception as ex:
            logger.error("[%s] 文件上传失败: %s", self.service_name, ex)
            raise

    async def delete_file(self, key: str) -> bool:
        """删除 OSS 文件"""
        bucket = self._get_bucket()
        if bucket is None:
            return False

        try:
            bucket.delete_object(key)
            logger.info("[%s] 文件删除成功: %s", self.service_name, key)
            return True
        except Exception as ex:
            logger.error("[%s] 文件删除失败: %s", self.service_name, ex)
            return False

    async def get_signed_url(self, key: str, expires: int = 3600) -> str:
        """生成临时访问 URL（用于私有文件）"""
        bucket = self._get_bucket()
        if bucket is None:
            return ""

        try:
            url = bucket.sign_url("GET", key, expires)
            return url
        except Exception as ex:
            logger.error("[%s] 生成签名 URL 失败: %s", self.service_name, ex)
            return ""

    def get_file_url(self, key: str) -> str:
        """获取文件公开访问 URL"""
        if settings.aliyun_oss_cdn_domain:
            return f"https://{settings.aliyun_oss_cdn_domain}/{key}"
        return f"https://{settings.aliyun_oss_bucket_name}.{settings.aliyun_oss_endpoint}/{key}"


oss_client = AliyunOSSClient()
