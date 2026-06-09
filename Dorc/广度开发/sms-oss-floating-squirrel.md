# SparkLearn 五大功能实现方案

## Context

SparkLearn 是一个个性化学习多智能体平台，当前处于单用户模式，无真实认证系统，文件存储在本地磁盘，外部 API 调用分散且缺乏统一管理。

---

## 一、外接接口实现（统一 API 抽象层）

### 目标
将分散的外部 API 调用（讯飞星火、Coze、讯飞TTS、讯飞知问PPT、OpenAI兼容API）统一封装，提供一致的错误处理、重试、日志和配置管理。

### 当前问题
- 各路由直接调用 `spark_lite.stream_chat_events()`、`coze_adapter.stream_resource_text()` 等，无统一抽象
- 错误处理不一致：有的用 try/except fallback，有的直接抛异常
- 无请求日志、无重试机制、无超时统一配置

### 实现方案

#### 1.1 创建统一 API 客户端基类
**新建文件：** `backend/app/api_client.py`

```python
class BaseAPIClient:
    """外部 API 客户端基类"""
    base_url: str
    timeout: int
    max_retries: int

    async def _request_with_retry(self, method, url, **kwargs) -> Response
    async def _handle_error(self, error, context) -> None
    def _log_request(self, method, url, duration, status) -> None
```

#### 1.2 封装各服务客户端
**修改文件：**
- `backend/app/llm.py` — SparkLiteAdapter 继承 BaseAPIClient，统一 WebSocket 连接管理和错误处理
- `backend/app/coze.py` — CozeAdapter 继承 BaseAPIClient，统一 HTTP 请求和 SSE 解析
- **新建** `backend/app/clients/tts_client.py` — 封装讯飞 TTS WebSocket 调用
- **新建** `backend/app/clients/ppt_client.py` — 封装讯飞知问 PPT API 调用
- **新建** `backend/app/clients/video_ai_client.py` — 封装 OpenAI 兼容 API 调用

#### 1.3 统一错误处理和日志
**新建文件：** `backend/app/api_errors.py`
- 定义 `APITimeoutError`、`APIAuthError`、`APIRateLimitError`、`APIResponseError` 等异常类
- 统一日志格式：`[服务名] [请求方法] [耗时] [状态码]`

#### 1.4 配置整合
**修改文件：** `backend/app/config.py`
- 将各服务的 timeout、max_retries 配置集中管理
- 添加 `api_log_level` 配置项

### 需要修改的关键文件
| 文件 | 操作 |
|------|------|
| `backend/app/api_client.py` | 新建 — 基类 |
| `backend/app/api_errors.py` | 新建 — 异常定义 |
| `backend/app/clients/__init__.py` | 新建 — 客户端包 |
| `backend/app/clients/tts_client.py` | 新建 — TTS 客户端 |
| `backend/app/clients/ppt_client.py` | 新建 — PPT 客户端 |
| `backend/app/clients/video_ai_client.py` | 新建 — 视频AI客户端 |
| `backend/app/llm.py` | 修改 — 继承基类 |
| `backend/app/coze.py` | 修改 — 继承基类 |
| `backend/app/config.py` | 修改 — 添加统一配置 |
| `backend/app/main.py` | 修改 — 注册日志中间件 |

---

## 二、SMS 登录（阿里云号码认证服务）

### 目标
实现手机号 + 短信验证码登录/注册，支持多用户，建立完整的 JWT 认证体系。

### 当前问题
- 登录页面是纯前端模拟（setTimeout + router.push）
- 后端无认证中间件，所有路由用 `settings.single_user_id` 硬编码
- `students` 表无密码/手机号字段
- 前端 `fetchJson` 不携带 Authorization header

### 实现方案

#### 2.1 数据库改造
**修改文件：** `backend/app/db_sqlite.py`、`backend/app/db_postgresql.py`

`students` 表新增字段：
```sql
phone VARCHAR(20) UNIQUE        -- 手机号
password_hash VARCHAR(128)      -- 密码哈希（可选，SMS登录可不设密码）
avatar VARCHAR(500)             -- 头像URL
last_login_at TIMESTAMP         -- 最后登录时间
```

新建 `sms_codes` 表：
```sql
CREATE TABLE sms_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    purpose VARCHAR(20) NOT NULL,    -- 'login' / 'register'
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL
);
```

#### 2.2 阿里云短信服务集成
**新建文件：** `backend/app/sms.py`

```python
class AliyunSMSClient:
    """阿里云短信验证码服务"""
    async def send_code(self, phone: str, code: str, purpose: str) -> bool
    def _generate_code(self) -> str  # 6位随机数字
    def _build_sign_request(self, phone, code) -> dict  # 构建签名请求
```

**依赖：** `pip install alibabacloud-dysmsapi20170525`

