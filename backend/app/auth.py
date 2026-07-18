"""JWT 认证模块

提供 JWT Token 生成/验证、FastAPI 依赖注入、认证路由。
"""

import logging
import shutil
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field

from .config import settings
from .db import execute, fetch_one, now_iso
from .schemas import ok
from .sms import sms_client

logger = logging.getLogger("auth")

# JWT 配置
JWT_SECRET = "sparklearn-jwt-secret-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 72


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

# HTTP Bearer scheme
bearer_scheme = HTTPBearer(auto_error=False)
bearer_scheme_required = HTTPBearer(auto_error=True)
password_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def is_demo_phone(phone: str) -> bool:
    return bool(settings.demo_user_phone) and phone == settings.demo_user_phone


def resolve_user_id_for_phone(phone: str) -> str:
    if is_demo_phone(phone):
        return settings.demo_user_id or f"user_{phone}"
    return f"user_{phone}"


def validate_password_strength(password: str) -> str | None:
    if len(password or "") < settings.auth_password_min_length:
        return f"密码至少需要 {settings.auth_password_min_length} 位"
    if settings.auth_password_require_letter and not any(ch.isalpha() for ch in password):
        return "密码需要包含字母"
    if settings.auth_password_require_digit and not any(ch.isdigit() for ch in password):
        return "密码需要包含数字"
    return None


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    return password_context.verify(password, password_hash)


def ensure_user_workspace(user_id: str) -> None:
    (settings.data_dir / "users" / user_id).mkdir(parents=True, exist_ok=True)


def seed_demo_account_data(user_id: str) -> None:
    """把当前单用户演示数据复制到演示账号空间。"""
    if not user_id or user_id == settings.single_user_id:
        return

    source_dir = settings.data_dir / "users" / settings.single_user_id
    target_dir = settings.data_dir / "users" / user_id
    if source_dir.exists():
        shutil.copytree(source_dir, target_dir, dirs_exist_ok=True)

    source_student = fetch_one("SELECT * FROM students WHERE user_id = ?", (settings.single_user_id,))
    if source_student:
        execute(
            """
            UPDATE students
            SET email = ?, major = ?, grade = ?, avatar = ?, updated_at = ?
            WHERE user_id = ?
            """,
            (
                source_student["email"] if "email" in source_student.keys() else "",
                source_student["major"] if "major" in source_student.keys() else "",
                source_student["grade"] if "grade" in source_student.keys() else "",
                source_student["avatar"] if "avatar" in source_student.keys() else "",
                now_iso(),
                user_id,
            ),
        )

    source_profile = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (settings.single_user_id,))
    if source_profile:
        execute(
            """
            INSERT INTO profiles(
              user_id, goal, knowledge_level, weak_points, learning_preference, cognitive_style,
              daily_time, practical_ability, current_stage, version, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              goal=excluded.goal,
              knowledge_level=excluded.knowledge_level,
              weak_points=excluded.weak_points,
              learning_preference=excluded.learning_preference,
              cognitive_style=excluded.cognitive_style,
              daily_time=excluded.daily_time,
              practical_ability=excluded.practical_ability,
              current_stage=excluded.current_stage,
              version=excluded.version,
              updated_at=excluded.updated_at
            """,
            (
                user_id,
                source_profile["goal"],
                source_profile["knowledge_level"],
                source_profile["weak_points"],
                source_profile["learning_preference"],
                source_profile["cognitive_style"],
                source_profile["daily_time"],
                source_profile["practical_ability"],
                source_profile["current_stage"],
                source_profile["version"],
                now_iso(),
            ),
        )

    execute("DELETE FROM mastery_records WHERE user_id = ?", (user_id,))
    execute(
        """
        INSERT INTO mastery_records(
          user_id, knowledge_point_id, knowledge_point_name, score, chapter, last_updated
        )
        SELECT ?, knowledge_point_id, knowledge_point_name, score, chapter, last_updated
        FROM mastery_records
        WHERE user_id = ?
        """,
        (user_id, settings.single_user_id),
    )
    execute("DELETE FROM contribution_days WHERE user_id = ?", (user_id,))
    execute(
        """
        INSERT INTO contribution_days(user_id, date, count)
        SELECT ?, date, count
        FROM contribution_days
        WHERE user_id = ?
        """,
        (user_id, settings.single_user_id),
    )


