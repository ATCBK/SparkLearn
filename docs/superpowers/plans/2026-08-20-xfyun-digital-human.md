# 讯飞数字人安全播报与视频上下文实施计划

> **给智能体执行者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项实施。所有执行步骤使用复选框跟踪。

**目标：** 在 SparkLearn 视频学习页安全接入讯飞数字人短期签名会话，让完整 AI 回答驱动数字人播报，并让问答优先理解当前视频播放位置。

**架构：** 浏览器继续运行本地 `avatar-sdk-web_3.2.3.1002`，FastAPI 负责使用后端凭据签发短期 WebSocket URL，原始 APISecret 不离开后端。视频问答在现有 memory/RAG/SSE 链路上增加登录用户所有权、滑动 TTL 和 `current_time_ms`，前端收到 `done.text` 后通过可测试的讯飞驱动调用 `interrupt()` 与 `writeText()`。

**技术栈：** FastAPI、Pydantic Settings、Python HMAC-SHA256、pytest、Next.js 16、React 19、TypeScript、Vitest、Playwright、讯飞 `avatar-sdk-web_3.2.3.1002`

**设计文档：** `docs/superpowers/specs/2026-08-20-xfyun-digital-human-design.md`

## 全局约束

- 所有代码、注释、测试名称、提交信息和文档使用简体中文，文件编码统一为 UTF-8。
- 原始 `XF_DH_API_SECRET` 永远不得出现在前端类型、API 响应、浏览器持久化存储或日志中。
- `XF_DH_SERVER_URL` 必须是与 SDK、产品权限和区域匹配的绝对 `wss://` 地址。
- 短期签名客户端有效期固定为 `XF_DH_SIGNED_URL_TTL_SEC=240` 秒。
- 视频记忆滑动有效期固定为 `XF_DH_MEMORY_TTL_SEC=1800` 秒。
- 前后端统一使用 `current_time_ms`，类型为非负整数，timeline 继续使用毫秒。
- 核心版本只在完整回答结束后播报一次，不实现逐句流式播报和 ASR。
- 数字人异常不得让文字问答失败。
- 不删除旧 Three.js 数字人文件；确认生产稳定后另开清理任务。
- 不改动当前工作区中与本功能无关的未提交文件。

---

## 文件职责与变更地图

### 新增文件

- `backend/app/xfyun_digital_human_auth.py`：只负责校验讯飞服务 URL 并生成短期签名 URL。
- `backend/tests/test_xfyun_digital_human_auth.py`：签名算法、协议校验和查询参数测试。
- `frontend/src/components/digital-human/xfyun-avatar-driver.ts`：封装第三方 SDK 的播报、打断、静音和销毁操作。
- `frontend/src/components/digital-human/xfyun-avatar-driver.test.ts`：使用假 SDK 平台验证驱动行为。
- `frontend/test/digital-human-xfyun.spec.ts`：通过假 SDK 和假 SSE 验证页面端到端闭环。

### 修改文件

- `backend/app/config.py`：增加签名有效期和记忆 TTL 设置，要求数字人服务地址为绝对地址。
- `backend/app/routes/num_person.py`：移除敏感配置响应，增加安全会话接口，所有记忆接口绑定当前用户。
- `backend/app/schemas/num_person.py`：增加 `current_time_ms`，去掉客户端可伪造的 `user_id`。
- `backend/app/video_memory_service.py`：保存记忆所有者，改为滑动 TTL，合并时间片段与语义片段。
- `backend/app/num_person_service.py`：注入当前播放上下文，SSE 输出 `sources` 和带完整文本的 `done`。
- `backend/tests/test_num_person.py`：覆盖安全响应、用户隔离、时间检索、滑动 TTL 和 SSE 完整文本。
- `frontend/src/lib/api/types.ts`：拆分安全配置类型和短期会话类型。
- `frontend/src/lib/api/real.ts`：申请数字人会话，发送 `current_time_ms`，读取 `done.text`。
- `frontend/src/lib/api/index.ts`：导出新的会话 API 和类型。
- `frontend/src/components/digital-human/XfyunDigitalHumanLive.tsx`：改用短期会话，暴露播报句柄，提供声音授权和有限重连。
- `frontend/src/app/(shell)/video/page.tsx`：捕获播放器时间、暂停视频、触发一次完整回答播报。
- `docs/讯飞数字人接入配置.md`：更新为短期签名安全接入说明。

---

### 任务 1：实现讯飞数字人签名模块

**文件：**

- 创建：`backend/app/xfyun_digital_human_auth.py`
- 创建：`backend/tests/test_xfyun_digital_human_auth.py`
- 修改：`backend/app/config.py:83-107`

**接口：**

- 输入：`base_url`、`api_key`、`api_secret` 和可注入的 UTC 时间。
- 输出：`build_xfyun_digital_human_signed_url(...) -> str`。
- 后续任务依赖：任务 2 的 `/digital-human/session` 直接调用该函数。

- [ ] **步骤 1：先写签名 URL 的失败测试**

创建 `backend/tests/test_xfyun_digital_human_auth.py`：

```python
import base64
import hashlib
import hmac
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

import pytest

from app.xfyun_digital_human_auth import build_xfyun_digital_human_signed_url


FIXED_NOW = datetime(2026, 8, 20, 2, 0, 0, tzinfo=UTC)


def test_build_signed_url_uses_get_hmac_and_preserves_query():
    signed = build_xfyun_digital_human_signed_url(
        "wss://avatar.example.com/v1/interact?region=cn-east",
        "test-key",
        "test-secret",
        now=FIXED_NOW,
    )
    parsed = urlparse(signed)
    query = parse_qs(parsed.query)

    assert parsed.scheme == "wss"
    assert parsed.netloc == "avatar.example.com"
    assert parsed.path == "/v1/interact"
    assert query["region"] == ["cn-east"]
    assert query["host"] == ["avatar.example.com"]
    assert query["date"] == ["Thu, 20 Aug 2026 02:00:00 GMT"]

    signature_origin = (
        "host: avatar.example.com\n"
        "date: Thu, 20 Aug 2026 02:00:00 GMT\n"
        "GET /v1/interact HTTP/1.1"
    )
    expected_signature = base64.b64encode(
        hmac.new(
            b"test-secret",
            signature_origin.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    ).decode("ascii")
    authorization = base64.b64decode(query["authorization"][0]).decode("utf-8")
    assert 'api_key="test-key"' in authorization
    assert f'signature="{expected_signature}"' in authorization


@pytest.mark.parametrize(
    "url",
    [
        "",
        "/vmss",
        "http://avatar.example.com/v1/interact",
        "https://avatar.example.com/v1/interact",
    ],
)
def test_build_signed_url_rejects_non_secure_absolute_url(url: str):
    with pytest.raises(ValueError, match="数字人服务地址"):
        build_xfyun_digital_human_signed_url(
            url,
            "test-key",
            "test-secret",
            now=FIXED_NOW,
        )


def test_build_signed_url_rejects_empty_credentials():
    with pytest.raises(ValueError, match="鉴权配置不完整"):
        build_xfyun_digital_human_signed_url(
            "wss://avatar.example.com/v1/interact",
            "",
            "",
            now=FIXED_NOW,
        )
```