**配置新增（config.py）：**
```python
aliyun_sms_access_key_id: str = ""
aliyun_sms_access_key_secret: str = ""
aliyun_sms_sign_name: str = "SparkLearn"
aliyun_sms_template_code_login: str = ""   # SMS_XXXXX
aliyun_sms_template_code_register: str = ""
sms_code_expire_minutes: int = 5
sms_rate_limit_seconds: int = 60
```

#### 2.3 JWT 认证模块
**新建文件：** `backend/app/auth.py`

```python
# JWT 工具
def create_access_token(user_id: str, expires_delta: timedelta) -> str
def decode_access_token(token: str) -> dict

# FastAPI 依赖注入
async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict
async def get_optional_user(token: str = Depends(oauth2_scheme_optional)) -> dict | None

# 路由
router = APIRouter(prefix="/api/auth")
POST /api/auth/sms/send      # 发送验证码
POST /api/auth/sms/login      # SMS验证码登录
POST /api/auth/sms/register   # SMS验证码注册
POST /api/auth/logout         # 登出
GET  /api/auth/me             # 获取当前用户信息
```

**依赖：** `pip install python-jose[cryptography]`（JWT）、`pip install passlib[bcrypt]`（密码哈希，可选）

#### 2.4 认证中间件
**修改文件：** `backend/app/main.py`

```python
# 添加认证中间件
from .auth import get_current_user

# 白名单路由（不需要认证）
AUTH_WHITELIST = ["/health", "/api/auth/", "/docs", "/openapi.json"]

@app.middleware("http")
async def auth_middleware(request, call_next):
    if not any(request.url.path.startswith(p) for p in AUTH_WHITELIST):
        # 验证 JWT token
        ...
```

#### 2.5 改造所有路由的用户获取方式
**影响范围：** 所有 15 个路由模块

将所有 `settings.single_user_id` 替换为从请求中获取真实用户 ID：

```python
# 之前
user_id = settings.single_user_id

# 之后
from ..auth import get_current_user
async def some_endpoint(current_user = Depends(get_current_user)):
    user_id = current_user["user_id"]
```

**兼容模式：** 在 `config.py` 中保留 `single_user_id` 配置，当值不为空时跳过认证（用于本地开发），为空时启用真实认证。

#### 2.6 前端改造
**修改文件：**

1. `frontend/src/app/auth/page.tsx` — 改造为真实登录页面
   - 输入手机号 → 发送验证码 → 输入验证码 → 登录/注册
   - 登录成功后存储 JWT token 到 localStorage
   - 移除 setTimeout 模拟逻辑

2. `frontend/src/lib/api/real.ts` — fetchJson 注入 Authorization header
   ```typescript
   const token = localStorage.getItem('sparklearn_token');
   headers: { 'Authorization': `Bearer ${token}`, ...headers }
   ```

3. `frontend/src/app/(shell)/layout.tsx` — 添加路由守卫
   - 检查 token 存在性和有效性
   - 无 token 时重定向到 `/auth`

4. **新建** `frontend/src/lib/auth.ts` — 前端认证工具
   - `getToken()`、`setToken()`、`removeToken()`、`isAuthenticated()`

### 需要修改的关键文件
| 文件 | 操作 |
|------|------|
| `backend/app/sms.py` | 新建 — 阿里云短信客户端 |
| `backend/app/auth.py` | 新建 — JWT + 路由 + 依赖注入 |
| `backend/app/db_sqlite.py` | 修改 — students 表加字段 + sms_codes 表 |
| `backend/app/db_postgresql.py` | 修改 — 同上 |
| `backend/app/config.py` | 修改 — 阿里云 SMS 配置 |
| `backend/app/main.py` | 修改 — 认证中间件 |
| `backend/app/routes/*.py` (15个) | 修改 — user_id 获取方式 |
| `backend/requirements.txt` | 修改 — 添加依赖 |
| `frontend/src/app/auth/page.tsx` | 修改 — 真实登录UI |
| `frontend/src/app/auth/auth.css` | 修改 — 样式适配 |
| `frontend/src/lib/api/real.ts` | 修改 — 注入 token |
| `frontend/src/lib/auth.ts` | 新建 — 前端认证工具 |
| `frontend/src/app/(shell)/layout.tsx` | 修改 — 路由守卫 |

---

## 三、OSS 存储（阿里云对象存储）

### 目标
将本地文件存储迁移到阿里云 OSS，实现文件的云端存储和 CDN 加速访问。

### 当前问题
- 文件存在本地 `data/` 目录，服务器重启可能丢失
- 无 CDN 加速，大文件下载慢
- 存储容量受磁盘限制

### 实现方案

#### 3.1 阿里云 OSS 客户端
**新建文件：** `backend/app/oss.py`

