# Technical Design Document

## Overview

学习伙伴 Agent 功能的技术设计，基于现有 SparkLearn 架构（FastAPI + SQLite + Next.js App Router）进行扩展。本设计遵循项目现有的代码模式：后端使用 APIRouter + raw SQLite + Pydantic 校验，前端使用 App Router + fetchJson 封装 + Tailwind CSS。

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ AgentPet     │  │ AgentChat    │  │ AgentHistory          │  │
│  │ (形象+等级)  │  │ (对话+任务)  │  │ (历史记录)            │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘  │
│         │                  │                      │              │
│         └──────────────────┼──────────────────────┘              │
│                            │ fetchJson / polling                  │
└────────────────────────────┼─────────────────────────────────────┘
                             │ REST API
┌────────────────────────────┼─────────────────────────────────────┐
│                        Backend (FastAPI)                          │
│  ┌─────────────────────────┴─────────────────────────────────┐   │
│  │              routes/agent.py (APIRouter /api/agent)        │   │
│  └─────────────────────────┬─────────────────────────────────┘   │
│                             │                                     │
│  ┌──────────────────┐  ┌───┴──────────────┐  ┌───────────────┐  │
│  │ services/        │  │ services/         │  │ services/     │  │
│  │ agent_pet.py     │  │ browser_agent.py  │  │ growth.py     │  │
│  │ (认养/状态管理)  │  │ (浏览器任务执行)  │  │ (成长系统)    │  │
│  └────────┬─────────┘  └────────┬──────────┘  └──────┬────────┘  │
│           │                      │                    │           │
│  ┌────────┴──────────────────────┴────────────────────┴────────┐ │
│  │                    SQLite (db.py)                            │ │
│  │  agent_pets | agent_tasks | agent_messages                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                             │                                     │
│  ┌──────────────────────────┴──────────────────────────────────┐ │
│  │              External Services                               │ │
│  │  browser-use (Playwright) | LLM (Spark/OpenAI-compatible)   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### Component Design

#### Backend Components

**1. routes/agent.py** — API 路由层
- 前缀: `/api/agent`
- 职责: 请求校验、路由分发、响应封装
- 依赖: `services/agent_pet.py`, `services/browser_agent.py`, `services/growth.py`

**2. services/agent_pet.py** — Agent Pet 服务
- 职责: 认养创建、状态查询、Persona 管理、收藏入库
- 依赖: `db.py`, `config.py`

**3. services/browser_agent.py** — 浏览器 Agent 服务
- 职责: 任务创建与执行、白名单校验、搜索/摘要/对比
- 依赖: `browser-use` 库, LLM adapter, `whitelist.json` 配置
- 异步执行: 使用 `asyncio.create_task()` 后台运行

**4. services/growth.py** — 成长系统服务
- 职责: 经验值计算、等级判定、能力解锁校验
- 依赖: `db.py`

#### Frontend Components

**5. app/(shell)/agent/page.tsx** — Agent 主页面
- 职责: 页面布局，组合 AgentPet + AgentChat + AgentHistory
- 路由: `/agent`

**6. components/agent/AgentPet.tsx** — 伙伴形象组件
- 职责: 展示 Avatar、等级、经验条、状态动画
- Props: `pet: AgentPetData`

**7. components/agent/AgentChat.tsx** — 对话交互组件
- 职责: 消息列表、输入框、任务状态轮询、结果展示
- State: messages[], currentTask, isPolling

**8. components/agent/AgentHistory.tsx** — 历史记录组件
- 职责: 任务列表、分页、详情展开
- Props: `tasks: AgentTaskData[]`

**9. components/agent/AdoptionFlow.tsx** — 认养引导组件
- 职责: 形象选择、起名、性格选择的引导流程
- State: step, selectedAvatar, name, persona

## Database Schema

### agent_pets 表

```sql
CREATE TABLE IF NOT EXISTS agent_pets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '小助手',
    avatar TEXT NOT NULL DEFAULT 'fox',
    personality TEXT NOT NULL DEFAULT 'encouraging',
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id)
);
```