- [ ] **步骤 2：运行测试，确认因模块不存在而失败**

运行目录：`backend/`

```powershell
python -m pytest tests/test_xfyun_digital_human_auth.py -q
```

预期：测试收集阶段因 `app.xfyun_digital_human_auth` 不存在而失败。

- [ ] **步骤 3：实现最小签名模块**

创建 `backend/app/xfyun_digital_human_auth.py`：

```python
import base64
import hashlib
import hmac
from datetime import UTC, datetime
from email.utils import format_datetime
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


def build_xfyun_digital_human_signed_url(
    base_url: str,
    api_key: str,
    api_secret: str,
    *,
    now: datetime | None = None,
) -> str:
    if not api_key or not api_secret:
        raise ValueError("讯飞数字人鉴权配置不完整")

    parsed = urlparse(base_url)
    if parsed.scheme != "wss" or not parsed.netloc:
        raise ValueError("讯飞数字人服务地址必须是安全的绝对地址")

    current = (now or datetime.now(UTC)).astimezone(UTC)
    date = format_datetime(current, usegmt=True)
    path = parsed.path or "/"
    signature_origin = f"host: {parsed.netloc}\ndate: {date}\nGET {path} HTTP/1.1"
    signature = base64.b64encode(
        hmac.new(
            api_secret.encode("utf-8"),
            signature_origin.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    ).decode("ascii")
    authorization_origin = (
        f'api_key="{api_key}", algorithm="hmac-sha256", '
        f'headers="host date request-line", signature="{signature}"'
    )
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.update(
        {
            "authorization": base64.b64encode(
                authorization_origin.encode("utf-8")
            ).decode("ascii"),
            "date": date,
            "host": parsed.netloc,
        }
    )
    return urlunparse(parsed._replace(query=urlencode(query)))
```

- [ ] **步骤 4：增加配置字段**

在 `backend/app/config.py` 的数字人配置段增加：

```python
    xf_dh_signed_url_ttl_sec: int = 240
    xf_dh_memory_ttl_sec: int = 1800
```

将 `xf_dh_server_url` 默认值改为空字符串，禁止默认回退到含义不明确的 `/vmss`：

```python
    xf_dh_server_url: str = ""
```

- [ ] **步骤 5：运行签名测试**

```powershell
python -m pytest tests/test_xfyun_digital_human_auth.py -q
```

预期：全部通过。

- [ ] **步骤 6：提交任务 1**

```powershell
git add backend/app/config.py backend/app/xfyun_digital_human_auth.py backend/tests/test_xfyun_digital_human_auth.py
git commit -m "功能：新增讯飞数字人短期签名服务"
```

---

### 任务 2：收紧配置响应并新增安全会话接口

**文件：**

- 修改：`backend/app/routes/num_person.py:1-60`
- 修改：`backend/tests/test_num_person.py`

**接口：**

- 消费：任务 1 的 `build_xfyun_digital_human_signed_url(...)`。
- 产出：`GET /api/num-person/digital-human/config` 的无密钥响应。
- 产出：`POST /api/num-person/digital-human/session` 的短期 `signed_url` 响应。

- [ ] **步骤 1：写配置脱敏和会话响应测试**

在 `backend/tests/test_num_person.py` 增加：

```python
@pytest.mark.asyncio
async def test_digital_human_config_never_returns_credentials(np_client, monkeypatch):
    from app import config as cfg

    monkeypatch.setattr(cfg.settings, "xf_dh_enabled", True)
    monkeypatch.setattr(cfg.settings, "xf_dh_app_id", "app-id")
    monkeypatch.setattr(cfg.settings, "xf_dh_api_key", "api-key")
    monkeypatch.setattr(cfg.settings, "xf_dh_api_secret", "api-secret")
    monkeypatch.setattr(cfg.settings, "xf_dh_avatar_id", "avatar-id")
    monkeypatch.setattr(
        cfg.settings,
        "xf_dh_server_url",
        "wss://avatar.example.com/v1/interact",
    )

    response = await np_client.get("/api/num-person/digital-human/config")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["configured"] is True
    assert data["provider"] == "xfyun"
    assert "api_key" not in data
    assert "api_secret" not in data
    assert "server_url" not in data
    assert "app_id" not in data


@pytest.mark.asyncio
async def test_digital_human_session_returns_no_store_signed_url(np_client, monkeypatch):
    from app import config as cfg

    monkeypatch.setattr(cfg.settings, "xf_dh_enabled", True)
    monkeypatch.setattr(cfg.settings, "xf_dh_app_id", "app-id")
    monkeypatch.setattr(cfg.settings, "xf_dh_api_key", "api-key")
    monkeypatch.setattr(cfg.settings, "xf_dh_api_secret", "api-secret")
    monkeypatch.setattr(cfg.settings, "xf_dh_avatar_id", "avatar-id")
    monkeypatch.setattr(
        cfg.settings,
        "xf_dh_server_url",
        "wss://avatar.example.com/v1/interact",
    )
    monkeypatch.setattr(cfg.settings, "xf_dh_signed_url_ttl_sec", 240)

    response = await np_client.post("/api/num-person/digital-human/session")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["app_id"] == "app-id"
    assert data["signed_url"].startswith("wss://avatar.example.com/v1/interact?")
    assert data["expires_at"] > int(time.time())
    assert "no-store" in response.headers["cache-control"]
    assert response.headers["pragma"] == "no-cache"
    assert "api_secret" not in response.text


@pytest.mark.asyncio
async def test_digital_human_session_rejects_incomplete_config(np_client, monkeypatch):
    from app import config as cfg

    monkeypatch.setattr(cfg.settings, "xf_dh_enabled", True)
    monkeypatch.setattr(cfg.settings, "xf_dh_api_secret", "")
    response = await np_client.post("/api/num-person/digital-human/session")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "DH_NOT_CONFIGURED"
```

- [ ] **步骤 2：运行定向测试，确认当前响应泄密且会话接口不存在**

```powershell
python -m pytest tests/test_num_person.py -k "digital_human" -q
```

预期：配置脱敏断言失败，会话接口返回 404。

- [ ] **步骤 3：修改配置接口响应**

在 `backend/app/routes/num_person.py` 删除 `server_url`、`app_id`、`api_key`、`api_secret`，保留 `sdk_url`、形象、场景、舞台、TTS 和流配置。`configured` 由 APPID、APIKey、APISecret、Avatar ID 和绝对 WSS 服务地址共同判断。