```python
class AliyunOSSClient:
    """阿里云 OSS 存储客户端"""
    def __init__(self):
        self.bucket = oss2.Bucket(auth, endpoint, bucket_name)

    async def upload_file(self, key: str, data: bytes) -> str
        # 返回文件访问 URL

    async def upload_fileobj(self, key: str, fileobj) -> str

    async def delete_file(self, key: str) -> bool

    async def get_signed_url(self, key: str, expires: int = 3600) -> str
        # 生成临时访问 URL（用于私有文件）

    async def get_file_url(self, key: str) -> str
        # 返回公开访问 URL

    def _build_key(self, user_id: str, category: str, filename: str) -> str
        # 生成 OSS 对象键: users/{user_id}/{category}/{timestamp}_{filename}
```

**依赖：** `pip install oss2`

**配置新增（config.py）：**
```python
aliyun_oss_access_key_id: str = ""
aliyun_oss_access_key_secret: str = ""
aliyun_oss_bucket_name: str = "sparklearn"
aliyun_oss_endpoint: str = "oss-cn-hangzhou.aliyuncs.com"
aliyun_oss_cdn_domain: str = ""  # CDN 域名（可选）
```

#### 3.2 存储抽象层
**修改文件：** `backend/app/storage.py`

```python
class StorageBackend:
    """存储后端抽象"""
    async def save(self, user_id, category, filename, data) -> str  # 返回路径/URL
    async def load(self, path) -> bytes
    async def delete(self, path) -> bool
    async def get_url(self, path) -> str  # 获取访问 URL

class LocalStorage(StorageBackend): ...  # 现有逻辑
class OSSStorage(StorageBackend): ...    # OSS 实现

def get_storage() -> StorageBackend:
    if settings.aliyun_oss_bucket_name:
        return OSSStorage()
    return LocalStorage()
```

#### 3.3 改造文件上传/下载路由
**影响范围：** 所有涉及文件的路由

| 路由模块 | 当前逻辑 | 改造后 |
|----------|----------|--------|
| `routes/forum.py` 附件上传 | 保存到 `data/users/{id}/forum/` | 调用 `storage.save()` |
| `routes/forum.py` 附件下载 | `FileResponse(path)` | 重定向到 OSS URL 或流式代理 |
| `routes/teacher.py` 材料上传 | 保存到 `data/users/{id}/teacher/` | 调用 `storage.save()` |
| `routes/teacher.py` 材料下载 | `FileResponse(path)` | 重定向到 OSS URL |
| `routes/knowledge.py` 文件上传 | 保存到 `data/users/{id}/knowledge/` | 调用 `storage.save()` |
| `routes/tutor_eval.py` 文件上传 | 保存到 `data/users/{id}/uploads/` | 调用 `storage.save()` |
| `routes/resources.py` PDF生成 | 保存到本地 | 上传到 OSS |
| `routes/video.py` 视频生成 | 保存到 `data/artifacts/video/` | 上传到 OSS |

#### 3.4 数据库字段改造
文件存储路径字段从本地路径改为 OSS key/URL：
- `forum_attachments.stored_path`
- `teacher_material_files.stored_path`
- `knowledge_files.stored_path`
- `tutor_files.stored_path`

**兼容策略：** 已有本地文件暂不迁移，新文件走 OSS。通过 `get_url()` 方法统一处理：如果是本地路径返回本地下载 URL，如果是 OSS key 返回 OSS URL。

### 需要修改的关键文件
| 文件 | 操作 |
|------|------|
| `backend/app/oss.py` | 新建 — OSS 客户端 |
| `backend/app/storage.py` | 修改 — 添加存储抽象层 |
| `backend/app/config.py` | 修改 — OSS 配置 |
| `backend/app/routes/forum.py` | 修改 — 文件上传/下载改用 storage |
| `backend/app/routes/teacher.py` | 修改 — 同上 |
| `backend/app/routes/knowledge.py` | 修改 — 同上 |
| `backend/app/routes/tutor_eval.py` | 修改 — 同上 |
| `backend/app/routes/resources.py` | 修改 — 同上 |
| `backend/app/routes/video.py` | 修改 — 同上 |
| `backend/requirements.txt` | 修改 — 添加 oss2 |

---

## 四、资料分发

### 目标
完善学习资料的分享和分发机制，支持教师分发给学生、学生间分享、生成分享链接等。

### 当前状态
- 教师端已有 `teacher_broadcasts` 表和广播功能（`POST /api/teacher/broadcasts`）
- 论坛已有附件上传/下载功能
- 缺少：分享链接生成、权限控制、资料推送通知、分发记录

### 实现方案

#### 4.1 资料分享链接系统
**新建文件：** `backend/app/routes/sharing.py`