def initialize_configured_demo_user() -> None:
    """根据环境配置创建可直接密码登录的演示账号。"""
    phone = settings.demo_user_phone.strip()
    password = settings.demo_user_password.strip()
    if not phone or not password:
        return

    password_error = validate_password_strength(password)
    if password_error:
        logger.warning("演示账号密码不满足规则：%s", password_error)
        return

    user_id = settings.demo_user_id or f"user_{phone}"
    ts = now_iso()
    password_hash = hash_password(password)
    ensure_user_workspace(user_id)
    existing = fetch_one("SELECT user_id FROM students WHERE phone = ?", (phone,))
    if existing:
        execute(
            """
            UPDATE students
            SET user_id = ?, password_hash = ?, is_demo = 1, auth_provider = ?, updated_at = ?
            WHERE phone = ?
            """,
            (user_id, password_hash, "phone_password", ts, phone),
        )
    else:
        execute(
            """
            INSERT INTO students(
              user_id, name, phone, password_hash, is_demo, auth_provider, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)
            """,
            (user_id, "演示账号", phone, password_hash, "phone_password", ts, ts),
        )
        execute(
            "INSERT OR IGNORE INTO profiles(user_id, updated_at) VALUES (?, ?)",
            (user_id, ts),
        )

    seed_demo_account_data(user_id)


def _user_payload(row, phone: str | None = None) -> dict:
    is_demo = bool(row["is_demo"]) if row and "is_demo" in row.keys() else False
    return {
        "user_id": row["user_id"],
        "name": row["name"],
        "phone": phone if phone is not None else row["phone"],
        "is_demo": is_demo,
    }