- [ ] **步骤 4：实现安全会话接口**

增加导入：

```python
import time

from fastapi import APIRouter, Depends, HTTPException, Response

from ..auth import get_current_user
from ..xfyun_digital_human_auth import build_xfyun_digital_human_signed_url
```

增加接口：

```python
@router.post("/digital-human/session")
async def digital_human_session(
    response: Response,
    current_user: dict = Depends(get_current_user),
):
    del current_user
    if not settings.xf_dh_enabled:
        raise HTTPException(
            status_code=404,
            detail={"code": "DH_DISABLED", "message": "讯飞数字人未启用"},
        )

    configured = all(
        [
            settings.xf_dh_app_id,
            settings.xf_dh_api_key,
            settings.xf_dh_api_secret,
            settings.xf_dh_avatar_id,
            settings.xf_dh_server_url,
        ]
    )
    if not configured:
        raise HTTPException(
            status_code=503,
            detail={"code": "DH_NOT_CONFIGURED", "message": "讯飞数字人配置不完整"},
        )

    try:
        signed_url = build_xfyun_digital_human_signed_url(
            settings.xf_dh_server_url,
            settings.xf_dh_api_key,
            settings.xf_dh_api_secret,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "DH_SERVER_URL_INVALID", "message": str(exc)},
        ) from exc

    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return ok(
        {
            "app_id": settings.xf_dh_app_id,
            "signed_url": signed_url,
            "expires_at": int(time.time()) + settings.xf_dh_signed_url_ttl_sec,
            "scene_id": settings.xf_dh_scene_id,
            "scene_version": settings.xf_dh_scene_version,
        }
    )
```

- [ ] **步骤 5：运行配置和会话测试**

```powershell
python -m pytest tests/test_num_person.py -k "digital_human" -q
```

预期：全部通过，并且测试响应中没有 `api_secret`。

- [ ] **步骤 6：提交任务 2**

```powershell
git add backend/app/routes/num_person.py backend/tests/test_num_person.py
git commit -m "安全：禁止前端获取讯飞长期密钥"
```

---

### 任务 3：增加记忆所有权、滑动 TTL 和时间片段检索

**文件：**

- 修改：`backend/app/schemas/num_person.py`
- 修改：`backend/app/video_memory_service.py`
- 修改：`backend/app/routes/num_person.py`
- 修改：`backend/tests/test_num_person.py`

**接口：**

- 产出：`search(memory_id, query, user_id, top_k=3, current_time_ms=None)`。
- 产出：`get_memory(memory_id, user_id)` 和 `clear_memory(memory_id, user_id)`。
- 后续任务依赖：任务 4 使用检索结果中的 `start_ms`、`end_ms` 和 `is_current`。

- [ ] **步骤 1：把测试 timeline 改为连续的明确时间段**

在 `backend/tests/test_num_person.py` 把 `TEST_SEGMENTS` 调整为：

```python
TEST_SEGMENTS = [
    _make_segment(
        "s1",
        "变量定义",
        "在Python中，变量不需要声明类型，直接赋值即可创建变量。",
        0,
        10_000,
    ),
    _make_segment(
        "s2",
        "基本数据类型",
        "Python有整数、浮点数、字符串、布尔值等基本数据类型。",
        10_001,
        20_000,
    ),
    _make_segment(
        "s3",
        "类型转换",
        "可以使用int()、float()、str()等函数进行类型转换。",
        20_001,
        30_000,
    ),
]
```

- [ ] **步骤 2：写时间优先、用户隔离和滑动 TTL 测试**

增加：

```python
def test_search_places_current_segment_first(np_client):
    import app.video_memory_service as vms

    loaded = vms.load_memory(TEST_VIDEO_ID, "test_user")
    results = vms.search(
        loaded["memory_id"],
        "为什么这样写",
        "test_user",
        current_time_ms=25_000,
    )
    assert results[0]["segment_id"] == "s3"
    assert results[0]["is_current"] is True
    assert results[0]["start_ms"] == 20_001
    assert len({item["segment_id"] for item in results}) == len(results)


def test_memory_is_hidden_from_other_user(np_client):
    import app.video_memory_service as vms

    loaded = vms.load_memory(TEST_VIDEO_ID, "owner")
    assert vms.get_memory(loaded["memory_id"], "other-user") is None
    assert vms.clear_memory(loaded["memory_id"], "other-user") is False
    with pytest.raises(vms.MemoryNotFoundError):
        vms.search(loaded["memory_id"], "变量", "other-user")


def test_memory_uses_sliding_expiry(np_client, monkeypatch):
    import app.video_memory_service as vms

    now = 10_000.0
    monkeypatch.setattr(vms.time, "time", lambda: now)
    loaded = vms.load_memory(TEST_VIDEO_ID, "test_user")
    memory_id = loaded["memory_id"]

    monkeypatch.setattr(vms.time, "time", lambda: now + 1_700)
    assert vms.get_memory(memory_id, "test_user") is not None
    assert vms._memories[memory_id]["last_access_at"] == now + 1_700

    monkeypatch.setattr(vms.time, "time", lambda: now + 3_501)
    assert vms.get_memory(memory_id, "test_user") is None
```

- [ ] **步骤 3：运行新增测试，确认签名不匹配和行为未实现**

```powershell
python -m pytest tests/test_num_person.py -k "current_segment or other_user or sliding_expiry" -q
```

预期：因函数签名和固定 TTL 行为不同而失败。

- [ ] **步骤 4：修改 Schema**

把 `backend/app/schemas/num_person.py` 调整为：

```python
class MemoryLoadReq(BaseModel):
    video_id: str = Field(..., min_length=1)


class ChatReq(BaseModel):
    memory_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=2000)
    current_time_ms: int | None = Field(default=None, ge=0)
    history: list[dict[str, str]] = Field(default_factory=list)


class MemoryInfo(BaseModel):
    memory_id: str
    video_id: str
    video_title: str
    segment_count: int
    created_at: str
    ttl_sec: int = 1800
```

客户端不再提交可信度不足的 `user_id`。

- [ ] **步骤 5：实现所有权和滑动 TTL**

在 `video_memory_service.py`：

```python
def _memory_ttl_sec() -> int:
    return max(60, int(settings.xf_dh_memory_ttl_sec))


def _get_owned_memory(memory_id: str, user_id: str) -> dict[str, Any]:
    memory = _memories.get(memory_id)
    if not memory or memory["user_id"] != user_id:
        raise MemoryNotFoundError(f"记忆 {memory_id} 不存在")
    if time.time() - memory["last_access_at"] > _memory_ttl_sec():
        del _memories[memory_id]
        raise MemoryNotFoundError(f"记忆 {memory_id} 已过期，请重新选择视频")
    memory["last_access_at"] = time.time()
    return memory
```