```python
router = APIRouter(prefix="/api/sharing")

POST /api/sharing/links          # 创建分享链接
GET  /api/sharing/links          # 我的分享列表
DELETE /api/sharing/links/{id}   # 取消分享
GET  /api/sharing/{share_code}   # 通过分享码访问资料
```

**新建数据库表：** `share_links`
```sql
CREATE TABLE share_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_code VARCHAR(16) UNIQUE NOT NULL,  -- 短码，如 "aB3xK9"
    creator_id VARCHAR(50) NOT NULL,
    resource_type VARCHAR(20) NOT NULL,      -- 'resource' / 'attachment' / 'material'
    resource_id VARCHAR(100) NOT NULL,       -- 关联的资源ID
    title VARCHAR(200),
    access_type VARCHAR(20) DEFAULT 'public', -- 'public' / 'password' / 'specific'
    password VARCHAR(64),                     -- 访问密码（可选）
    allowed_user_ids TEXT,                    -- JSON数组，指定可访问用户（可选）
    max_views INTEGER,                        -- 最大查看次数（可选）
    view_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,                     -- 过期时间（可选）
    created_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active'       -- 'active' / 'expired' / 'revoked'
);
```

#### 4.2 增强教师分发功能
**修改文件：** `backend/app/routes/teacher.py`

新增端点：
```python
POST /api/teacher/broadcasts/{id}/resend     # 重发广播
GET  /api/teacher/broadcasts/{id}/stats      # 查看分发统计（谁看了/下载了）
POST /api/teacher/broadcasts/{id}/materials/share  # 为材料生成分享链接
```

**新建数据库表：** `broadcast_deliveries`
```sql
CREATE TABLE broadcast_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broadcast_id INTEGER NOT NULL,
    student_id VARCHAR(50) NOT NULL,
    delivered_at TIMESTAMP NOT NULL,
    read_at TIMESTAMP,
    downloaded_at TIMESTAMP,
    UNIQUE(broadcast_id, student_id)
);
```

#### 4.3 资料推荐与一键分发
**修改文件：** `backend/app/routes/resources.py`

```python
POST /api/resources/{id}/share       # 为生成的资源创建分享
POST /api/resources/{id}/distribute  # 分发给指定学生/全班
GET  /api/resources/shared           # 别人分享给我的资源
```

#### 4.4 前端分发 UI
**新建/修改文件：**
- `frontend/src/components/ui/ShareDialog.tsx` — 分享弹窗组件（生成链接、设置权限、复制链接）
- `frontend/src/app/(shell)/resources/shared/page.tsx` — 收到的分享资源页面
- `frontend/src/app/(teacher)/teacher/broadcast/page.tsx` — 增强广播页面（分发统计）
- `frontend/src/lib/api/real.ts` — 添加分享相关 API 调用
- `frontend/src/lib/api/types.ts` — 添加分享相关类型定义

### 需要修改的关键文件
| 文件 | 操作 |
|------|------|
| `backend/app/routes/sharing.py` | 新建 — 分享链接路由 |
| `backend/app/db_sqlite.py` | 修改 — 新建 share_links、broadcast_deliveries 表 |
| `backend/app/db_postgresql.py` | 修改 — 同上 |
| `backend/app/routes/teacher.py` | 修改 — 增强分发功能 |
| `backend/app/routes/resources.py` | 修改 — 添加分享/分发端点 |
| `frontend/src/components/ui/ShareDialog.tsx` | 新建 — 分享弹窗 |
| `frontend/src/app/(shell)/resources/shared/page.tsx` | 新建 — 收到的分享 |
| `frontend/src/app/(teacher)/teacher/broadcast/page.tsx` | 修改 — 分发统计 |
| `frontend/src/lib/api/real.ts` | 修改 — 添加分享API |
| `frontend/src/lib/api/types.ts` | 修改 — 添加类型 |

---

## 五、对接外部信息流

### 目标
接入外部数据源，为学习者提供实时、丰富的学习资讯和参考内容。

### 实现方案

#### 5.1 信息流聚合服务
**新建文件：** `backend/app/info_stream.py`

```python
class InfoStreamAggregator:
    """外部信息流聚合器"""

    async def fetch_from_source(self, source: str, keyword: str, page: int) -> list

    # 数据源适配器
    async def search_bilibili(self, keyword: str) -> list      # B站视频
    async def search_zhihu(self, keyword: str) -> list          # 知乎问答
    async def search_github(self, keyword: str) -> list         # GitHub 仓库
    async def search_papers(self, keyword: str) -> list         # 学术论文（arXiv/Semantic Scholar）
    async def search_news(self, keyword: str) -> list           # 技术资讯（36kr/掘金等）
```

#### 5.2 外部信息流路由
**新建文件：** `backend/app/routes/info_stream.py`

