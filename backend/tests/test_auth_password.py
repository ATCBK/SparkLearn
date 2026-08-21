import pytest

from app.config import settings
from app.db import execute, fetch_one, now_iso
from app.auth import initialize_configured_demo_user


def _insert_sms_code(phone: str, code: str = "123456", purpose: str = "register") -> None:
    execute(
        """
        INSERT INTO sms_codes(phone, code, purpose, expires_at, used, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (phone, code, purpose, "2099-01-01T00:00:00Z", 0, now_iso()),
    )


@pytest.mark.asyncio
async def test_register_rejects_weak_password(client):
    phone = "16600000001"
    _insert_sms_code(phone)

    resp = await client.post(
        "/api/auth/sms/register",
        json={"phone": phone, "code": "123456", "name": "测试用户", "password": "1234567"},
    )

    assert resp.status_code == 400
    assert "密码" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_register_stores_password_hash_and_login_succeeds(client):
    phone = "16600000002"
    _insert_sms_code(phone)

    register_resp = await client.post(
        "/api/auth/sms/register",
        json={"phone": phone, "code": "123456", "name": "真实用户", "password": "abc12345"},
    )

    assert register_resp.status_code == 200
    register_data = register_resp.json()["data"]
    assert register_data["user"]["phone"] == phone
    assert register_data["user"]["user_id"] == f"user_{phone}"

    row = fetch_one("SELECT password_hash FROM students WHERE phone = ?", (phone,))
    assert row is not None
    assert row["password_hash"]
    assert row["password_hash"] != "abc12345"

    login_resp = await client.post(
        "/api/auth/password/login",
        json={"phone": phone, "password": "abc12345"},
    )

    assert login_resp.status_code == 200
    login_data = login_resp.json()["data"]
    assert login_data["token"]
    assert login_data["user"]["user_id"] == f"user_{phone}"
    assert login_data["user"]["phone"] == phone


@pytest.mark.asyncio
async def test_password_login_rejects_wrong_password(client):
    phone = "16600000003"
    _insert_sms_code(phone)
    await client.post(
        "/api/auth/sms/register",
        json={"phone": phone, "code": "123456", "name": "真实用户", "password": "abc12345"},
    )

    resp = await client.post(
        "/api/auth/password/login",
        json={"phone": phone, "password": "wrong12345"},
    )

    assert resp.status_code == 401
    assert "手机号或密码错误" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_demo_phone_login_returns_demo_user(client, monkeypatch):
    phone = "16600000004"
    monkeypatch.setattr(settings, "demo_user_phone", phone)
    monkeypatch.setattr(settings, "demo_user_id", "demo_user")
    _insert_sms_code(phone)
    await client.post(
        "/api/auth/sms/register",
        json={"phone": phone, "code": "123456", "name": "演示账号", "password": "abc12345"},
    )

    resp = await client.post(
        "/api/auth/password/login",
        json={"phone": phone, "password": "abc12345"},
    )

    assert resp.status_code == 200
    user = resp.json()["data"]["user"]
    assert user["user_id"] == "demo_user"
    assert user["phone"] == phone
    assert user["is_demo"] is True

    profile_resp = await client.get(
        "/api/profile",
        headers={"Authorization": f"Bearer {resp.json()['data']['token']}"},
    )
    profile = profile_resp.json()["data"]
    assert profile["user_id"] == "demo_user"
    assert profile["major"] == "Python"


@pytest.mark.asyncio
async def test_new_registered_user_has_no_completed_profile_before_onboarding(client):
    phone = "16600000005"
    _insert_sms_code(phone)
    register_resp = await client.post(
        "/api/auth/sms/register",
        json={"phone": phone, "code": "123456", "name": "新用户", "password": "abc12345"},
    )
    token = register_resp.json()["data"]["token"]

    profile_resp = await client.get(
        "/api/profile",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert profile_resp.status_code == 404
    assert profile_resp.json() == {"success": False, "data": None, "error": "profile not found"}


@pytest.mark.asyncio
async def test_configured_demo_user_can_login_without_sms(client, monkeypatch):
    phone = "16600000006"
    monkeypatch.setattr(settings, "demo_user_phone", phone)
    monkeypatch.setattr(settings, "demo_user_password", "abc12345")
    monkeypatch.setattr(settings, "demo_user_id", "demo_user")

    initialize_configured_demo_user()

    resp = await client.post(
        "/api/auth/password/login",
        json={"phone": phone, "password": "abc12345"},
    )

    assert resp.status_code == 200
    user = resp.json()["data"]["user"]
    assert user["user_id"] == "demo_user"
    assert user["is_demo"] is True