`load_memory()` 保存：

```python
    now = time.time()
    _memories[memory_id] = {
        "video_id": video_id,
        "user_id": user_id,
        "title": title,
        "segments": enriched,
        "created_at": now,
        "last_access_at": now,
    }
```

`get_memory`、`clear_memory` 和 `search` 全部增加 `user_id` 参数。`get_memory` 捕获 `MemoryNotFoundError` 并返回 `None`，`clear_memory` 对不存在或非所有者返回 `False`，`search` 保持抛出 `MemoryNotFoundError`。

- [ ] **步骤 6：实现当前位置合并检索**

增加辅助函数：

```python
def _current_segment(
    segments: list[dict[str, Any]],
    current_time_ms: int | None,
) -> dict[str, Any] | None:
    if current_time_ms is None:
        return None
    for segment in segments:
        if segment["start_ms"] <= current_time_ms <= segment["end_ms"]:
            return segment
    nearest = min(
        segments,
        key=lambda item: min(
            abs(current_time_ms - item["start_ms"]),
            abs(current_time_ms - item["end_ms"]),
        ),
        default=None,
    )
    if nearest is None:
        return None
    distance = min(
        abs(current_time_ms - nearest["start_ms"]),
        abs(current_time_ms - nearest["end_ms"]),
    )
    return nearest if distance <= 15_000 else None
```

语义结果生成后，将当前片段插入第一位并按 `segment_id` 去重。统一返回：

```python
{
    "segment_id": segment["segment_id"],
    "title": segment["title"],
    "narration": segment["narration"],
    "start_ms": segment["start_ms"],
    "end_ms": segment["end_ms"],
    "score": score,
    "is_current": segment["segment_id"] == current_id,
}
```

- [ ] **步骤 7：让路由从登录态传入用户 ID**

给 memory load/get/delete/chat 路由增加：

```python
current_user: dict = Depends(get_current_user)
```

调用服务时统一传：

```python
user_id = current_user["user_id"]
```

不要再读取请求体中的 `user_id`。

- [ ] **步骤 8：更新原固定 TTL 测试并运行全部记忆测试**

把原 `test_memory_expiry` 改为设置 `last_access_at`，并断言返回的 `ttl_sec` 等于 `1800`。

```powershell
python -m pytest tests/test_num_person.py -k "memory or current_segment" -q
```

预期：全部通过。

- [ ] **步骤 9：提交任务 3**

```powershell
git add backend/app/schemas/num_person.py backend/app/video_memory_service.py backend/app/routes/num_person.py backend/tests/test_num_person.py
git commit -m "功能：问答记忆支持用户隔离和视频时间片段"
```

---

### 任务 4：让 SSE 返回引用片段和完整回答

**文件：**

- 修改：`backend/app/num_person_service.py`
- 修改：`backend/app/routes/num_person.py`
- 修改：`backend/tests/test_num_person.py`

**接口：**

- 消费：任务 3 的带 `is_current`、起止时间的检索结果。
- 产出：`sources` 事件和 `done {text, total_tokens}` 事件。
- 后续任务依赖：任务 5 和任务 8 以 `done.text` 作为唯一播报文本。

- [ ] **步骤 1：写 SSE 完整文本测试**

在 `backend/tests/test_num_person.py` 增加：

```python
@pytest.mark.asyncio
async def test_chat_emits_sources_and_complete_done_text(np_client, monkeypatch):
    import app.num_person_service as service

    async def fake_stream_llm(messages):
        assert "当前播放位置：25.0 秒" in messages[0]["content"]
        yield "token", {"text": "类型"}
        yield "token", {"text": "转换"}
        yield "done", {"text": "类型转换", "total_tokens": 2}

    monkeypatch.setattr(service, "_stream_llm", fake_stream_llm)
    loaded = await np_client.post(
        "/api/num-person/memory/load",
        json={"video_id": TEST_VIDEO_ID},
    )
    memory_id = loaded.json()["data"]["memory_id"]

    response = await np_client.post(
        "/api/num-person/chat",
        json={
            "memory_id": memory_id,
            "message": "这里是什么意思",
            "current_time_ms": 25_000,
            "history": [],
        },
    )
    assert response.status_code == 200
    assert '"type": "sources"' in response.text
    assert '"segment_id": "s3"' in response.text
    assert '"type": "done"' in response.text
    assert '"text": "类型转换"' in response.text
```

- [ ] **步骤 2：运行测试，确认 `sources` 和 `done.text` 缺失**

```powershell
python -m pytest tests/test_num_person.py::test_chat_emits_sources_and_complete_done_text -q
```

预期：失败。

- [ ] **步骤 3：扩展系统提示和 chat_stream 签名**

把 `chat_stream` 定义调整为：

```python
async def chat_stream(
    memory_id: str,
    message: str,
    history: list[dict[str, str]],
    user_id: str,
    current_time_ms: int | None = None,
) -> AsyncGenerator[tuple[str, dict[str, Any]], None]:
```

通过任务 3 的接口获取记忆和片段，并在调用 LLM 前发送来源：

```python
    yield (
        "sources",
        {
            "segments": [
                {
                    "segment_id": item["segment_id"],
                    "start_ms": item["start_ms"],
                    "end_ms": item["end_ms"],
                    "is_current": item["is_current"],
                }
                for item in segments
            ]
        },
    )
```

系统提示加入：

```python
position_text = (
    f"{current_time_ms / 1000:.1f} 秒"
    if current_time_ms is not None
    else "未提供"
)
current_context = next(
    (item for item in segments if item["is_current"]),
    None,
)
```

明确要求“这里、这段、刚才、现在、这个”等指代问题优先解释 `current_context`。

- [ ] **步骤 4：让底层 LLM 流聚合完整文本**

在 `_stream_llm()` 中使用列表聚合：

```python
    pieces: list[str] = []
    total_tokens = 0
```

收到 content 时：

```python
    pieces.append(content)
    total_tokens += 1
    yield "token", {"text": content}
```

结束时：

```python
    yield "done", {"text": "".join(pieces), "total_tokens": total_tokens}
```

- [ ] **步骤 5：更新 chat 路由参数**

```python
async for event_type, payload in chat_stream(
    req.memory_id,
    req.message,
    req.history,
    current_user["user_id"],
    req.current_time_ms,
):
    yield event_type, payload
```

- [ ] **步骤 6：运行 num-person 后端测试**

```powershell
python -m pytest tests/test_num_person.py tests/test_xfyun_digital_human_auth.py -q
```

预期：全部通过。

- [ ] **步骤 7：提交任务 4**

```powershell
git add backend/app/num_person_service.py backend/app/routes/num_person.py backend/tests/test_num_person.py
git commit -m "功能：视频问答返回引用片段和完整回答"
```