```python
router = APIRouter(prefix="/api/info-stream")

GET /api/info-stream/search           # 综合搜索外部信息流
GET /api/info-stream/sources          # 获取可用数据源列表
GET /api/info-stream/recommendations  # 基于学习画像的智能推荐
GET /api/info-stream/{source}/{id}    # 获取某条信息详情
POST /api/info-stream/bookmark        # 收藏外部资源
GET /api/info-stream/bookmarks        # 我的收藏
```

#### 5.3 各数据源对接方案

| 数据源 | API | 认证方式 | 说明 |
|--------|-----|----------|------|
| **B站** | `api.bilibili.com/x/web-interface/search/type` | Cookie/无需 | 搜索视频、获取视频信息 |
| **GitHub** | `api.github.com/search/repositories` | Token（可选） | 搜索开源仓库、获取 README |
| **知乎** | 无官方API，可用 web 爬虫或第三方 | — | 搜索问答、获取摘要 |
| **arXiv** | `export.arxiv.org/api/query` | 无需 | 学术论文搜索 |
| **Semantic Scholar** | `api.semanticscholar.org/graph/v1` | API Key（可选） | 论文搜索、引用关系 |
| **掘金** | Web API | 无需 | 技术文章搜索 |

#### 5.4 信息流缓存与去重
**新建文件：** `backend/app/info_cache.py`

- 使用 SQLite 缓存外部搜索结果（TTL: 1小时）
- 基于 URL 去重
- 记录用户点击行为用于推荐优化

**新建数据库表：** `info_stream_cache`
```sql
CREATE TABLE info_stream_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source VARCHAR(20) NOT NULL,
    external_id VARCHAR(200),
    title VARCHAR(500),
    summary TEXT,
    url VARCHAR(1000),
    thumbnail VARCHAR(1000),
    author VARCHAR(200),
    tags TEXT,           -- JSON array
    extra_data TEXT,     -- JSON，存储各源特有数据
    cached_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    click_count INTEGER DEFAULT 0
);

CREATE TABLE info_stream_bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(50) NOT NULL,
    cache_id INTEGER REFERENCES info_stream_cache(id),
    created_at TIMESTAMP NOT NULL
);
```

#### 5.5 前端信息流页面
**新建文件：**
- `frontend/src/app/(shell)/info-stream/page.tsx` — 信息流主页面
  - 搜索栏 + 数据源 Tab 切换（全部/B站/GitHub/论文/资讯）
  - 卡片式展示：标题、摘要、来源标签、缩略图
  - 点击跳转到外部链接
  - 收藏按钮
- `frontend/src/app/(shell)/info-stream/bookmarks/page.tsx` — 收藏列表
- `frontend/src/components/ui/InfoCard.tsx` — 信息流卡片组件

**修改文件：**
- `frontend/src/components/layout/navigation.tsx` — 添加"信息流"导航项
- `frontend/src/components/layout/Sidebar.tsx` — 添加侧边栏入口
- `frontend/src/lib/api/real.ts` — 添加信息流 API
- `frontend/src/lib/api/types.ts` — 添加信息流类型

#### 5.6 与学习画像联动
**修改文件：** `backend/app/routes/info_stream.py`

```python
GET /api/info-stream/recommendations
# 基于当前用户的 profile（weak_points, current_stage, learning_preference）
# 自动生成搜索关键词，从各数据源拉取相关推荐内容
```

### 需要修改的关键文件
| 文件 | 操作 |
|------|------|
| `backend/app/info_stream.py` | 新建 — 信息流聚合服务 |
| `backend/app/info_cache.py` | 新建 — 缓存层 |
| `backend/app/routes/info_stream.py` | 新建 — 路由 |
| `backend/app/db_sqlite.py` | 修改 — 新建缓存表 |
| `backend/app/db_postgresql.py` | 修改 — 同上 |
| `backend/app/config.py` | 修改 — 数据源 API Key 配置 |
| `backend/app/main.py` | 修改 — 注册路由 |
| `backend/requirements.txt` | 修改 — 添加 httpx 依赖（已有） |
| `frontend/src/app/(shell)/info-stream/page.tsx` | 新建 — 信息流页面 |
| `frontend/src/app/(shell)/info-stream/bookmarks/page.tsx` | 新建 — 收藏页 |
| `frontend/src/components/ui/InfoCard.tsx` | 新建 — 卡片组件 |
| `frontend/src/components/layout/navigation.tsx` | 修改 — 导航 |
| `frontend/src/components/layout/Sidebar.tsx` | 修改 — 侧边栏 |
| `frontend/src/lib/api/real.ts` | 修改 — API 调用 |
| `frontend/src/lib/api/types.ts` | 修改 — 类型定义 |

---

## 实施顺序建议