字段说明:
- `id`: UUID 主键
- `user_id`: 关联用户，UNIQUE 约束确保每人只有一只
- `avatar`: 枚举值 `fox` | `owl` | `robot`
- `personality`: 枚举值 `concise` | `verbose` | `encouraging`
- `level`: 1-5
- `xp`: 累计经验值

### agent_tasks 表

```sql
CREATE TABLE IF NOT EXISTS agent_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    pet_id TEXT NOT NULL,
    task_type TEXT NOT NULL,
    input_text TEXT NOT NULL,
    result_json TEXT,
    error_message TEXT,
    feedback TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_user
ON agent_tasks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_status
ON agent_tasks(user_id, status);
```

字段说明:
- `task_type`: `search` | `summarize` | `compare` | `recommend`
- `status`: `pending` | `running` | `completed` | `failed`
- `result_json`: JSON 字符串，结构由 task_type 决定
- `feedback`: `useful` | `not_useful` | null

### agent_messages 表

```sql
CREATE TABLE IF NOT EXISTS agent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_task
ON agent_messages(task_id, created_at ASC);
```

字段说明:
- `sender`: `user` | `agent`
- `content`: 最大 5000 字符

### agent_task_steps 表（浏览器操作步骤记录）

```sql
CREATE TABLE IF NOT EXISTS agent_task_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_task_steps
ON agent_task_steps(task_id, step_index ASC);
```

字段说明:
- `action`: `navigate` | `input` | `click` | `extract` | `scroll` | `wait`
- `description`: 人类可读的步骤描述，如"正在打开 google.com"、"输入搜索关键词"
- 前端轮询任务状态时一并返回最新步骤，展示 Agent 的实时操作过程

## API Design

### Pet Management

#### POST /api/agent/pet — 认养 Agent Pet

Request:
```json
{
    "name": "小狐",
    "avatar": "fox",
    "personality": "encouraging"
}
```

Response:
```json
{
    "success": true,
    "data": {
        "id": "uuid-xxx",
        "name": "小狐",
        "avatar": "fox",
        "personality": "encouraging",
        "level": 1,
        "xp": 0,
        "created_at": "2026-05-14T10:00:00Z"
    }
}
```

Validation:
- `name`: 1-10 字符，正则 `^[\u4e00-\u9fa5a-zA-Z0-9]{1,10}$`
- `avatar`: 必须为 `fox` | `owl` | `robot`
- `personality`: 必须为 `concise` | `verbose` | `encouraging`
- 用户已有 pet 时返回 409

#### GET /api/agent/pet — 获取当前 Pet 信息

Response:
```json
{
    "success": true,
    "data": {
        "id": "uuid-xxx",
        "name": "小狐",
        "avatar": "fox",
        "personality": "encouraging",
        "level": 3,
        "xp": 350,
        "next_level_xp": 600,
        "unlocked_abilities": ["search", "summarize", "compare"],
        "created_at": "2026-05-14T10:00:00Z"
    }
}
```

如果用户尚未认养，返回 `data: null`。

#### PATCH /api/agent/pet — 更新 Pet 设置

Request:
```json
{
    "personality": "concise"
}
```

Response: 同 GET 返回完整 pet 对象。

### Task Management

#### POST /api/agent/task — 创建任务

Request:
```json
{
    "task_type": "search",
    "input_text": "帮我找 Python 装饰器的入门教程"
}
```

Response:
```json
{
    "success": true,
    "data": {
        "task_id": "uuid-yyy",
        "task_type": "search",
        "status": "pending",
        "created_at": "2026-05-14T10:01:00Z"
    }
}
```

Validation:
- `input_text`: 1-200 字符
- `task_type`: 必须为 `search` | `summarize` | `compare` | `recommend`
- 能力等级校验: 如果 pet level 不足，返回 403 + 提示信息
- 并发限制: 如果有 running 状态任务，返回 429

#### GET /api/agent/task/{task_id} — 查询任务状态

Response (completed):
```json
{
    "success": true,
    "data": {
        "task_id": "uuid-yyy",
        "task_type": "search",
        "status": "completed",
        "result": {
            "items": [
                {
                    "title": "Python装饰器入门",
                    "summary": "本文介绍了装饰器的基本概念...",
                    "url": "https://docs.python.org/...",
                    "source": "Python官方文档"
                }
            ]
        },
        "created_at": "2026-05-14T10:01:00Z",
        "updated_at": "2026-05-14T10:01:15Z"
    }
}
```