---

### 任务 5：更新前端安全 API 契约

**文件：**

- 修改：`frontend/src/lib/api/types.ts:830-866`
- 修改：`frontend/src/lib/api/real.ts:2137-2180`
- 修改：`frontend/src/lib/api/index.ts:150-185`

**接口：**

- 消费：任务 2 的安全配置和会话响应、任务 4 的 `done.text`。
- 产出：`DigitalHumanSession`、`getDigitalHumanSession()` 和新 `chatWithDigitalHuman()` 签名。
- 后续任务依赖：任务 7 使用会话 API，任务 8 传入视频时间。

- [ ] **步骤 1：修改 `DigitalHumanConfig` 并新增会话类型**

从 `DigitalHumanConfig` 删除：

```typescript
server_url: string
app_id: string
api_key: string
api_secret: string
```

新增：

```typescript
export interface DigitalHumanSession {
  app_id: string
  signed_url: string
  expires_at: number
  scene_id?: string
  scene_version?: string
}
```

- [ ] **步骤 2：新增会话 API**

在 `frontend/src/lib/api/real.ts` 增加类型导入并实现：

```typescript
export async function getDigitalHumanSession(): Promise<DigitalHumanSession> {
  return fetchJson<DigitalHumanSession>('/api/num-person/digital-human/session', {
    method: 'POST',
  })
}
```

- [ ] **步骤 3：给问答请求增加视频时间并优先返回 done.text**

把方法改为：

```typescript
export async function chatWithDigitalHuman(
  memoryId: string,
  message: string,
  history: Array<{ role: string; content: string }>,
  currentTimeMs: number | null,
  onEvent?: (evt: SseEvent) => void,
): Promise<string> {
  const events = await readSSE('/api/num-person/chat', {
    memory_id: memoryId,
    message,
    history,
    current_time_ms: currentTimeMs,
  }, onEvent)
  const done = [...events].reverse().find(event => event.type === 'done')
  const complete = String(done?.payload.text || '')
  if (complete) return complete
  return events
    .filter(event => event.type === 'token' || event.type === 'text')
    .map(event => String(event.payload.text || event.payload.content || ''))
    .join('')
}
```

- [ ] **步骤 4：更新统一 API 导出**

在 `frontend/src/lib/api/index.ts` 的 `api` 对象中增加：

```typescript
getDigitalHumanSession: impl.getDigitalHumanSession,
```

并在类型导出列表增加：

```typescript
DigitalHumanSession,
```

- [ ] **步骤 5：让现有调用方临时传入空时间并运行检查**

在 `frontend/src/app/(shell)/video/page.tsx` 的现有调用中，把 `onEvent` 前增加 `null`：

```typescript
const fullText = await api.chatWithDigitalHuman(
  memory.id,
  content,
  history,
  null,
  evt => {
    // 保留现有 token 拼接逻辑
  },
)
```

运行目录：`frontend/`

```powershell
npx tsc --noEmit
npm run lint
```

预期：TypeScript 和 lint 全部通过；不得出现 `api_key` 或 `api_secret` 类型引用。任务 8 再把 `null` 替换为真实播放器时间。

- [ ] **步骤 6：提交任务 5**

本任务可在任务 7 和任务 8 完成后一起提交，避免中间提交留下 TypeScript 编译失败。如果单独提交，先用临时调用参数 `null` 保持编译通过，提交信息为：

```powershell
git add frontend/src/lib/api/types.ts frontend/src/lib/api/real.ts frontend/src/lib/api/index.ts 'frontend/src/app/(shell)/video/page.tsx'
git commit -m "重构：数字人前端改用安全会话契约"
```

---

### 任务 6：用 TDD 实现可测试的讯飞播报驱动

**文件：**

- 创建：`frontend/src/components/digital-human/xfyun-avatar-driver.ts`
- 创建：`frontend/src/components/digital-human/xfyun-avatar-driver.test.ts`

**接口：**

- 输入：SDK `AvatarPlatform` 实例。
- 产出：`XfyunAvatarDriver` 和 `XfyunDigitalHumanHandle`。
- 后续任务依赖：任务 7 的 React 组件只通过该驱动操作 SDK。

- [ ] **步骤 1：先写驱动行为测试**

创建 `xfyun-avatar-driver.test.ts`：

```typescript
import { describe, expect, it, vi } from 'vitest'
import {
  XfyunAvatarDriver,
  type AvatarPlatform,
} from './xfyun-avatar-driver'

function createPlatform() {
  const player = {
    muted: true,
    defaultMuted: true,
    resume: vi.fn(async () => undefined),
  }
  const interrupt = vi.fn(async () => undefined)
  const writeText = vi.fn(async () => 'request-1')
  const platform: AvatarPlatform = {
    player,
    interrupt,
    writeText,
    stop: vi.fn(),
    destroy: vi.fn(),
    createPlayer: vi.fn(() => player),
  }
  return { platform, player, interrupt, writeText }
}

describe('XfyunAvatarDriver', () => {
  it('连接后先打断旧播报再驱动完整回答', async () => {
    const { platform, interrupt, writeText } = createPlatform()
    const driver = new XfyunAvatarDriver(platform)
    driver.markConnected(true)

    await driver.speak('  变量用于保存数据  ')

    expect(interrupt).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledWith(
      '变量用于保存数据',
      expect.objectContaining({
        nlp: false,
        avatar_dispatch: expect.objectContaining({ interactive_mode: 1 }),
      }),
    )
    expect(interrupt.mock.invocationCallOrder[0]).toBeLessThan(
      writeText.mock.invocationCallOrder[0],
    )
  })

  it('未连接时拒绝播报但空文本直接忽略', async () => {
    const { platform } = createPlatform()
    const driver = new XfyunAvatarDriver(platform)
    await driver.speak('   ')
    await expect(driver.speak('回答')).rejects.toThrow('DH_NOT_READY')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('用户解除静音时恢复播放器', async () => {
    const { platform, player } = createPlatform()
    const driver = new XfyunAvatarDriver(platform)
    await driver.setMuted(false)
    expect(player.muted).toBe(false)
    expect(player.resume).toHaveBeenCalledOnce()
  })

  it('销毁时停止并释放平台', () => {
    const { platform } = createPlatform()
    const driver = new XfyunAvatarDriver(platform)
    driver.dispose()
    expect(platform.stop).toHaveBeenCalledOnce()
    expect(platform.destroy).toHaveBeenCalledOnce()
  })
})
```

- [ ] **步骤 2：运行测试，确认模块不存在**

运行目录：`frontend/`

```powershell
npx vitest run src/components/digital-human/xfyun-avatar-driver.test.ts
```

预期：因驱动模块不存在而失败。

- [ ] **步骤 3：实现驱动和第三方平台最小类型**