```
阶段一（基础）：外接接口实现 → SMS登录
    先统一 API 抽象层，再在此基础上实现认证系统

阶段二（核心）：OSS存储 → 资料分发
    OSS 存储是资料分发的基础设施

阶段三（增强）：对接外部信息流
    独立模块，可并行开发
```

## 验证方案

### 1. 外接接口实现
- 模拟 API 超时，验证重试机制
- 模拟 API 错误，验证统一错误处理
- 检查日志输出格式是否统一

### 2. SMS 登录
- 发送验证码 → 验证阿里云短信收到
- 验证码登录 → 获取 JWT → 访问受保护 API
- 过期验证码 → 返回错误
- 前端路由守卫 → 未登录重定向到 /auth
- 兼容模式 → `single_user_id` 不为空时跳过认证

### 3. OSS 存储
- 上传文件 → 验证文件出现在 OSS 控制台
- 下载文件 → 验证通过 URL 可访问
- 删除文件 → 验证从 OSS 移除
- 本地文件兼容 → 已有文件仍可正常下载

### 4. 资料分发
- 教师创建广播 → 学生收到通知
- 生成分享链接 → 他人可通过链接访问
- 设置密码保护 → 输入密码后才能访问
- 分发统计 → 查看谁已读/已下载

### 5. 对接外部信息流
- 搜索 "Python装饰器" → 返回 B站视频、GitHub 仓库、知乎回答
- 切换数据源 Tab → 只显示该源结果
- 点击收藏 → 收藏列表中出现
- 智能推荐 → 基于学习画像返回相关推荐

---
---

# 实现总结

> 以下为五大功能的实际实现记录，包含新建/修改的文件清单和关键实现细节。

---

## 一、外接接口实现 — 已完成

### 新建文件

| 文件路径 | 说明 |
|----------|------|
| `backend/app/api_errors.py` | 统一异常类：APITimeoutError、APIAuthError、APIRateLimitError、APIResponseError、APIConnectionError |
| `backend/app/api_client.py` | BaseAPIClient 基类，提供 `_request_with_retry()`、`_log_request()`、`_handle_error()` 方法 |
| `backend/app/clients/__init__.py` | 客户端包入口，导出 tts_client、ppt_client、video_ai_client |
| `backend/app/clients/tts_client.py` | 讯飞 TTS 客户端封装，统一日志和错误处理 |
| `backend/app/clients/ppt_client.py` | 讯飞智文 PPT 客户端，继承 BaseAPIClient，带重试机制 |
| `backend/app/clients/video_ai_client.py` | OpenAI 兼容 API 客户端，继承 BaseAPIClient |

### 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `backend/app/config.py` | 新增 `api_default_timeout`、`api_max_retries` 配置项 |
| `backend/app/main.py` | 添加统一日志配置（logging.basicConfig）和请求日志中间件 |
| `backend/app/routes/voice_admin.py` | TTS 调用改为使用 `tts_client`，移除内联的 `_synthesize()`、`_build_auth_url()` 等函数 |

### 关键实现细节

- `BaseAPIClient._request_with_retry()` 支持自动重试（默认2次），统一处理超时、连接错误、HTTP 4xx/5xx
- 日志格式统一为 `[服务名] [请求方法] [URL] -> [状态码] ([耗时])`
- TTS 客户端保留同步接口（WebSocket 需要实时返回音频），但日志和错误处理已统一
- PPT 客户端和 Video AI 客户端完全基于 BaseAPIClient，享受重试和日志能力

---

## 二、SMS 登录 — 已完成

### 新建文件

| 文件路径 | 说明 |
|----------|------|
| `backend/app/sms.py` | 阿里云短信验证码客户端，支持开发模式（未配置时直接返回成功） |
| `backend/app/auth.py` | JWT 认证模块，包含 `create_access_token()`、`get_current_user()` 依赖注入、认证路由 |
| `frontend/src/lib/auth.ts` | 前端认证工具：`getToken()`、`setToken()`、`removeToken()`、`isAuthenticated()` |

### 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `backend/app/db_sqlite.py` | 新增 `sms_codes`、`share_links`、`broadcast_deliveries`、`info_stream_cache`、`info_stream_bookmarks` 表；`students` 表新增 phone、avatar、last_login_at 字段 |
| `backend/app/db_postgresql.py` | 同上（PostgreSQL 版本） |
| `backend/app/config.py` | 新增阿里云 SMS 配置（access_key_id/secret、sign_name、template_code、expire_minutes、rate_limit_seconds） |
| `backend/app/main.py` | 注册 auth_router |
| `backend/app/routes/voice_admin.py` | 导入路径更新 |
| `backend/requirements.txt` | 新增 `python-jose[cryptography]`、`passlib[bcrypt]`、`oss2`、`alibabacloud-dysmsapi20170525`、`alibabacloud-tea-openapi` |
| `frontend/src/app/auth/page.tsx` | 改造为手机号+验证码登录，调用 `sendSmsCode()`、`smsLogin()`、`smsRegister()` |
| `frontend/src/app/auth/auth.css` | 新增 `.code-field`、`.send-code-btn` 样式，`input[type="tel"]` 支持 |
| `frontend/src/lib/api/real.ts` | `fetchJson()` 和 `readSSE()` 注入 Authorization header；新增 `sendSmsCode()`、`smsLogin()`、`smsRegister()`、`getMe()` API 函数；所有文件上传函数注入 token |
| `frontend/src/app/(shell)/layout.tsx` | 添加 `useAuthGuard()` hook，未登录时重定向到 `/auth` |

