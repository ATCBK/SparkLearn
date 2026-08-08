from __future__ import annotations

import pytest

from app.auth import create_access_token, hash_password
from app.config import settings
from app.db import execute, fetch_one, now_iso


def _insert_student(user_id: str, phone: str, name: str = "真实用户", *, admin_role: str = "") -> None:
    ts = now_iso()
    execute(
        """
        INSERT INTO students(
          user_id, name, phone, password_hash, admin_role, account_status, permission_score, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'active', 60, ?, ?)
        """,
        (user_id, name, phone, hash_password("abc12345"), admin_role, ts, ts),
    )


async def _admin_headers(client) -> dict[str, str]:
    resp = await client.post(
        "/api/admin/login",
        json={"username": settings.admin_username, "password": settings.admin_password},
    )
    assert resp.status_code == 200
    token = resp.json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_admin_login_and_normal_user_is_forbidden(client) -> None:
    _insert_student("user_normal", "16610000001")
    user_token = create_access_token("user_normal")

    denied = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {user_token}"})
    assert denied.status_code == 403

    headers = await _admin_headers(client)
    allowed = await client.get("/api/admin/users", headers=headers)
    assert allowed.status_code == 200
    assert any(item["user_id"] == "user_normal" for item in allowed.json()["data"]["items"])


@pytest.mark.asyncio
async def test_admin_dashboard_uses_real_admin_contract(client) -> None:
    _insert_student("user_dashboard_contract", "16610000006")
    headers = await _admin_headers(client)

    resp = await client.get("/api/admin/dashboard", headers=headers)

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "cards" in data
    assert "tenants" in data
    assert "services" in data
    assert "total_users" in data["cards"]
    assert "student_count" not in data


@pytest.mark.asyncio
async def test_admin_rejects_invalid_token_and_forum_admin_bypass(client) -> None:
    _insert_student("user_forum_bypass", "16610000005")
    user_token = create_access_token("user_forum_bypass")

    fake = await client.get("/api/admin/me", headers={"Authorization": "Bearer fake-admin-token"})
    assert fake.status_code == 401

    forum_admin = await client.get(
        "/api/forum/admin/posts?status=all",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert forum_admin.status_code == 403


@pytest.mark.asyncio
async def test_admin_freeze_user_really_blocks_platform_login_and_access(client) -> None:
    _insert_student("user_freeze_target", "16610000002", name="冻结目标")
    headers = await _admin_headers(client)

    resp = await client.patch(
        "/api/admin/users/user_freeze_target",
        json={"account_status": "frozen"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["account_status"] == "frozen"

    login = await client.post(
        "/api/auth/password/login",
        json={"phone": "16610000002", "password": "abc12345"},
    )
    assert login.status_code == 403

    profile = await client.get(
        "/api/profile",
        headers={"Authorization": f"Bearer {create_access_token('user_freeze_target')}"},
    )
    assert profile.status_code == 403

    audit = await client.get("/api/admin/audit", headers=headers)
    assert audit.status_code == 200
    assert any("冻结" in item["action"] and item["target"] == "user_freeze_target" for item in audit.json()["data"]["items"])


@pytest.mark.asyncio
async def test_admin_batch_authorize_and_settings_are_persisted(client) -> None:
    _insert_student("user_auth_a", "16610000003")
    _insert_student("user_auth_b", "16610000004")
    headers = await _admin_headers(client)

    authorize = await client.post(
        "/api/admin/users/batch-authorize",
        json={"user_ids": ["user_auth_a", "user_auth_b"], "permission_score": 95, "admin_role": "teacher_admin"},
        headers=headers,
    )
    assert authorize.status_code == 200
    assert authorize.json()["data"]["updated"] == 2

    row = fetch_one("SELECT admin_role, permission_score FROM students WHERE user_id = ?", ("user_auth_a",))
    assert row is not None
    assert row["admin_role"] == "teacher_admin"
    assert row["permission_score"] == 95

    save_settings = await client.put(
        "/api/admin/settings",
        json={"settings": {"audit_retention_days": "365", "account_security.enabled": "false"}},
        headers=headers,
    )
    assert save_settings.status_code == 200

    settings_resp = await client.get("/api/admin/settings", headers=headers)
    assert settings_resp.status_code == 200
    settings_map = settings_resp.json()["data"]["settings"]
    assert settings_map["audit_retention_days"] == "365"
    assert settings_map["account_security.enabled"] == "false"