创建 `xfyun-avatar-driver.ts`：

```typescript
export interface AvatarPlayer {
  muted: boolean
  defaultMuted: boolean
  resume: () => Promise<void>
}

export interface AvatarPlatform {
  player?: AvatarPlayer
  interrupt: () => Promise<void>
  writeText: (text: string, extend: Record<string, unknown>) => Promise<string>
  createPlayer: () => AvatarPlayer
  stop: () => void
  destroy: () => void
}

export interface XfyunDigitalHumanHandle {
  speak(text: string): Promise<void>
  interrupt(): Promise<void>
  setMuted(muted: boolean): Promise<void>
  isReady(): boolean
}

export class XfyunAvatarDriver implements XfyunDigitalHumanHandle {
  private connected = false

  constructor(private readonly platform: AvatarPlatform) {}

  markConnected(connected: boolean) {
    this.connected = connected
  }

  isReady() {
    return this.connected
  }

  async speak(text: string) {
    const content = text.trim()
    if (!content) return
    if (!this.connected) throw new Error('DH_NOT_READY')
    await this.platform.interrupt()
    await this.platform.writeText(content, {
      nlp: false,
      avatar_dispatch: {
        interactive_mode: 1,
        content_analysis: 1,
      },
      air: {
        air: 1,
        add_nonsemantic: 1,
      },
    })
  }

  async interrupt() {
    if (!this.connected) return
    await this.platform.interrupt()
  }

  async setMuted(muted: boolean) {
    const player = this.platform.player || this.platform.createPlayer()
    player.defaultMuted = muted
    player.muted = muted
    if (!muted) await player.resume()
  }

  dispose() {
    this.connected = false
    this.platform.stop()
    this.platform.destroy()
  }
}
```

- [ ] **步骤 4：运行驱动测试**

```powershell
npx vitest run src/components/digital-human/xfyun-avatar-driver.test.ts
```

预期：4 个测试全部通过。

- [ ] **步骤 5：提交任务 6**

```powershell
git add frontend/src/components/digital-human/xfyun-avatar-driver.ts frontend/src/components/digital-human/xfyun-avatar-driver.test.ts
git commit -m "功能：封装讯飞数字人播报驱动"
```

---

### 任务 7：让数字人组件使用安全会话并暴露播报句柄

**文件：**

- 修改：`frontend/src/components/digital-human/XfyunDigitalHumanLive.tsx`
- 修改：`frontend/src/components/digital-human/xfyun-avatar-driver.ts`

**接口：**

- 消费：任务 5 的 `getDigitalHumanSession()` 和任务 6 的驱动。
- 产出：可通过 React ref 使用的 `XfyunDigitalHumanHandle`。
- 后续任务依赖：任务 8 调用 `speak()` 和 `interrupt()`。

- [ ] **步骤 1：扩展本地 SDK 类型，移除原始密钥字段**

组件内的 SDK 平台类型改为：

```typescript
type AvatarSdkPlatform = AvatarPlatform & {
  on: (event: string, handler: AvatarSdkEventHandler) => AvatarSdkPlatform
  setApiInfo: (apiInfo: {
    appId: string
    signedUrl: string
    sceneId?: string
    sceneVersion?: string
  }) => AvatarSdkPlatform
  setGlobalParams: (config: Record<string, unknown>) => AvatarSdkPlatform
  start: (props?: { wrapper?: HTMLDivElement }) => Promise<void>
}
```

代码中不再出现 `apiKey` 和 `apiSecret` 属性。

- [ ] **步骤 2：把组件改为 forwardRef**

增加导入：

```typescript
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  XfyunAvatarDriver,
  type XfyunDigitalHumanHandle,
} from './xfyun-avatar-driver'
```

组件声明改为：

```typescript
const XfyunDigitalHumanLive = forwardRef<
  XfyunDigitalHumanHandle,
  XfyunDigitalHumanLiveProps
>(function XfyunDigitalHumanLive({ className = '' }, ref) {
```

并在文件末尾：

```typescript
export default XfyunDigitalHumanLive
```

- [ ] **步骤 3：通过 ref 委托驱动能力**

```typescript
const driverRef = useRef<XfyunAvatarDriver | null>(null)

useImperativeHandle(ref, () => ({
  speak: async text => driverRef.current?.speak(text),
  interrupt: async () => driverRef.current?.interrupt(),
  setMuted: async muted => driverRef.current?.setMuted(muted),
  isReady: () => driverRef.current?.isReady() ?? false,
}), [])
```

- [ ] **步骤 4：初始化时先取配置，再取短期会话**

```typescript
const config = await api.getDigitalHumanConfig()
if (!config.enabled || !config.configured) {
  setState('missing_config')
  setMessage('请先在后端 .env 中配置讯飞数字人参数')
  return
}
const session = await api.getDigitalHumanSession()
```

创建平台后：

```typescript
const driver = new XfyunAvatarDriver(platform)
driverRef.current = driver
await driver.setMuted(true)

platform
  .setApiInfo({
    appId: session.app_id,
    signedUrl: session.signed_url,
    sceneId: session.scene_id || undefined,
    sceneVersion: session.scene_version || undefined,
  })
  .setGlobalParams(buildGlobalParams(config))
```

`connected` 和 `disconnected` 事件分别调用：

```typescript
driver.markConnected(true)
driver.markConnected(false)
```

- [ ] **步骤 5：实现有限重连**

使用常量：

```typescript
const RECONNECT_DELAYS_MS = [1000, 2000, 4000] as const
```

断开后销毁旧驱动，每次重试都重新调用 `getDigitalHumanSession()`；使用同一个 `alive` 标志和单个 timeout ref，防止路由离开后继续连接。三次失败后进入 `error`，文字聊天区域不隐藏。

- [ ] **步骤 6：增加声音授权按钮**

ready 且 muted 时显示按钮：

```tsx
<button
  type="button"
  onClick={async () => {
    await driverRef.current?.setMuted(false)
    setMuted(false)
  }}
  className="absolute bottom-3 right-3 z-20 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-blue shadow"
>
  开启声音
</button>
```

浏览器拒绝恢复播放时保留按钮，并显示“请再次点击开启声音”。

- [ ] **步骤 7：清理时只通过驱动释放资源**

```typescript
driverRef.current?.dispose()
driverRef.current = null
```

删除原组件重复的 `stop()`、`destroy()` 调用，防止双重销毁。

- [ ] **步骤 8：运行驱动测试、TypeScript 和 lint**

```powershell
npx vitest run src/components/digital-human/xfyun-avatar-driver.test.ts
npx tsc --noEmit
npm run lint
```

预期：驱动测试通过；若只剩视频页旧问答签名错误，继续任务 8 后再做最终提交。

- [ ] **步骤 9：提交任务 7**

