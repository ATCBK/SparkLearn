import pytest

from app.db import fetch_one
from app.config import settings
from app.sms import AliyunSMSClient
import app.sms as sms_module
import app.auth as auth_module


@pytest.mark.asyncio
async def test_aliyun_sms_client_disables_env_proxy_by_default(monkeypatch):
    captured_kwargs = {}

    class FakeResponse:
        def json(self):
            return {"Code": "OK"}

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            captured_kwargs.update(kwargs)

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url):
            assert url.startswith("https://dypnsapi.aliyuncs.com/")
            return FakeResponse()

    monkeypatch.setattr(settings, "aliyun_sms_access_key_id", "test-id")
    monkeypatch.setattr(settings, "aliyun_sms_access_key_secret", "test-secret")
    monkeypatch.setattr(settings, "aliyun_sms_sign_name", "SparkLearn")
    monkeypatch.setattr(settings, "aliyun_sms_endpoint", "dypnsapi.aliyuncs.com")
    monkeypatch.setattr(settings, "aliyun_sms_trust_env", False)
    monkeypatch.setattr(sms_module.httpx, "AsyncClient", FakeAsyncClient)

    sent = await AliyunSMSClient().send_code("16600000000", "123456", "register")

    assert sent is True
    assert captured_kwargs["trust_env"] is False


@pytest.mark.asyncio
async def test_sms_send_failure_cleans_pending_code(client, monkeypatch):
    class FakeSmsClient:
        def generate_code(self):
            return "123456"

        async def send_code(self, phone, code, purpose):
            return False

    monkeypatch.setattr(auth_module, "sms_client", FakeSmsClient())

    resp = await client.post(
        "/api/auth/sms/send",
        json={"phone": "16600000000", "purpose": "register"},
    )

    assert resp.status_code == 500
    row = fetch_one("SELECT id FROM sms_codes WHERE phone = ?", ("16600000000",))
    assert row is None