Response (failed):
```json
{
    "success": true,
    "data": {
        "task_id": "uuid-yyy",
        "task_type": "search",
        "status": "failed",
        "error_message": "搜索超时，请稍后重试",
        "created_at": "...",
        "updated_at": "..."
    }
}
```

#### GET /api/agent/tasks — 获取历史任务列表

Query params: `page=1&page_size=20&archived=false`

Response:
```json
{
    "success": true,
    "data": {
        "items": [...],
        "total": 45,
        "page": 1,
        "page_size": 20
    }
}
```

#### POST /api/agent/task/{task_id}/feedback — 提交反馈

Request:
```json
{
    "feedback": "useful"
}
```

### Bookmark (收藏入库)

#### POST /api/agent/bookmark — 收藏搜索结果

Request:
```json
{
    "task_id": "uuid-yyy",
    "item_index": 0,
    "title": "Python装饰器入门",
    "url": "https://docs.python.org/...",
    "summary": "本文介绍了装饰器的基本概念..."
}
```

Response:
```json
{
    "success": true,
    "data": {
        "resource_id": "res-xxx",
        "title": "Python装饰器入门",
        "tags": ["Python", "装饰器", "入门"]
    }
}
```

### Daily Recommendation

#### GET /api/agent/recommendations — 获取每日推荐

Response:
```json
{
    "success": true,
    "data": {
        "date": "2026-05-14",
        "items": [
            {
                "title": "Python 闭包与装饰器深入理解",
                "summary": "从闭包原理出发，逐步理解装饰器...",
                "url": "https://...",
                "source": "Real Python"
            }
        ],
        "cached": false
    }
}
```

## Key Technical Decisions

### 1. LLM 选择策略

browser-use 需要较强的 LLM 驱动浏览器决策。设计为可配置，默认使用 DeepSeek V3：

```python
# config.py 新增配置
agent_llm_provider: str = "spark"          # spark | openai_compatible（用于结果整理/Persona回复）
agent_llm_model: str = "lite"              # Spark Lite，成本低
agent_browser_llm_provider: str = "openai_compatible"  # 用于浏览器操作
agent_browser_llm_model: str = "deepseek-chat"         # DeepSeek V3
agent_browser_llm_base_url: str = "https://api.deepseek.com"
agent_browser_llm_api_key: str = ""                    # .env 中配置
```

- **浏览器操作**: 使用 DeepSeek V3（deepseek-chat），兼容 OpenAI API 格式，推理能力足够驱动 browser-use，成本约 ¥1/1M input tokens
- **结果整理/Persona 回复**: 使用现有 Spark Lite，成本低且够用
- DeepSeek V3 支持 function calling，browser-use 的 langchain-openai 适配器可直接对接
- 备选方案：如果 DeepSeek API 不稳定，可切换到 gpt-4o-mini 或星火 Pro

### 2. 异步任务执行模式

选择 **异步 + 轮询** 模式（方案 B）：

```
用户提交任务 → 立即返回 task_id (pending)
                → 后台 asyncio.create_task() 执行
                → 前端每 3s GET /task/{id} 轮询
                → 完成后返回结果
```

理由：
- 浏览器操作耗时 10-30s，不适合同步等待
- 轮询实现简单，不需要 WebSocket 基础设施
- 前端可以展示"忙碌"动画，用户体验可接受
- 超时 30s（搜索）/ 60s（摘要）自动 fail

### 3. browser-use 浏览器自动化（核心演示亮点）

使用 browser-use + DeepSeek V3 实现真实的浏览器操控。Agent 会真正打开浏览器、输入搜索词、点击链接、提取内容——这个过程本身就是产品的核心演示效果。

