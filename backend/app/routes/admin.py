from __future__ import annotations

import json
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from ..auth import bearer_scheme, create_access_token, decode_access_token, hash_password
from ..config import settings
from ..db import execute, fetch_all, fetch_one, now_iso
from ..schemas import ok

router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_ROLES = {"super_admin", "ops_admin", "teacher_admin"}
ACCOUNT_STATUSES = {"active", "frozen"}
AUDIT_LEVELS = {"info", "warning", "danger", "success"}


class AdminLoginReq(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class AdminCreateUserReq(BaseModel):
    name: str = Field(min_length=1)
    phone: str = ""
    email: str = ""
    major: str = ""
    grade: str = ""
    admin_role: str = ""
    account_status: str = "active"
    permission_score: int = 60
    password: str = "SparkLearn1"


class AdminUpdateUserReq(BaseModel):
    name: str | None = None
    admin_role: str | None = None
    account_status: str | None = None
    permission_score: int | None = None


class AdminBatchAuthorizeReq(BaseModel):
    user_ids: list[str]
    admin_role: str = ""
    permission_score: int = 90


class AdminSettingsReq(BaseModel):
    settings: dict[str, str]


def _normalize_role(value: str | None) -> str:
    role = (value or "").strip()
    if role and role not in ADMIN_ROLES:
        raise HTTPException(status_code=400, detail="管理员角色不合法")
    return role


def _normalize_status(value: str | None) -> str:
    status_value = (value or "active").strip()
    if status_value not in ACCOUNT_STATUSES:
        raise HTTPException(status_code=400, detail="账号状态不合法")
    return status_value


def _permission_score(value: int | None, default: int = 60) -> int:
    return max(0, min(100, int(value if value is not None else default)))


def _admin_payload(username: str) -> dict[str, Any]:
    return {"user_id": f"admin:{username}", "name": username, "admin_role": "super_admin"}


def _make_admin_token(username: str) -> str:
    return create_access_token(f"admin:{username}", timedelta(hours=12))


def _student_is_admin(row) -> bool:
    role = row["admin_role"] if row and "admin_role" in row.keys() else ""
    account_status = row["account_status"] if row and "account_status" in row.keys() else "active"
    return bool(role in ADMIN_ROLES and account_status == "active")


async def require_admin_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未提供管理员凭证")
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="管理员 Token 无效或已过期")
    sub = str(payload.get("sub") or "")
    if sub.startswith("admin:"):
        username = sub.removeprefix("admin:")
        if username != settings.admin_username:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理员身份无效")
        return _admin_payload(username)

    row = fetch_one(
        "SELECT user_id, name, admin_role, account_status FROM students WHERE user_id = ?",
        (sub,),
    )
    if not row or not _student_is_admin(row):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return {"user_id": row["user_id"], "name": row["name"], "admin_role": row["admin_role"]}