### 关键实现细节

- **兼容模式**：当 `settings.single_user_id` 不为空时（默认 "single_user"），`get_current_user()` 直接返回该用户，跳过 JWT 验证。本地开发无需配置即可使用
- **自动注册**：SMS 登录时如果手机号未注册，自动创建用户和 profile
- **频率限制**：同一手机号 60 秒内只能发送一次验证码
- **开发模式**：阿里云 SMS 未配置时，`sms_client.send_code()` 直接返回 True，验证码记录到数据库（可通过日志查看）
- **前端路由守卫**：`useAuthGuard()` 在 shell layout 中检查 token 存在性，无 token 时 redirect 到 `/auth`

### 认证 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/sms/send` | 发送验证码 |
| POST | `/api/auth/sms/login` | SMS 验证码登录 |
| POST | `/api/auth/sms/register` | SMS 验证码注册 |
| GET | `/api/auth/me` | 获取当前用户信息 |
| POST | `/api/auth/logout` | 登出 |

---

## 三、OSS 存储 — 已完成

### 新建文件

| 文件路径 | 说明 |
|----------|------|
| `backend/app/oss.py` | 阿里云 OSS 客户端，支持上传、删除、签名 URL、公开 URL |

### 修改文件

| 文件路径 | 修改内容 |
|----------|------|
| `backend/app/storage.py` | 重构为存储抽象层：`StorageBackend` 基类 + `LocalStorage` + `SSStorage` 实现；保留 `read_json()`、`write_json()`、`append_jsonl()` 向后兼容 |
| `backend/app/config.py` | 新增阿里云 OSS 配置（access_key_id/secret、bucket_name、endpoint、cdn_domain） |

### 关键实现细节

- **延迟初始化**：OSS Bucket 连接在首次使用时才创建，避免启动时报错
- **兼容策略**：`get_storage()` 根据 `aliyun_oss_bucket_name` 是否为空自动选择后端。已有本地文件路径不以 `users/` 开头，`get_url()` 会直接返回原路径
- **OSS Key 格式**：`users/{user_id}/{category}/{timestamp}_{filename}`
- **CDN 支持**：配置 `aliyun_oss_cdn_domain` 后，文件 URL 使用 CDN 域名

### 存储抽象层 API

```python
class StorageBackend:
    async def save(user_id, category, filename, data) -> str   # 保存文件
    async def load(path) -> bytes                                # 加载文件
    async def delete(path) -> bool                               # 删除文件
    async def get_url(path) -> str                               # 获取访问 URL
    def get_download_url(path) -> str                            # 获取下载 URL
```

---

## 四、资料分发 — 已完成

### 新建文件

| 文件路径 | 说明 |
|----------|------|
| `backend/app/routes/sharing.py` | 分享链接 CRUD 路由，支持公开/密码/指定用户三种访问方式 |
| `frontend/src/components/ui/ShareDialog.tsx` | 分享弹窗组件，支持选择访问方式、生成链接、复制链接 |
| `frontend/src/app/share/[code]/page.tsx` | 分享访问页面，支持密码验证和资源跳转 |

### 修改文件

| 文件路径 | 修改内容 |
|----------|------|
| `backend/app/db_sqlite.py` | 新增 `share_links` 和 `broadcast_deliveries` 表 |
| `backend/app/db_postgresql.py` | 同上 |
| `backend/app/main.py` | 注册 sharing_router |

### 关键实现细节

- **分享码**：8 位随机字母数字码，创建时检查唯一性
- **三种访问方式**：`public`（直接访问）、`password`（需密码）、`specific`（指定用户 ID 列表）
- **过期机制**：支持设置 `expire_hours`，访问时检查过期状态并自动更新
- **查看次数限制**：支持 `max_views`，达到上限后拒绝访问
- **前端组件**：ShareDialog 使用项目设计规范中的 glassmorphism 风格

### 分享 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sharing/links` | 创建分享链接 |
| GET | `/api/sharing/links` | 我的分享列表 |
| DELETE | `/api/sharing/links/{id}` | 取消分享 |
| GET | `/api/sharing/{share_code}` | 获取分享信息（无需登录） |
| POST | `/api/sharing/{share_code}/access` | 验证密码并访问资源 |