```python
# services/browser_agent.py
from browser_use import Agent, Browser, BrowserConfig
from langchain_openai import ChatOpenAI

class BrowserAgentService:
    def __init__(self):
        self.browser_config = BrowserConfig(
            headless=True,
            disable_security=False,
        )
        self.whitelist = WhitelistManager()
    
    def _get_llm(self):
        """获取 DeepSeek V3 作为 browser-use 的决策 LLM"""
        return ChatOpenAI(
            model=settings.agent_browser_llm_model,  # deepseek-chat
            base_url=settings.agent_browser_llm_base_url,  # https://api.deepseek.com
            api_key=settings.agent_browser_llm_api_key,
        )

    async def execute_search(self, query: str, pet: AgentPet, on_step=None) -> dict:
        """执行搜索任务 - 真实浏览器操控"""
        browser = Browser(config=self.browser_config)
        agent = Agent(
            task=f"请在搜索引擎中搜索"{query}"，浏览前5条结果，提取每条的标题、摘要和URL，以JSON格式返回。",
            llm=self._get_llm(),
            browser=browser,
            on_step_start=on_step,  # 回调：报告每一步操作
        )
        try:
            result = await asyncio.wait_for(agent.run(), timeout=30)
            return self._parse_search_result(result)
        finally:
            await browser.close()

    async def execute_summarize(self, url: str, pet: AgentPet, on_step=None) -> dict:
        """执行摘要任务 - 真实访问URL并提取内容"""
        browser = Browser(config=self.browser_config)
        agent = Agent(
            task=f"请访问 {url}，阅读页面主要内容，生成结构化摘要（主题、3-7个关键要点、结论），以JSON格式返回。",
            llm=self._get_llm(),
            browser=browser,
            on_step_start=on_step,
        )
        try:
            result = await asyncio.wait_for(agent.run(), timeout=60)
            return self._parse_summary_result(result)
        finally:
            await browser.close()

    async def execute_compare(self, query: str, pet: AgentPet, on_step=None) -> dict:
        """执行对比搜索 - 访问多个页面对比内容"""
        browser = Browser(config=self.browser_config)
        agent = Agent(
            task=f"请搜索"{query}"，找到3个不同来源的解释，对比它们的异同，以JSON格式返回每个来源的标题、URL、核心观点和对比总结。",
            llm=self._get_llm(),
            browser=browser,
            on_step_start=on_step,
        )
        try:
            result = await asyncio.wait_for(agent.run(), timeout=45)
            return self._parse_compare_result(result)
        finally:
            await browser.close()
```

**操作步骤实时反馈：**

browser-use 执行过程中会产生步骤事件（打开页面、输入文字、点击元素等），通过 `on_step` 回调记录到 agent_task_steps 表，前端轮询时可以展示：

```
🔍 正在打开搜索引擎...
⌨️ 输入搜索关键词"Python 装饰器"...
🖱️ 点击第1条搜索结果...
📖 正在阅读页面内容...
🖱️ 返回搜索结果，点击第2条...
✅ 搜索完成，找到3条相关资源
```

这些步骤信息存储在数据库中，前端轮询时一并返回，让用户看到 Agent 真的在"工作"。

**配置：**
```python
# config.py
agent_browser_llm_provider: str = "openai_compatible"
agent_browser_llm_model: str = "deepseek-chat"         # DeepSeek V3
agent_browser_llm_base_url: str = "https://api.deepseek.com"
agent_browser_llm_api_key: str = ""
agent_browser_headless: bool = True   # 演示时可设为 False 看到浏览器窗口
```

### 4. 白名单管理

```json
// backend/config/whitelist.json
{
    "domains": [
        "docs.python.org",
        "*.runoob.com",
        "realpython.com",
        "developer.mozilla.org",
        "*.csdn.net",
        "www.zhihu.com",
        "stackoverflow.com",
        "github.com",
        "www.google.com",
        "www.bing.com"
    ],
    "updated_at": "2026-05-14T00:00:00Z"
}
```

- 文件监听: 使用 `watchdog` 或启动时加载 + 30s 缓存刷新
- 域名匹配: 支持精确匹配和 `*.domain.com` 通配符
- 重定向拦截: browser-use 的 page navigation hook 中校验

### 5. 成长系统实现

```python
# services/growth.py
LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000]
XP_REWARDS = {
    "search": 10,
    "summarize": 20,
    "compare": 25,
    "recommend": 15,
}
LEVEL_ABILITIES = {
    1: ["search"],
    2: ["search", "summarize"],
    3: ["search", "summarize", "compare"],
    4: ["search", "summarize", "compare", "recommend"],
    5: ["search", "summarize", "compare", "recommend", "plan"],
}

def award_xp(pet_id: str, task_type: str) -> tuple[int, int | None]:
    """返回 (new_xp, new_level_or_None)"""
    ...
```