def _write_audit(
    actor: dict[str, Any],
    action: str,
    *,
    target_type: str = "",
    target_id: str = "",
    target_label: str = "",
    level: str = "info",
    detail: dict[str, Any] | None = None,
) -> None:
    execute(
        """
        INSERT INTO admin_audit_logs(
          actor_id, actor_name, action, target_type, target_id, target_label, level, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(actor.get("user_id") or ""),
            str(actor.get("name") or ""),
            action,
            target_type,
            target_id,
            target_label,
            level if level in AUDIT_LEVELS else "info",
            json.dumps(detail or {}, ensure_ascii=False),
            now_iso(),
        ),
    )


def _row_int(row, key: str) -> int:
    return int(row[key] or 0) if row else 0


def _user_view(row) -> dict[str, Any]:
    active = row["account_status"] if "account_status" in row.keys() else "active"
    role = row["admin_role"] if "admin_role" in row.keys() else ""
    return {
        "user_id": row["user_id"],
        "name": row["name"] or row["user_id"],
        "phone": row["phone"] if "phone" in row.keys() else "",
        "email": row["email"] if "email" in row.keys() else "",
        "major": row["major"] if "major" in row.keys() else "",
        "grade": row["grade"] if "grade" in row.keys() else "",
        "admin_role": role,
        "role_label": _role_label(role),
        "account_status": active,
        "status_label": "冻结" if active == "frozen" else "启用",
        "permission_score": int(row["permission_score"] or 0) if "permission_score" in row.keys() else 60,
        "last_login_at": row["last_login_at"] if "last_login_at" in row.keys() else "",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _role_label(role: str) -> str:
    return {
        "super_admin": "超级管理员",
        "ops_admin": "运营管理员",
        "teacher_admin": "教师管理员",
        "": "学生",
    }.get(role, role)


@router.post("/login")
async def admin_login(req: AdminLoginReq):
    if req.username != settings.admin_username or req.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="管理员账号或密码错误")
    actor = _admin_payload(req.username)
    _write_audit(actor, "管理员登录", target_type="admin", target_id=req.username, target_label=req.username, level="success")
    return ok({"token": _make_admin_token(req.username), "admin": actor})


@router.get("/me")
async def admin_me(actor: dict[str, Any] = Depends(require_admin_user)):
    return ok(actor)


@router.get("/dashboard")
async def admin_dashboard(actor: dict[str, Any] = Depends(require_admin_user)):
    total_users = _row_int(fetch_one("SELECT COUNT(1) AS cnt FROM students"), "cnt")
    admin_count = _row_int(fetch_one("SELECT COUNT(1) AS cnt FROM students WHERE admin_role <> ''"), "cnt")
    frozen_count = _row_int(fetch_one("SELECT COUNT(1) AS cnt FROM students WHERE account_status = 'frozen'"), "cnt")
    teacher_count = _row_int(fetch_one("SELECT COUNT(1) AS cnt FROM students WHERE admin_role = 'teacher_admin'"), "cnt")
    knowledge_count = _row_int(fetch_one("SELECT COUNT(1) AS cnt FROM knowledge_files"), "cnt")
    indexed_count = _row_int(fetch_one("SELECT COUNT(1) AS cnt FROM knowledge_files WHERE status = 'indexed'"), "cnt")
    tutor_conversations = _row_int(fetch_one("SELECT COUNT(1) AS cnt FROM tutor_conversations"), "cnt")
    today_logs = _row_int(fetch_one("SELECT COUNT(1) AS cnt FROM admin_audit_logs WHERE created_at >= date('now')"), "cnt")
    pending_posts = _row_int(fetch_one("SELECT COUNT(1) AS cnt FROM forum_posts WHERE status = 'pending'"), "cnt")
    danger_logs = _row_int(fetch_one("SELECT COUNT(1) AS cnt FROM admin_audit_logs WHERE level = 'danger'"), "cnt")
    tenants = [
        {
            "name": row["name"],
            "students": int(row["students"] or 0),
            "teachers": int(row["teachers"] or 0),
            "health": 100 if int(row["frozen"] or 0) == 0 else max(60, 100 - int(row["frozen"] or 0) * 10),
        }
        for row in fetch_all(
            """
            SELECT COALESCE(NULLIF(major, ''), '未分配项目') AS name,
                   COUNT(1) AS students,
                   SUM(CASE WHEN admin_role IN ('teacher_admin') THEN 1 ELSE 0 END) AS teachers,
                   SUM(CASE WHEN account_status = 'frozen' THEN 1 ELSE 0 END) AS frozen
            FROM students
            GROUP BY COALESCE(NULLIF(major, ''), '未分配项目')
            ORDER BY students DESC
            LIMIT 8
            """
        )
    ]
    risks = []
    if frozen_count:
        risks.append({"label": f"{frozen_count} 个账号处于冻结状态", "type": "账号安全", "level": "warning"})
    if pending_posts:
        risks.append({"label": f"{pending_posts} 篇帖子等待审核", "type": "内容审核", "level": "warning"})
    if knowledge_count and indexed_count < knowledge_count:
        risks.append({"label": f"{knowledge_count - indexed_count} 个知识库文件未完成索引", "type": "知识库索引", "level": "danger"})
    if danger_logs:
        risks.append({"label": f"{danger_logs} 条高风险审计事件", "type": "审计告警", "level": "danger"})

    return ok(
        {
            "cards": {
                "total_users": total_users,
                "admin_count": admin_count,
                "teacher_count": teacher_count,
                "knowledge_files": knowledge_count,
                "indexed_knowledge_files": indexed_count,
                "tutor_conversations": tutor_conversations,
                "audit_logs_today": today_logs,
                "frozen_users": frozen_count,
                "pending_posts": pending_posts,
            },
            "tenants": tenants,
            "risks": risks,
            "services": [
                {"name": "用户中心", "status": "正常", "health": 100 if frozen_count == 0 else 92},
                {"name": "Tutor 对话", "status": "正常", "health": 100 if tutor_conversations else 80},
                {"name": "知识库索引", "status": "正常" if indexed_count >= knowledge_count else "需同步", "health": 100 if knowledge_count == 0 else round(indexed_count / knowledge_count * 100)},
                {"name": "内容审核", "status": "正常" if pending_posts == 0 else "待处理", "health": max(60, 100 - pending_posts * 5)},
            ],
        }
    )


@router.get("/users")
async def admin_list_users(q: str = "", role: str = "all", actor: dict[str, Any] = Depends(require_admin_user)):
    keyword = f"%{q.strip()}%"
    rows = fetch_all(
        """
        SELECT user_id, name, phone, email, major, grade, admin_role, account_status,
               permission_score, last_login_at, created_at, updated_at
        FROM students
        WHERE (? = '' OR user_id LIKE ? OR name LIKE ? OR phone LIKE ? OR email LIKE ? OR major LIKE ?)
        ORDER BY updated_at DESC
        LIMIT 200
        """,
        (q.strip(), keyword, keyword, keyword, keyword, keyword),
    )
    items = [_user_view(row) for row in rows]
    if role == "admin":
        items = [item for item in items if item["admin_role"]]
    elif role == "frozen":
        items = [item for item in items if item["account_status"] == "frozen"]
    elif role in ADMIN_ROLES:
        items = [item for item in items if item["admin_role"] == role]
    elif role == "student":
        items = [item for item in items if not item["admin_role"]]
    stats = {
        "total": len(items),
        "admins": sum(1 for item in items if item["admin_role"]),
        "frozen": sum(1 for item in items if item["account_status"] == "frozen"),
        "students": sum(1 for item in items if not item["admin_role"]),
    }
    return ok({"items": items, "stats": stats})


@router.post("/users")
async def admin_create_user(req: AdminCreateUserReq, actor: dict[str, Any] = Depends(require_admin_user)):
    role = _normalize_role(req.admin_role)
    account_status = _normalize_status(req.account_status)
    user_id = f"user_{req.phone}" if req.phone else f"user_admin_created_{now_iso().replace(':', '').replace('.', '')}"
    existing = fetch_one("SELECT user_id FROM students WHERE user_id = ? OR (? <> '' AND phone = ?)", (user_id, req.phone, req.phone))
    if existing:
        raise HTTPException(status_code=409, detail="账号已存在")
    ts = now_iso()
    execute(
        """
        INSERT INTO students(
          user_id, name, phone, email, major, grade, password_hash, admin_role,
          account_status, permission_score, auth_provider, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin_created', ?, ?)
        """,
        (
            user_id,
            req.name.strip(),
            req.phone,
            req.email,
            req.major,
            req.grade,
            hash_password(req.password),
            role,
            account_status,
            _permission_score(req.permission_score),
            ts,
            ts,
        ),
    )
    execute("INSERT OR IGNORE INTO profiles(user_id, updated_at) VALUES (?, ?)", (user_id, ts))
    _write_audit(actor, "新增用户", target_type="user", target_id=user_id, target_label=req.name, level="success")
    row = fetch_one("SELECT * FROM students WHERE user_id = ?", (user_id,))
    return ok(_user_view(row))


@router.patch("/users/{user_id}")
async def admin_update_user(user_id: str, req: AdminUpdateUserReq, actor: dict[str, Any] = Depends(require_admin_user)):
    row = fetch_one("SELECT * FROM students WHERE user_id = ?", (user_id,))
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    updates: list[str] = []
    params: list[Any] = []
    if req.name is not None:
        updates.append("name = ?")
        params.append(req.name.strip())
    if req.admin_role is not None:
        updates.append("admin_role = ?")
        params.append(_normalize_role(req.admin_role))
    if req.account_status is not None:
        next_status = _normalize_status(req.account_status)
        updates.append("account_status = ?")
        params.append(next_status)
    if req.permission_score is not None:
        updates.append("permission_score = ?")
        params.append(_permission_score(req.permission_score))
    if updates:
        updates.append("updated_at = ?")
        params.append(now_iso())
        params.append(user_id)
        execute(f"UPDATE students SET {', '.join(updates)} WHERE user_id = ?", tuple(params))
    updated = fetch_one("SELECT * FROM students WHERE user_id = ?", (user_id,))
    action = "冻结用户" if req.account_status == "frozen" else "更新用户权限"
    _write_audit(actor, action, target_type="user", target_id=user_id, target_label=updated["name"], level="warning" if req.account_status == "frozen" else "info")
    return ok(_user_view(updated))


@router.post("/users/batch-authorize")
async def admin_batch_authorize(req: AdminBatchAuthorizeReq, actor: dict[str, Any] = Depends(require_admin_user)):
    role = _normalize_role(req.admin_role)
    score = _permission_score(req.permission_score, 90)
    updated = 0
    for user_id in req.user_ids:
        if not fetch_one("SELECT user_id FROM students WHERE user_id = ?", (user_id,)):
            continue
        execute(
            "UPDATE students SET admin_role = ?, permission_score = ?, updated_at = ? WHERE user_id = ?",
            (role, score, now_iso(), user_id),
        )
        updated += 1
    _write_audit(actor, "批量授权", target_type="user", target_id=",".join(req.user_ids), target_label=f"{updated} 个账号", level="info")
    return ok({"updated": updated})


@router.get("/audit")
async def admin_audit(level: str = "all", actor: dict[str, Any] = Depends(require_admin_user)):
    if level != "all" and level not in AUDIT_LEVELS:
        raise HTTPException(status_code=400, detail="审计级别不合法")
    rows = fetch_all(
        """
        SELECT id, actor_id, actor_name, action, target_type, target_id, target_label, level, detail_json, created_at
        FROM admin_audit_logs
        WHERE (? = 'all' OR level = ?)
        ORDER BY created_at DESC
        LIMIT 200
        """,
        (level, level),
    )
    items = [
        {
            "id": int(row["id"]),
            "actor": row["actor_name"] or row["actor_id"],
            "action": row["action"],
            "target": row["target_id"] or row["target_label"],
            "target_label": row["target_label"],
            "level": row["level"],
            "created_at": row["created_at"],
            "detail": json.loads(row["detail_json"] or "{}"),
        }
        for row in rows
    ]
    return ok({"items": items, "stats": {key: sum(1 for item in items if item["level"] == key) for key in AUDIT_LEVELS}})


def _default_settings() -> dict[str, str]:
    return {
        "audit_retention_days": "180",
        "account_security.enabled": "true",
        "account_security.audit": "true",
        "account_security.notify": "true",
        "data_backup.enabled": "true",
        "data_backup.audit": "true",
        "data_backup.notify": "false",
        "service_monitor.enabled": "true",
        "service_monitor.audit": "true",
        "service_monitor.notify": "true",
        "notification_policy.enabled": "true",
        "notification_policy.audit": "true",
        "notification_policy.notify": "true",
    }


@router.get("/settings")
async def admin_get_settings(actor: dict[str, Any] = Depends(require_admin_user)):
    data = _default_settings()
    for row in fetch_all("SELECT key, value FROM admin_settings"):
        data[row["key"]] = row["value"]
    return ok({"settings": data})


@router.put("/settings")
async def admin_save_settings(req: AdminSettingsReq, actor: dict[str, Any] = Depends(require_admin_user)):
    ts = now_iso()
    for key, value in req.settings.items():
        execute(
            """
            INSERT OR REPLACE INTO admin_settings(key, value, updated_by, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (key, str(value), str(actor.get("user_id") or ""), ts),
        )
    _write_audit(actor, "保存系统设置", target_type="settings", target_id="admin_settings", target_label=f"{len(req.settings)} 项配置", level="success")
    data = _default_settings()
    for row in fetch_all("SELECT key, value FROM admin_settings"):
        data[row["key"]] = row["value"]
    return ok({"settings": data})