```powershell
git add frontend/src/components/digital-human/XfyunDigitalHumanLive.tsx frontend/src/components/digital-human/xfyun-avatar-driver.ts
git commit -m "功能：数字人组件使用安全会话和声音授权"
```

---

### 任务 8：把视频时间和完整回答接入数字人播报

**文件：**

- 修改：`frontend/src/app/(shell)/video/page.tsx:232-605`

**接口：**

- 消费：任务 5 的新问答签名和任务 7 的 `XfyunDigitalHumanHandle`。
- 产出：用户提问时暂停视频、发送毫秒时间、完整回答只播报一次。

- [ ] **步骤 1：增加类型导入和两个 ref**

```typescript
import type { XfyunDigitalHumanHandle } from '@/components/digital-human/xfyun-avatar-driver'
```

在 `VideoPage` 内增加：

```typescript
const videoRef = useRef<HTMLVideoElement>(null)
const digitalHumanRef = useRef<XfyunDigitalHumanHandle>(null)
const [speechError, setSpeechError] = useState('')
```

- [ ] **步骤 2：把 ref 绑定到两个视频渲染分支和数字人组件**

两个 `<video>` 都增加：

```tsx
ref={videoRef}
```

数字人组件改为：

```tsx
<XfyunDigitalHumanLive ref={digitalHumanRef} className="relative z-0" />
```

- [ ] **步骤 3：发送前固定播放位置并暂停视频**

在 `handleSend` 开头、更新消息状态之前加入：

```typescript
const currentTimeMs = videoRef.current
  ? Math.max(0, Math.round(videoRef.current.currentTime * 1000))
  : null
if (videoRef.current && !videoRef.current.paused) {
  videoRef.current.pause()
}
await digitalHumanRef.current?.interrupt().catch(() => undefined)
setSpeechError('')
```

- [ ] **步骤 4：调用新问答签名**

```typescript
const fullText = await api.chatWithDigitalHuman(
  memory.id,
  content,
  history,
  currentTimeMs,
  evt => {
    if (evt.type !== 'token' && evt.type !== 'text') return
    const chunk = String(evt.payload.text || evt.payload.content || '')
    if (!chunk) return
    streamed += chunk
    setMessages(current => {
      const next = [...current]
      const last = next[next.length - 1]
      if (last?.role === 'assistant') {
        next[next.length - 1] = { ...last, content: last.content + chunk }
      }
      return next
    })
  },
)
```

- [ ] **步骤 5：完整回答只播报一次**

在最终 `answer` 确定并更新文字后调用：

```typescript
try {
  await digitalHumanRef.current?.speak(answer)
} catch {
  setSpeechError('回答已生成，数字人播报暂不可用')
}
```

不得在 token 回调中调用 `speak()`。

- [ ] **步骤 6：增加非阻塞播报错误提示**

在聊天消息区底部增加：

```tsx
{speechError && (
  <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
    {speechError}
  </div>
)}
```

- [ ] **步骤 7：运行前端单元检查**

```powershell
npx vitest run src/components/digital-human/xfyun-avatar-driver.test.ts
npx tsc --noEmit
npm run lint
```

预期：全部通过。

- [ ] **步骤 8：提交任务 8**

```powershell
git add 'frontend/src/app/(shell)/video/page.tsx' frontend/src/lib/api/types.ts frontend/src/lib/api/real.ts frontend/src/lib/api/index.ts
git commit -m "功能：视频问答驱动讯飞数字人完整播报"
```

---

### 任务 9：增加页面端到端测试和配置文档

**文件：**

- 创建：`frontend/test/digital-human-xfyun.spec.ts`
- 修改：`docs/讯飞数字人接入配置.md`

**接口：**

- 消费：任务 2、4、7、8 的完整前后端契约。
- 产出：无真实讯飞凭据也能运行的 Playwright 回归测试和安全配置说明。

- [ ] **步骤 1：创建可被动态 import 的假讯飞 SDK**

在 Playwright 测试中拦截 `/mock-avatar-sdk.js` 并返回：

```typescript
const mockSdk = `
export const SDKEvents = {
  connected: 'connected',
  disconnected: 'disconnected',
  error: 'error'
}
export default class MockAvatarPlatform {
  constructor() {
    this.handlers = {}
    this.player = {
      muted: true,
      defaultMuted: true,
      resume: async () => undefined
    }
  }
  on(event, handler) { this.handlers[event] = handler; return this }
  setApiInfo(info) { window.__xfyunApiInfo = info; return this }
  setGlobalParams(params) { window.__xfyunGlobalParams = params; return this }
  createPlayer() { return this.player }
  async start() { this.handlers.connected?.() }
  async interrupt() { window.__xfyunInterrupts = (window.__xfyunInterrupts || 0) + 1 }
  async writeText(text) {
    window.__xfyunSpeeches = [...(window.__xfyunSpeeches || []), text]
    return 'request-1'
  }
  stop() {}
  destroy() {}
}
`
```

- [ ] **步骤 2：写完整页面测试**

创建 `frontend/test/digital-human-xfyun.spec.ts`，测试中拦截：

```typescript
import { expect, test } from '@playwright/test'

test('回答携带视频时间并只交给讯飞播报一次', async ({ page }) => {
  let chatBody: Record<string, unknown> | null = null

  await page.route('**/api/video/resources', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: [{
        id: 'video-1',
        title: '变量课程',
        url: '/mock.mp4',
        has_mp4: true,
        duration: 60,
      }],
    }),
  }))
  await page.route('**/api/num-person/memory/load', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        memory_id: 'mem-video-1',
        video_title: '变量课程',
        segment_count: 1,
        greeting: '可以开始提问',
      },
    }),
  }))
  await page.route('**/api/num-person/digital-human/config', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        enabled: true,
        configured: true,
        provider: 'xfyun',
        sdk_url: '/mock-avatar-sdk.js',
        avatar_id: 'avatar-1',
        scene_id: '',
        scene_version: '',
        stage: {
          width: 720,
          height: 405,
          scale: 1.15,
          move_h: 0,
          move_v: -95,
          mask_region: { top: 0, right: 0, bottom: 0, left: 0 },
          transparent: true,
        },
        tts: { vcn: 'test-voice', speed: 50, pitch: 50, volume: 100 },
        stream: { protocol: 'webrtc', alpha: 1 },
      },
    }),
  }))
  await page.route('**/api/num-person/digital-human/session', route => route.fulfill({
    contentType: 'application/json',
    headers: { 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      success: true,
      data: {
        app_id: 'app-id',
        signed_url: 'wss://avatar.example.com/v1/interact?signed=1',
        expires_at: 1787198400,
        scene_id: '',
        scene_version: '',
      },
    }),
  }))
  await page.route('**/mock-avatar-sdk.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: mockSdk,
  }))
  await page.route('**/mock.mp4', route => route.fulfill({
    status: 206,
    contentType: 'video/mp4',
    body: Buffer.from([]),
  }))
  await page.route('**/api/num-person/chat', async route => {
    chatBody = route.request().postDataJSON()
    await route.fulfill({
      contentType: 'text/event-stream; charset=utf-8',
      body: [
        'data: {"type":"token","payload":{"text":"变量用于"}}\n\n',
        'data: {"type":"token","payload":{"text":"保存数据"}}\n\n',
        'data: {"type":"done","payload":{"text":"变量用于保存数据","total_tokens":2}}\n\n',
      ].join(''),
    })
  })

  await page.goto('/video')
  const video = page.locator('video').first()
  await expect(video).toBeVisible()
  await video.evaluate(element => {
    Object.defineProperty(element, 'currentTime', { value: 12.5, configurable: true })
  })

  const input = page.getByPlaceholder('请输入你的问题...')
  await input.fill('这里是什么意思')
  await page.getByRole('button', { name: '发送问题' }).click()

  await expect(page.getByText('变量用于保存数据')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__xfyunSpeeches)).toEqual([
    '变量用于保存数据',
  ])
  expect(chatBody?.current_time_ms).toBe(12_500)
  const apiInfo = await page.evaluate(() => window.__xfyunApiInfo)
  expect(apiInfo).toMatchObject({
    appId: 'app-id',
    signedUrl: 'wss://avatar.example.com/v1/interact?signed=1',
  })
  expect(apiInfo).not.toHaveProperty('apiSecret')
})
```