### 6. Persona 对 LLM 的影响

通过 system prompt 前缀控制回复风格：

```python
PERSONA_PROMPTS = {
    "concise": "你是一个简洁高效的学习助手。回复控制在80字以内，直接给出关键信息，不做多余解释。",
    "verbose": "你是一个详细耐心的学习助手。回复150-300字，包含解释和示例，帮助用户深入理解。",
    "encouraging": "你是一个温暖鼓励的学习助手。回复100-200字，每次回复包含一句正向激励，让用户感到被支持。",
}
```

### 7. 收藏入库与 Resource Library 打通

复用现有 `resources` 模块的存储模式，在 `knowledge_files` 表中新增一条记录：

```python
async def bookmark_to_library(user_id: str, title: str, url: str, summary: str, tags: list[str]):
    """将 Agent 搜索结果保存为知识库资源"""
    execute("""
        INSERT INTO knowledge_files (
            user_id, filename, stored_path, mime_type, size_bytes,
            status, tags, summary, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id, title, url, "text/html", 0,
        "indexed", json.dumps(tags, ensure_ascii=False), summary,
        now_iso(), now_iso()
    ))
```

## File Structure (New Files)

```
backend/app/
├── routes/agent.py              ← 新增: Agent API 路由
├── services/
│   ├── agent_pet.py             ← 新增: Pet CRUD + 状态管理
│   ├── browser_agent.py         ← 新增: browser-use 任务执行
│   └── growth.py                ← 新增: 成长系统逻辑
└── config/
    └── whitelist.json           ← 新增: 白名单配置

frontend/src/
├── app/(shell)/agent/
│   └── page.tsx                 ← 新增: Agent 主页面
├── components/agent/
│   ├── AgentPet.tsx             ← 新增: 伙伴形象组件
│   ├── AgentChat.tsx            ← 新增: 对话交互组件
│   ├── AgentHistory.tsx         ← 新增: 历史记录组件
│   └── AdoptionFlow.tsx         ← 新增: 认养引导流程
└── lib/api/
    └── real.ts                  ← 修改: 新增 agent 相关 API 函数
```

## Dependencies (New)

### Backend
- `browser-use` — 浏览器自动化 Agent 框架
- `playwright` — browser-use 底层浏览器驱动
- `langchain-openai` (可选) — 如果使用 OpenAI-compatible LLM 驱动 browser-use

### Frontend
- 无新增依赖，使用现有 Tailwind + React 组件模式

## Error Handling

| 场景 | HTTP Status | Error Message |
|------|-------------|---------------|
| 用户已有 Pet | 409 | "您已拥有学习伙伴" |
| 名称校验失败 | 422 | "名称需为1-10个中英文字符或数字" |
| 能力未解锁 | 403 | "当前等级不足，需要 Lv.{n} 解锁此能力" |
| 任务并发限制 | 429 | "当前有任务正在执行，请等待完成" |
| 任务超时 | 200 (status=failed) | "搜索超时，请稍后重试" |
| 白名单拦截 | 200 (status=failed) | "该网站不在允许访问范围内" |
| 任务不存在 | 404 | "任务不存在或无权访问" |
| 重复收藏 | 409 | "该资源已收藏" |

## Performance Considerations

- **任务超时**: 搜索 30s，摘要 60s，超时自动标记 failed
- **轮询频率**: 前端 3s 间隔，避免过度请求
- **白名单缓存**: 内存缓存 + 30s TTL，避免每次读文件
- **历史分页**: 活跃列表 100 条 + 归档，避免单次查询过大
- **浏览器实例**: 复用 Browser 实例，避免每次任务都启动新浏览器（启动耗时 2-5s）

## Security Considerations

- 白名单严格限制可访问域名，防止 Agent 访问不当内容
- 重定向拦截：browser-use navigation hook 中二次校验
- 输入长度限制：搜索 200 字符，防止 prompt injection
- 用户隔离：所有查询带 user_id 条件
- 审计日志：被拒绝的访问请求记录到日志文件，保留 90 天