def create_access_token(user_id: str, expires_delta: timedelta | None = None) -> str:
    """创建 JWT access token"""
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=JWT_EXPIRE_HOURS))
    payload = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """解码 JWT token，返回 payload 或 None"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """获取当前登录用户（FastAPI 依赖注入）

    兼容模式：如果 single_user_id 不为空，直接返回该用户（用于本地开发）。
    """
    # 兼容模式：本地开发跳过认证
    if settings.auth_dev_bypass and settings.single_user_id:
        return {"user_id": settings.single_user_id, "phone": "", "name": "张同学"}

    # 正式模式：验证 JWT
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证凭证",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 无效或已过期",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 中缺少用户信息",
        )

    # 验证用户是否存在
    user = fetch_one("SELECT user_id, name, phone, avatar, is_demo FROM students WHERE user_id = ?", (user_id,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )

    return _user_payload(user)


async def get_current_user_for_url_access(
    access_token: str | None = Query(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if credentials is not None:
        return await get_current_user(credentials)
    if access_token:
        return await get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=access_token))
    return await get_current_user(None)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict | None:
    """获取当前用户（可选，不强制登录）"""
    if settings.auth_dev_bypass and settings.single_user_id:
        return {"user_id": settings.single_user_id, "phone": "", "name": "张同学"}

    if credentials is None:
        return None

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    user = fetch_one("SELECT user_id, name, phone, is_demo FROM students WHERE user_id = ?", (user_id,))
    if not user:
        return None

    return _user_payload(user)


# ─── 路由 ────────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SendCodeReq(BaseModel):
    phone: str = Field(min_length=11, max_length=11)
    purpose: str = "login"  # 'login' or 'register'


class SmsLoginReq(BaseModel):
    phone: str = Field(min_length=11, max_length=11)
    code: str = Field(min_length=6, max_length=6)


class SmsRegisterReq(BaseModel):
    phone: str = Field(min_length=11, max_length=11)
    code: str = Field(min_length=6, max_length=6)
    name: str = Field(default="", max_length=50)
    password: str = ""


class PasswordLoginReq(BaseModel):
    phone: str = Field(min_length=11, max_length=11)
    password: str = Field(min_length=1)


@router.get("/check-phone/{phone}")
async def check_phone_registered(phone: str):
    """检查手机号是否已注册"""
    if len(phone) != 11:
        raise HTTPException(status_code=400, detail="手机号格式不正确")
    user = fetch_one("SELECT user_id FROM students WHERE phone = ?", (phone,))
    return ok({"registered": user is not None})


@router.post("/sms/send")
async def send_sms_code(req: SendCodeReq):
    """发送短信验证码"""
    # 频率限制：检查最近是否发送过
    recent = fetch_one(
        "SELECT created_at FROM sms_codes WHERE phone = ? ORDER BY created_at DESC LIMIT 1",
        (req.phone,),
    )
    if recent:
        last_time = datetime.fromisoformat(recent["created_at"].rstrip("Z"))
        elapsed = (_utcnow_naive() - last_time).total_seconds()
        if elapsed < settings.sms_rate_limit_seconds:
            remaining = int(settings.sms_rate_limit_seconds - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"发送过于频繁，请 {remaining} 秒后再试",
            )

    # 生成并保存验证码
    code = sms_client.generate_code()
    expires_at = _utcnow_naive() + timedelta(minutes=settings.sms_code_expire_minutes)

    execute(
        "INSERT INTO sms_codes (phone, code, purpose, expires_at, used, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (req.phone, code, req.purpose, expires_at.isoformat() + "Z", False, now_iso()),
    )

    # 发送短信
    success = await sms_client.send_code(req.phone, code, req.purpose)
    if not success:
        execute(
            "DELETE FROM sms_codes WHERE phone = ? AND code = ? AND purpose = ? AND used = ?",
            (req.phone, code, req.purpose, False),
        )
        raise HTTPException(status_code=500, detail="短信发送失败")

    return ok({"message": "验证码已发送", "expires_in": settings.sms_code_expire_minutes * 60})


@router.post("/sms/login")
async def sms_login(req: SmsLoginReq):
    """SMS 验证码登录"""
    # 查找最近的有效验证码
    record = fetch_one(
        """
        SELECT id, code, expires_at, used FROM sms_codes
        WHERE phone = ? AND purpose = 'login' AND used = ?
        ORDER BY created_at DESC LIMIT 1
        """,
        (req.phone, False),
    )

    if not record:
        raise HTTPException(status_code=400, detail="请先发送验证码")

    if record["used"]:
        raise HTTPException(status_code=400, detail="验证码已使用")

    if record["code"] != req.code:
        raise HTTPException(status_code=400, detail="验证码错误")

    # 检查过期
    expires_at = datetime.fromisoformat(record["expires_at"].rstrip("Z"))
    if _utcnow_naive() > expires_at:
        raise HTTPException(status_code=400, detail="验证码已过期")

    # 标记验证码已使用
    execute("UPDATE sms_codes SET used = ? WHERE id = ?", (True, record["id"]))

    # 查找用户（不再自动创建）
    user = fetch_one("SELECT user_id, name, phone, is_demo FROM students WHERE phone = ?", (req.phone,))
    if not user:
        raise HTTPException(status_code=404, detail="该手机号未注册，请先注册")

    # 更新最后登录时间
    execute("UPDATE students SET last_login_at = ? WHERE user_id = ?", (now_iso(), user["user_id"]))

    # 生成 JWT
    token = create_access_token(user["user_id"])

    return ok({
        "token": token,
        "user": _user_payload(user, req.phone),
    })


@router.post("/password/login")
async def password_login(req: PasswordLoginReq):
    """手机号 + 密码登录"""
    user = fetch_one(
        "SELECT user_id, name, phone, password_hash, is_demo FROM students WHERE phone = ?",
        (req.phone,),
    )
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="手机号或密码错误")

    execute("UPDATE students SET last_login_at = ? WHERE user_id = ?", (now_iso(), user["user_id"]))
    token = create_access_token(user["user_id"])
    return ok({"token": token, "user": _user_payload(user, req.phone)})


@router.post("/sms/register")
async def sms_register(req: SmsRegisterReq):
    """SMS 验证码注册"""
    # 查找最近的有效验证码
    record = fetch_one(
        """
        SELECT id, code, expires_at, used FROM sms_codes
        WHERE phone = ? AND purpose = 'register' AND used = ?
        ORDER BY created_at DESC LIMIT 1
        """,
        (req.phone, False),
    )

    if not record:
        raise HTTPException(status_code=400, detail="请先发送验证码")

    if record["used"]:
        raise HTTPException(status_code=400, detail="验证码已使用")

    if record["code"] != req.code:
        raise HTTPException(status_code=400, detail="验证码错误")

    expires_at = datetime.fromisoformat(record["expires_at"].rstrip("Z"))
    if _utcnow_naive() > expires_at:
        raise HTTPException(status_code=400, detail="验证码已过期")

    password_error = validate_password_strength(req.password)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)

    # 检查手机号是否已注册
    existing = fetch_one("SELECT user_id FROM students WHERE phone = ?", (req.phone,))
    if existing:
        raise HTTPException(status_code=400, detail="该手机号已注册，请直接登录")

    # 标记验证码已使用
    execute("UPDATE sms_codes SET used = ? WHERE id = ?", (True, record["id"]))

    # 创建用户
    user_id = resolve_user_id_for_phone(req.phone)
    ts = now_iso()
    name = req.name or f"用户{req.phone[-4:]}"
    password_hash = hash_password(req.password)
    is_demo = 1 if is_demo_phone(req.phone) else 0
    ensure_user_workspace(user_id)
    execute(
        """
        INSERT INTO students (
            user_id, name, phone, password_hash, is_demo, auth_provider, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, name, req.phone, password_hash, is_demo, "phone_password", ts, ts),
    )
    execute(
        "INSERT INTO profiles (user_id, updated_at) VALUES (?, ?)",
        (user_id, ts),
    )
    if is_demo:
        seed_demo_account_data(user_id)

    # 生成 JWT
    token = create_access_token(user_id)

    return ok({
        "token": token,
        "user": {
            "user_id": user_id,
            "name": name,
            "phone": req.phone,
            "is_demo": bool(is_demo),
        },
    })


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """获取当前用户信息"""
    return ok(current_user)


@router.post("/logout")
async def logout():
    """登出（客户端清除 token 即可）"""
    return ok({"message": "已登出"})
