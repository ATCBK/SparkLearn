"""阿里云号码认证服务：短信验证码。"""

import base64
import hashlib
import hmac
import json
import logging
import random
import string
import time
from datetime import datetime, timezone
from urllib.parse import quote as url_quote

import httpx

from .config import settings

logger = logging.getLogger("api.sms")


class AliyunSMSClient:
    """阿里云号码认证服务客户端。"""

    service_name = "aliyun_dypns"

    def is_configured(self) -> bool:
        return bool(
            settings.aliyun_sms_access_key_id
            and settings.aliyun_sms_access_key_secret
            and settings.aliyun_sms_sign_name
        )

    def generate_code(self, length: int = 6) -> str:
        return "".join(random.choices(string.digits, k=length))

    async def send_code(self, phone: str, code: str, purpose: str = "login") -> bool:
        if not self.is_configured():
            logger.warning("[%s] 短信服务未配置，使用开发模式，验证码: %s", self.service_name, code)
            return True

        try:
            params = {
                "Action": "SendSmsVerifyCode",
                "Version": "2017-05-25",
                "Format": "JSON",
                "RegionId": settings.aliyun_sms_region_id,
                "PhoneNumber": phone,
                "SignName": settings.aliyun_sms_sign_name,
                "TemplateCode": settings.aliyun_sms_template_code,
                "TemplateParam": json.dumps({"code": code, "min": str(settings.sms_code_expire_minutes)}),
            }

            url = self._build_signed_url(params)
            logger.info("[%s] 发送验证码 phone=%s purpose=%s", self.service_name, phone, purpose)

            timeout = httpx.Timeout(15.0, connect=8.0, read=15.0)
            async with httpx.AsyncClient(timeout=timeout, trust_env=settings.aliyun_sms_trust_env) as client:
                resp = await client.post(url)
                data = resp.json()

            if data.get("Code") == "OK":
                logger.info("[%s] 短信发送成功 phone=%s", self.service_name, phone)
                return True

            logger.error("[%s] 短信发送失败: %s - %s", self.service_name, data.get("Code"), data.get("Message"))
            return False

        except Exception as ex:
            logger.exception("[%s] 短信发送异常: %s: %s", self.service_name, type(ex).__name__, ex)
            return False

    def _build_signed_url(self, params: dict) -> str:
        params["AccessKeyId"] = settings.aliyun_sms_access_key_id
        params["SignatureMethod"] = "HMAC-SHA1"
        params["SignatureVersion"] = "1.0"
        params["SignatureNonce"] = str(int(time.time() * 1000))
        params["Timestamp"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        sorted_params = sorted(params.items())
        canonical_query = "&".join(
            f"{url_quote(k, safe='')}={url_quote(str(v), safe='')}"
            for k, v in sorted_params
        )
        string_to_sign = f"POST&{url_quote('/', safe='')}&{url_quote(canonical_query, safe='')}"

        sign_key = settings.aliyun_sms_access_key_secret + "&"
        signature = base64.b64encode(
            hmac.new(sign_key.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha1).digest()
        ).decode("utf-8")

        endpoint = settings.aliyun_sms_endpoint
        return f"https://{endpoint}/?{canonical_query}&Signature={url_quote(signature, safe='')}"


sms_client = AliyunSMSClient()
