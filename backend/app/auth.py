"""JWT 认证模块

提供 JWT Token 生成/验证、FastAPI 依赖注入、认证路由。
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
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
    if settings.single_user_id:
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
    user = fetch_one("SELECT user_id, name, phone, avatar FROM students WHERE user_id = ?", (user_id,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )

    return {"user_id": user["user_id"], "name": user["name"], "phone": user["phone"]}


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict | None:
    """获取当前用户（可选，不强制登录）"""
    if settings.single_user_id:
        return {"user_id": settings.single_user_id, "phone": "", "name": "张同学"}

    if credentials is None:
        return None

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    user = fetch_one("SELECT user_id, name, phone FROM students WHERE user_id = ?", (user_id,))
    if not user:
        return None

    return {"user_id": user["user_id"], "name": user["name"], "phone": user["phone"]}


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
    user = fetch_one("SELECT user_id, name FROM students WHERE phone = ?", (req.phone,))
    if not user:
        raise HTTPException(status_code=404, detail="该手机号未注册，请先注册")

    # 更新最后登录时间
    execute("UPDATE students SET last_login_at = ? WHERE user_id = ?", (now_iso(), user["user_id"]))

    # 生成 JWT
    token = create_access_token(user["user_id"])

    return ok({
        "token": token,
        "user": {
            "user_id": user["user_id"],
            "name": user["name"],
            "phone": req.phone,
        },
    })


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

    # 检查手机号是否已注册
    existing = fetch_one("SELECT user_id FROM students WHERE phone = ?", (req.phone,))
    if existing:
        raise HTTPException(status_code=400, detail="该手机号已注册，请直接登录")

    # 标记验证码已使用
    execute("UPDATE sms_codes SET used = ? WHERE id = ?", (True, record["id"]))

    # 创建用户
    user_id = f"user_{req.phone}"
    ts = now_iso()
    name = req.name or f"用户{req.phone[-4:]}"
    execute(
        "INSERT INTO students (user_id, name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, name, req.phone, ts, ts),
    )
    execute(
        "INSERT INTO profiles (user_id, updated_at) VALUES (?, ?)",
        (user_id, ts),
    )

    # 生成 JWT
    token = create_access_token(user_id)

    return ok({
        "token": token,
        "user": {
            "user_id": user_id,
            "name": name,
            "phone": req.phone,
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