在文件顶部补充 TypeScript 全局声明，使测试编译通过：

```typescript
declare global {
  interface Window {
    __xfyunApiInfo?: Record<string, unknown>
    __xfyunGlobalParams?: Record<string, unknown>
    __xfyunInterrupts?: number
    __xfyunSpeeches?: string[]
  }
}
```

- [ ] **步骤 3：运行 Playwright 测试**

运行目录：`frontend/`

```powershell
npx playwright test test/digital-human-xfyun.spec.ts --project=desktop-chromium
```

预期：通过；断言只播报一次、请求包含 `12500` 毫秒、SDK API 信息没有 `apiSecret`。

- [ ] **步骤 4：更新讯飞接入配置文档**

在 `docs/讯飞数字人接入配置.md` 明确：

- `.env` 只由 FastAPI 读取；
- 原密钥已经暴露，必须轮换；
- 前端只访问 config 和 session 接口；
- `XF_DH_SERVER_URL` 必须来自与本地 SDK 相同产品的控制台或示例；
- 配置接口不得返回 APIKey/APISecret；
- `scale=1.15` 是初始标定值；
- 启动后先点击“开启声音”，再进行播报冒烟。

- [ ] **步骤 5：提交任务 9**

```powershell
git add frontend/test/digital-human-xfyun.spec.ts docs/讯飞数字人接入配置.md
git commit -m "测试：覆盖讯飞数字人安全播报闭环"
```

---

### 任务 10：全量验证、安全扫描和发布检查

**文件：**

- 检查：本计划涉及的全部文件
- 不新增业务代码，只有验证发现真实缺陷时才回到对应任务修复

**接口：**

- 消费：任务 1 至任务 9 的全部产物。
- 产出：可发布的验证证据和无敏感信息的最终工作区。

- [ ] **步骤 1：运行后端定向测试**

运行目录：`backend/`

```powershell
python -m pytest tests/test_xfyun_digital_human_auth.py tests/test_num_person.py -q
```

预期：全部通过。

- [ ] **步骤 2：运行后端相关回归测试**

```powershell
python -m pytest tests/test_api.py -q
```

预期：全部通过；若测试依赖外部模型，应使用项目已有 monkeypatch，不接受真实付费调用作为自动测试前提。

- [ ] **步骤 3：运行前端单元测试、lint 和构建**

运行目录：`frontend/`

```powershell
npx vitest run src/components/digital-human/xfyun-avatar-driver.test.ts
npm run lint
npm run build
```

预期：全部通过。

- [ ] **步骤 4：运行数字人 Playwright 测试**

```powershell
npx playwright test test/digital-human-xfyun.spec.ts --project=desktop-chromium
```

预期：通过。

- [ ] **步骤 5：扫描前端密钥泄露和旧接口字段**

运行目录：项目根目录。

```powershell
rg -n "api_secret|apiSecret|XF_DH_API_SECRET|XF_DH_API_KEY" frontend/src frontend/test
```

预期：不命中业务代码；测试中仅允许出现“字段不存在”的断言字符串，不允许出现真实值。

检查后端配置响应：

```powershell
rg -n '"api_key"|"api_secret"|"server_url"' backend/app/routes/num_person.py
```

预期：数字人配置响应中不命中这些字段。

- [ ] **步骤 6：确认没有误改无关文件**

```powershell
git status --short
git diff --check
git diff --stat
```

预期：没有空白错误；差异只包含本计划列出的文件和用户原有的未提交工作。

- [ ] **步骤 7：使用新凭据做真实讯飞冒烟**

人工操作顺序：

1. 在讯飞控制台轮换附件中暴露的凭据；
2. 把新凭据写入本地或测试环境 `.env`，不提交；
3. 确认 `XF_DH_SERVER_URL` 与 SDK 产品一致；
4. 启动 FastAPI 和 Next.js；
5. 打开视频页，点击“开启声音”；
6. 在视频 20 至 30 秒位置提问“这里是什么意思”；
7. 确认回答引用当前位置、文字只出现一次、语音只播报一次；
8. 播报中再次提问，确认旧播报被打断；
9. 检查浏览器 Network，确认没有原始 APISecret；
10. 离开视频页，确认声音和网络连接停止。

- [ ] **步骤 8：提交最终验证修订**

仅当验证产生了修订时执行：

```powershell
git add backend/app backend/tests frontend/src frontend/test docs/讯飞数字人接入配置.md
git commit -m "修复：完善讯飞数字人发布验收"
```

不得把 `.env`、浏览器 trace 中的签名 URL 或真实凭据加入提交。

---

## 实施完成后的发布门禁

- [ ] 附件中暴露的旧讯飞凭据已经失效。
- [ ] config API 响应中没有 `api_key`、`api_secret`、`server_url`。
- [ ] session API 使用当前登录用户并返回 `Cache-Control: no-store`。
- [ ] `done.text` 与页面最终回答一致。
- [ ] 同一回答只调用一次 `writeText()`。
- [ ] 当前播放位置以毫秒发送并命中正确 timeline 片段。
- [ ] 新问题能够打断旧播报。
- [ ] 数字人失败时文字聊天仍可用。
- [ ] 后端 pytest、前端 Vitest、lint、build、Playwright 全部通过。
- [ ] 真实 Chrome 和 Edge 冒烟通过。