---

## 五、对接外部信息流 — 已完成

### 新建文件

| 文件路径 | 说明 |
|----------|------|
| `backend/app/info_stream.py` | 多源信息流聚合服务，支持 B站/GitHub/arXiv/掘金 |
| `backend/app/routes/info_stream.py` | 信息流路由：搜索、推荐、收藏 |
| `frontend/src/app/(shell)/info-stream/page.tsx` | 信息流前端页面：搜索栏 + 数据源 Tab + 卡片展示 + 收藏 |

### 修改文件

| 文件路径 | 修改内容 |
|----------|------|
| `backend/app/db_sqlite.py` | 新增 `info_stream_cache` 和 `info_stream_bookmarks` 表 |
| `backend/app/db_postgresql.py` | 同上 |
| `backend/app/main.py` | 注册 info_stream_router |
| `frontend/src/components/layout/navigation.tsx` | 新增 `/info-stream` 页面元数据 |
| `frontend/src/components/layout/Sidebar.tsx` | 新增"信息流"导航项（Globe 图标） |

### 关键实现细节

- **并发搜索**：选择"全部"源时，使用 `asyncio.gather()` 并发搜索所有源
- **统一数据格式**：所有源的搜索结果统一为 `{source, external_id, title, summary, url, thumbnail, author, tags, extra_data}`
- **智能推荐**：`/api/info-stream/recommendations` 从用户 profile 的 weak_points 和 current_stage 提取关键词，自动搜索相关内容
- **收藏功能**：收藏时先缓存到 `info_stream_cache`，再关联到 `info_stream_bookmarks`，支持取消收藏
- **前端 UI**：遵循项目设计规范，使用 `bg-white rounded-2xl border border-gray-100` 卡片风格

### 信息流 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/info-stream/sources` | 获取可用数据源列表 |
| GET | `/api/info-stream/search?keyword=&source=&page=` | 搜索外部信息流 |
| GET | `/api/info-stream/recommendations` | 基于学习画像的智能推荐 |
| POST | `/api/info-stream/bookmark` | 收藏/取消收藏 |
| GET | `/api/info-stream/bookmarks` | 我的收藏列表 |

### 数据源接入

| 数据源 | API | 认证 | 返回内容 |
|--------|-----|------|----------|
| B站 | `api.bilibili.com/x/web-interface/search/type` | 无需 | 视频标题、封面、播放量、时长 |
| GitHub | `api.github.com/search/repositories` | 无需（可选 Token） | 仓库名、描述、Star 数、语言 |
| arXiv | `export.arxiv.org/api/query` | 无需 | 论文标题、摘要、作者 |
| 掘金 | `api.juejin.cn/search_api/v1/search` | 无需 | 文章标题、摘要、阅读量 |

---

## 新增依赖汇总

```
python-jose[cryptography]==3.3.0    # JWT 令牌
passlib[bcrypt]==1.7.4               # 密码哈希（可选）
oss2==2.18.4                         # 阿里云 OSS
alibabacloud-dysmsapi20170525==3.0.0 # 阿里云短信
alibabacloud-tea-openapi==0.3.9      # 阿里云 SDK 基础库
```

---

## 使用说明

### 1. 环境配置

在项目根目录的 `.env` 文件中配置：

```env
# 阿里云短信（SMS 登录必需）
ALIYUN_SMS_ACCESS_KEY_ID=your_key_id
ALIYUN_SMS_ACCESS_KEY_SECRET=your_key_secret
ALIYUN_SMS_SIGN_NAME=SparkLearn
ALIYUN_SMS_TEMPLATE_CODE_LOGIN=SMS_xxxxx
ALIYUN_SMS_TEMPLATE_CODE_REGISTER=SMS_xxxxx

# 阿里云 OSS（可选，不配则使用本地存储）
ALIYUN_OSS_ACCESS_KEY_ID=your_key_id
ALIYUN_OSS_ACCESS_KEY_SECRET=your_key_secret
ALIYUN_OSS_BUCKET_NAME=sparklearn
ALIYUN_OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com

# 单用户模式（本地开发保持默认，生产环境置空启用认证）
SINGLE_USER_ID=single_user
```

### 2. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 3. 启动服务

```bash
# 后端
cd backend
uvicorn app.main:app --reload

# 前端
cd frontend
npm run dev
```

### 4. 功能入口

| 功能 | 入口 |
|------|------|
| SMS 登录 | `/auth` |
| 信息流搜索 | `/info-stream`（侧边栏"信息流"） |
| 资料分享 | 任意资源页面的分享按钮 → ShareDialog |
| 分享访问 | `/share/{share_code}` |
