# SparkLearn CrewAI + 星辰Agent开发平台混合架构与数据库设计

> **文档状态**: ✅ 当前开发分支（develop-deeply-system），部分标记 🔲 为待实现
>
> **代码版本基准**: commit `502685dc`（5.29 开始材料文档的撰写）
>
> **设计原则**: 中文撰写、UTF-8 编码、"Coze"在文档叙述中替换为"星辰Agent开发平台"（代码变量名 `CozeAdapter` / `coze_*` 保留原样）

---

## 1. 混合架构概述 ✅

SparkLearn 采用 **"SparkLearn 自治多智能体 + 星辰Agent开发平台 Bot + Nanobot 本机宠物"** 三层混合架构，分别承担编排决策、资源生成执行与本机学习陪伴的职责，形成一条从学生意图到个性化学习资源的完整流水线。

### 1.1 三层 Agent 协作模型

**编排层 —— SparkLearn 自治多智能体（Python 实现，6 个 Agent 角色）**

位于 `backend/app/routes/` 下的 Agent 路由体系承担系统的核心编排职责。当前已实现 6 个 Agent 角色的核心能力（学习伙伴 Agent、辅导 Agent、资源协调 Agent、评估 Agent、搜索对比 Agent、推荐 Agent），每个 Agent 以路由的形式暴露给前端，通过 FastAPI 的 `BackgroundTasks` 异步执行。代码核心位于 `backend/app/routes/agent.py`，Agent 的属性结构以 `agent_pets` 表的 `name/avatar/personality/level/xp` 字段为身份基础，以 `agent_tasks` 表的 `task_type` (search/summarize/compare/recommend) 路由到不同的执行能力。Agent 的能力库存放在 `LEVEL_ABILITIES` 字典中，5 个等级逐级解锁新任务类型，升级经验阈值由 `LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000]` 控制。

**工具层 —— 星辰Agent开发平台 Bot（资源生成执行引擎）**

位于 `backend/app/coze.py` 的 `CozeAdapter` 类封装了与星辰Agent开发平台的 HTTP SSE 流式对接。平台内部部署了 5 个专用 Bot（document / mindmap / quiz / reading / code），每个 Bot 对应一种资源生成能力，通过 `bot_id` 路由请求。编排层 Agent 向用户收集需求（学生画像、薄弱点、学习偏好），组装成结构化 prompt（如"基于薄弱点'函数返回值'生成 12 分钟代码案例讲义"），然后通过 `CozeAdapter.stream_resource_text()` 将 prompt 以 `additional_messages` 的形式发送给星辰Agent开发平台对应的 Bot。Bot 生成的结果以 SSE 事件流返回，SparkLearn 端实时解析文本增量、提取资源链接，最后由 ReviewerAgent 复核内容质量。

**本机层 —— Nanobot 学习宠物（OpenAI-compatible API）**

Nanobot 是一个运行在本机的轻量级 AI 宠物，采用 OpenAI-compatible API 协议（`/chat/completions` 端点）。它主要用于学习陪伴场景：当学生发起对话时，Nanobot 以宠物身份提供鼓励性、趣味化的学习互动。配置通过 `video_ai_*` 系列环境变量（`video_ai_base_url`、`video_ai_chat_path`、`video_ai_api_key`、`video_ai_model`）指定连接参数，实现本机低延迟响应。

### 1.2 数据流在三层之间的传递

整体数据流如下：

```
学生操作 [前端 Next.js]
  --> FastAPI 路由接收 [编排层]
  --> Agent 读取画像/记忆 [memory_engine.py + db.py]
  --> Agent 决策任务类型 [agent.py: _execute_task]
  --> 如需生成资源: CozeAdapter 发送 prompt [工具层]
  --> 星辰Agent开发平台 Bot 返回 SSE 流式资源 [工具层]
  --> 提取链接 + 内容解析 + ReviewerAgent 复核 [编排层]
  --> 结果写入数据库/JSON 文件 [db.py + storage.py]
  --> 前端轮询获取任务状态和结果
  --> 学生端/学习效果页渲染
  --> [本机层] Nanobot 宠物实时陪伴对话
```

每一层的状态传递都是通过标准化结构进行的：编排层通过 `agent_task_steps` 表记录每个任务步骤的执行状态；工具层通过 SSE 事件流 (`event:`, `data:` 格式) 返回文本增量和元信息（链接 URL）；本机层通过标准 chat/completions 接口返回对话内容。三层之间互不耦合，编排层不关心底层 Bot 的具体实现，工具层 Bot 也不依赖编排层业务逻辑。这种设计使得任何一层可以被替换而不影响其他层，符合 Agent 系统的最佳实践。

### 1.3 架构设计考量

这种混合架构的核心思想是"自治智能体主导编排，外部平台执行生成"。SparkLearn 没有将资源生成功能完全实现在本地，而是将"文档撰写、思维导图绘制、题目出题、阅读理解题、代码案例生成"这 5 类专项生成能力外包给星辰Agent开发平台的专用 Bot，SparkLearn 自身保留对"学生画像理解、路径规划、评估分析、推荐决策"这些高层次智能的完全控制。这样做有三个好处：第一，避免 SparkLearn 自身模型承担过重的结构化生成负载；第二，星辰Agent开发平台的 Bot 可独立升级和调优，不影响主系统；第三，Bot 生成的资源以链接形式返回，SparkLearn 只需做内容提取和索引保存，无需处理大文件流。

---

## 2. CrewAI 风格的多智能体协作 ✅

SparkLearn 没有直接依赖 CrewAI 框架，而是自主实现了一套类似 CrewAI 设计理念的多 Agent 协作体系。这套体系借鉴了 CrewAI 的核心概念（Agent 角色化、Task 定义、工具注册），但在实现上遵循"轻量自主、精准控制"的原则。

### 2.1 Agent 角色定义模式

每个 Agent 在 SparkLearn 中以 `agent_pets` 表的一条记录为身份载体，核心属性结构参考 `backend/app/routes/agent.py` 中 `_pet_row_to_dict()` 函数（约第 139-156 行）的字段定义：

```
Agent 属性结构:
- id: 宠物唯一标识 (UUID)
- name: Agent 名称 (1-10 字符，中英数字)
- avatar: 外观角色 (fox/owl/robot/cat/dragon/penguin/bunny/panda)
- personality: 行为风格 (concise/verbose/encouraging)
- level: Agent 等级 (1-5)
- xp: 经验值
- next_level_xp: 下一级所需经验
- unlocked_abilities: 已解锁任务能力列表
- created_at / updated_at: 时间戳
```

Agent 角色定义的关键在于 `personality` 字段，它决定了 Agent 的行为风格。三种风格对应 `backend/app/routes/agent.py` 第 36-40 行的 `PERSONA_PROMPTS` 字典：

- **concise（简洁型）**: "Keep replies under 80 chars, direct and to the point."（回复不超过 80 字符，直截了当）
- **verbose（详细型）**: "Give 150-300 char replies with explanations and examples."（150-300 字符回复，包含解释和示例）
- **encouraging（鼓励型）**: "Give 100-200 char replies with positive encouragement."（100-200 字符回复，带有积极鼓励）

这种方式类似 CrewAI 中 Agent 的 `role` + `backstory` 组合，但 SparkLearn 将人格模板化，便于前端在认养宠物时直接选择。

系统设计中还预留了辅导角色体系。`tutor_roles` 表（`backend/app/db.py` 第 80-91 行）定义了详细的辅导角色模板，包含 `persona`（人格描述全量文本）、`background`（适用人群与场景）、`style_guide`（风格指南）、`rules`（行为规则 —— 必须做/不可做）四个字段，这是对 CrewAI Agent 的 `goal` + `backstory` + `allow_delegation` 模式的更精细映射。种子数据中默认创建了"小星同学-通用导师"角色（第 449-457 行），其 persona 是一段 200+ 字的完整导师人格描述。

### 2.2 Task 分发模式

SparkLearn 的 Task 分发采用 `task_type` 路由机制。当学生提交任务时，前端调用 `POST /api/agent/task` 接口，传入 `task_type`（search/summarize/compare/recommend）和 `input_text`。后端在 `_execute_task()` 函数（`backend/app/routes/agent.py` 第 217-258 行）中根据 `task_type` 路由到不同的执行函数：

- **task_type='search'** → `_do_search()`：通过 Playwright 浏览器代理执行真实网页搜索，最多 5 条结果，超时/失败时退回 LLM 搜索（第 261-307 行）
- **task_type='summarize'** → `_do_summarize()`：如果是 URL 则通过浏览器访问并提取内容，然后用 LLM 生成结构化摘要（topic/key_points/conclusion）（第 311-354 行）
- **task_type='compare'** → `_do_compare()`：浏览器多源对比搜索（3 个来源），再用 LLM 生成对比总结（第 357-406 行）
- **task_type='recommend'** → `_do_recommend()`：基于学习情况生成 3 条资源推荐（第 409-433 行）

每种 Task 执行过程中通过 `_add_step()` 函数（第 208-212 行）实时写入步骤日志到 `agent_task_steps` 表，前端通过 `GET /api/agent/task/{task_id}` 轮询获取进度。Task 完成后，通过 `_award_xp()` 函数为 Agent 宠物增加经验值并检查升级。

与 CrewAI 的区别在于，CrewAI 使用 `Task` 类的 `expected_output` 和 `async_execution` 来驱动多 Agent 链式协作，而 SparkLearn 采用 `BackgroundTasks` 异步执行 + 步骤日志 + 前端轮询的模式，更适合 Web API 的请求-响应模式。

### 2.3 工具注册与调用（MCP + Browse-use 体系）✅

SparkLearn 已重构的工具体系包含两大子系统：

**MCP 插件系统**：`mcp_services` 表（`backend/app/db.py` 第 315-339 行）提供标准化的外部工具注册能力。每条记录包含 `transport`（传输方式，如 stdio/sse/streamable-http）、`command`（启动命令）、`args_json`（命令行参数）、`env_json`（环境变量）、`endpoint`（HTTP 端点地址）以及三级超时配置（`startup_timeout_ms` 60000ms、`tool_timeout_ms` 30000ms、`long_task_timeout_ms` 120000ms）。工具按 `owner_id` + `source`（user/builtin）管理，有独立的状态检测（`last_status`、`last_error`、`last_tested_at`）。

**Browse-use 体系**：`backend/app/browser_agent.py` 中的 `BrowserAgentService` 类使用 Playwright 实现真实浏览器操作。通过 `sync_playwright()` 启动 Chromium 浏览器（`headless` 和 `slow_mo` 可配置 —— 参见 `backend/app/config.py` 的 `agent_browser_headless` 和 `agent_browser_slow_mo`），在 `ThreadPoolExecutor` 中同步执行以避免 Windows 事件循环冲突。支持三种操作模式：

1. **search**: 打开浏览器 → 输入搜索框 → 点击搜索 → 滚动页面 → 提取搜索结果列表
2. **summarize_url**: 访问指定 URL → 等待页面加载 → 提取正文内容
3. **compare_search**: 多源搜索对比 → 从不同网站获取信息 → LLM 对比分析

这是对 CrewAI 工具体系的自主实现 —— CrewAI 通过 `@tool` 装饰器注册工具函数，SparkLearn 则通过 MCP 标准协议 + Playwright 浏览器代理提供工具能力，两者都实现了 Agent 的"工具调用"模式，但 SparkLearn 更注重工具的标准化注册（MCP）和真实浏览器操作能力（Browse-use）。

### 2.4 与 CrewAI 框架的异同

| 维度 | CrewAI 框架 | SparkLearn 自主实现 |
|---|---|---|
| Agent 定义 | `Agent(role, goal, backstory, tools, allow_delegation)` | `agent_pets` 表 + `tutor_roles` 表 + `PERSONA_PROMPTS` 字典 |
| Task 执行 | `Task(description, expected_output, agent, async_execution)` | `task_type` 路由 + `BackgroundTasks` + `agent_task_steps` 步骤日志 |
| 工具调用 | `@tool` 装饰器 + `tools` 列表注入 | MCP 标准协议 + Playwright Browse-use |
| 多 Agent 链式 | `Crew(agents, tasks, process=Process.sequential)` | 前端驱动工作流 + 后端异步协调 |
| 框架依赖 | 依赖 crewai Python 包 | 零框架依赖，自主实现 |
| 状态管理 | 运行期内存 | SQLite 持久化 + JSON 文件 |

自主实现的优势在于：完全控制执行流程、无框架版本锁定风险、与 FastAPI + Next.js 的 Web 栈天然适配；代价是需要自行维护 Agent 间的协调逻辑和状态传递。

---

## 3. 星辰Agent开发平台集成 ✅

### 3.1 平台定位和选型理由

星辰Agent开发平台（代码中沿用 `coze` 命名前缀）在 SparkLearn 架构中承担"资源生成执行引擎"的角色。选型理由有四点：

1. **Bot 化生成能力**：星辰Agent开发平台允许为每种资源类型创建专用 Bot，每个 Bot 有独立的 prompt 模板和知识库配置，天然适合 document/mindmap/quiz/reading/code 五种资源的独立生成需求。
2. **HTTP SSE 流式协议**：平台提供标准的 Server-Sent Events 流式接口（`/v3/chat`），SparkLearn 可通过 `httpx.AsyncClient` 直接消费流式响应，无需 WebSocket 或长轮询。
3. **结果链接提取**：平台生成的结果以 URL 链接形式嵌入在 SSE 事件流中（如 HTML 文档链接、思维导图图片链接），SparkLearn 只需提取链接并存储即可，无需处理大文件传输。
4. **与 SparkLearn 架构解耦**：星辰Agent开发平台完全作为外部服务运行，Bot 的调优和升级不影响 SparkLearn 主系统，符合微服务设计原则。

### 3.2 Bot 体系：document / mindmap / quiz / reading / code ✅

五个专用 Bot 的 `bot_id` 通过环境变量配置（`backend/app/config.py` 第 33-38 行）：

```python
coze_bot_id_resource_document: str = ""  # 讲义文档 Bot
coze_bot_id_resource_mindmap: str = ""   # 思维导图 Bot
coze_bot_id_resource_quiz: str = ""      # 练习题 Bot
coze_bot_id_resource_reading: str = ""   # 阅读材料 Bot
coze_bot_id_resource_code: str = ""      # 代码案例 Bot
```

`CozeAdapter.resolve_resource_bot_id()` 方法（`backend/app/coze.py` 第 22-30 行）根据 `resource_type` 参数查找对应 Bot ID，找不到时退回默认 Bot ID。每个 Bot 的职责和能力边界如下：

- **document Bot**：生成讲义文档（HTML 格式），内容包含学习目标、知识讲解、代码示例、常见错误、检查题。典型 prompt："请基于当前薄弱点'函数返回值'生成一份 12 分钟代码案例讲义，包含生活化类比、可运行代码、常见错误和 5 道检查题"。
- **mindmap Bot**：生成思维导图（Mermaid 格式），梳理知识点间的层级关系和关联结构。典型 prompt："请基于'函数返回值'生成一份思维导图，梳理函数定义、参数传递、返回值、作用域之间的关系"。
- **quiz Bot**：生成练习题（单选/多选/填空），按知识点关联出题，附带解析。
- **reading Bot**：生成拓展阅读材料，适合课后自学和深度阅读需求。
- **code Bot**：生成代码案例（含完整可运行代码、注释、错误演示与修复指导），适合实操型学习者。

五个 Bot 均已通过真实的代码案例进行补强测试。从 `resources_index.json` 中可以看到多种资源类型的实际生成记录（PPT、blog、document、mindmap 等），生成结果以外部 URL 的形式返回（如 `ts.fyshark.com/html_files/` 前缀的 HTML 文档、`mermaid.live/view` 前缀的思维导图、`bjcdn.openstorage.cn/zhiwen/` 前缀的 PPT 文件）。

### 3.3 API 对接：HTTP SSE 流式（CozeAdapter）

星辰Agent开发平台的 API 对接完全封装在 `backend/app/coze.py` 的 `CozeAdapter` 类中，核心调用流程如下：

**请求构造** (`stream_resource_text()` 方法，第 32-120 行)：

```python
url = f"{settings.coze_base_url.rstrip('/')}{settings.coze_api_path_chat}"
# 实际 URL: https://api.coze.cn/v3/chat
req = {
    "bot_id": bot_id,
    "user_id": uid,
    "stream": True,
    "auto_save_history": True,
    "additional_messages": [{
        "role": "user",
        "type": "question",
        "content_type": "text",
        "content": prompt,
    }],
}
```

请求头包含 `Authorization: Bearer {token}` 和 `Content-Type: application/json`。

**SSE 帧解析** (`_iter_sse_frames()` 方法，第 122-140 行)：逐行读取 HTTP 响应流，按 SSE 协议解析 `event:` 和 `data:` 行。空行表示一个事件帧的结束，此时 `yield (event_name, data_text)`。

**载荷解析** (`_decode_payload()` + `_inflate()` 方法，第 142-173 行)：处理星辰Agent开发平台特有的 JSON 嵌套结构。平台返回的 SSE 数据可能包含多层 JSON 嵌套（`data` 字段内嵌 JSON 字符串），`_inflate()` 方法递归解压，将 `{"data": "{...json...}"}` 形式的信封展开，并与外围字段合并。

**文本提取** (`_extract_text()` 方法，第 181-214 行)：从解析后的载荷中提取有效文本。跳过 `role="user"` 的用户消息、`type` 为 `function_call`/`tool_response`/`tool_output` 的工具调用消息、以 `finish` 结尾的消息类型。优先从 `content.text`、`answer`、`text` 字段中提取文本。

**增量去重** (`_to_delta_text()` 方法，第 216-234 行)：星辰Agent开发平台的流式模型可能返回累积文本而非纯增量。该方法维护 `_StreamState.last_full_text` 状态，当新文本以旧文本为前缀时计算增量；当出现乱序小块时跳过。这保证了前端不会收到重复的文本块。

**链接提取** (`_extract_links()` 方法，第 236-265 行)：递归遍历载荷中的所有字典和列表，从 `file_url`/`url`/`link`/`image_url` 键提取 URL，同时用正则从纯文本中匹配 `https?://` 链接，最后去重返回。

**错误处理** (`_extract_error()` 方法，第 267-275 行)：从载荷中提取 `code`（非 0 整型）或 `error` 对象，构造统一错误格式。

流式调用使用 `httpx.AsyncClient` 的异步 HTTP 客户端（超时配置：连接 60s，读取 120s），通过 `resp.aiter_lines()` 实现低延迟的逐行流式消费。

### 3.4 结果处理：链接提取 + 内容解析 + ReviewerAgent 复核

资源生成的完整后端处理流程为：

1. **链接提取**：星辰Agent开发平台 Bot 返回的 SSE 事件中，`CozeAdapter` 通过 `_extract_links()` 提取所有资源 URL（如 HTML 文档链接、思维导图 Mermaid 链接、PPT 下载链接等）。提取到的链接通过 `yield ("meta", {"links": links, ...})` 发送给调用方。

2. **内容解析**：调用方（资源生成路由）接收文本增量和链接元信息后，将链接存储到资源索引系统。对于 document 类型的 HTML 文件，链接直接作为 `source_url` 存入 `resources_index.json`；对于 mindmap 类型的 Mermaid 图片，链接指向 `mermaid.live/view` 在线渲染地址。

3. **ReviewerAgent 复核**：资源生成结果在入库之前会经过 ReviewerAgent 的复核。ReviewerAgent 检查资源的标题、摘要是否符合学生当前学习阶段和薄弱点需求。复核通过后，资源以 `resources_index.json` 中的一条记录的形式存入，同时追加 `resource_usage.jsonl` 的事件记录（`type: "resource_generated"`）。

4. **前端展示**：前端资源列表页直接读取 `resources_index.json`，按 `created_at` 排序展示历史资源。预览通过 `source_url` 或 `cover_img_src`（PPT 封面图）实现。视频资源通过 `video_resources.json` 中的 `video_url` / `subtitle_url` / `timeline_url` 等字段提供完整的播放体验。

整个链路的每个阶段都有对应的状态记录和异常日志，确保生成失败时能够准确定位问题环节（Bot 超时、内容为空、链接失效等）。

---

## 4. 数据库设计（重点章节）

本章从 `backend/app/db.py` 的 `init_db()` 函数（第 31-390 行）提取完整的数据库 Schema 信息，逐一列出每张表的结构、字段和用途。

### 4.1 当前架构：SQLite（✅ 运行中）

SparkLearn 当前使用 SQLite 作为主数据库，数据库文件位于 `backend/data/db/sparklearn.db`。SQLite 的选择考虑：单用户模式下的零配置优势、JSON 列的直接文本存储、与 FastAPI 的 `sqlite3` 标准库无缝集成。数据库连接通过 `backend/app/db.py` 第 16-24 行的 `get_conn()` 上下文管理器管理，自动提交/关闭连接，`row_factory = sqlite3.Row` 使查询结果支持列名访问。

#### 4.1.1 用户与学生表

**students 表**（`backend/app/db.py` 第 36-44 行）：

```sql
CREATE TABLE IF NOT EXISTS students (
  user_id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  major TEXT DEFAULT '',
  grade TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | TEXT PK | 用户唯一标识，默认 `'single_user'` |
| name | TEXT | 学生姓名，种子数据为 '张同学' |
| email | TEXT | 邮箱地址，种子数据 'student@sparklearn.ai' |
| major | TEXT | 专业，种子数据 '计算机科学' |
| grade | TEXT | 年级，种子数据 '大二' |
| created_at | TEXT | ISO 时间戳，创建时间 |
| updated_at | TEXT | ISO 时间戳，最后更新时间 |

用途：学生基础身份信息存储，通过 `_seed_student_columns()`（第 393-396 行）兼容旧版本无 email 字段的迁移。初始化时通过 `INSERT OR IGNORE` 创建默认学生记录（第 349-364 行）。

**profiles 表**（`backend/app/db.py` 第 46-58 行）：

```sql
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  goal TEXT DEFAULT '[]',
  knowledge_level TEXT DEFAULT '',
  weak_points TEXT DEFAULT '[]',
  learning_preference TEXT DEFAULT '[]',
  cognitive_style TEXT DEFAULT '',
  daily_time INTEGER DEFAULT 60,
  practical_ability TEXT DEFAULT '',
  current_stage TEXT DEFAULT '',
  version INTEGER DEFAULT 1,
  updated_at TEXT NOT NULL
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | TEXT PK | 用户标识，与 students 一对一 |
| goal | TEXT | JSON 数组，学习目标，如 `["期末提分","竞赛准备"]` |
| knowledge_level | TEXT | 知识水平描述，如 `"有一定基础"` |
| weak_points | TEXT | JSON 数组，薄弱知识点，如 `["函数","面向对象"]` |
| learning_preference | TEXT | JSON 数组，学习偏好，如 `["视觉型","实践型"]` |
| cognitive_style | TEXT | 认知风格，如 `"归纳型"` |
| daily_time | INTEGER | 每日可用学习时间（分钟），默认 60 |
| practical_ability | TEXT | 实操能力描述，如 `"能独立完成小项目"` |
| current_stage | TEXT | 当前学习阶段，如 `"函数与模块"` |
| version | INTEGER | 画像版本号，默认 1，每次更新递增 |
| updated_at | TEXT | 最后更新时间 |

用途：学生个性化学习画像的核心数据表。所有 Agent（路径规划、资源生成、评估、推荐）都以此表为统一状态入口。`goal`/`weak_points`/`learning_preference` 以 JSON 字符串存储数组，`version` 字段支持变更追踪。

种子数据（第 366-385 行）：
```python
goal = ["期末提分", "竞赛准备"]
knowledge_level = "有一定基础"
weak_points = ["函数", "面向对象"]
learning_preference = ["视觉型", "实践型"]
cognitive_style = "归纳型"
daily_time = 60
practical_ability = "能独立完成小项目"
current_stage = "函数与模块"
version = 1
```

#### 4.1.2 学习数据表

**mastery_records 表**（`backend/app/db.py` 第 60-68 行）：

```sql
CREATE TABLE IF NOT EXISTS mastery_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  knowledge_point_id TEXT NOT NULL,
  knowledge_point_name TEXT NOT NULL,
  score REAL NOT NULL,
  chapter TEXT NOT NULL,
  last_updated TEXT NOT NULL
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增主键 |
| user_id | TEXT | 用户标识 |
| knowledge_point_id | TEXT | 知识点编号，如 `"1.1"`, `"3.2"` |
| knowledge_point_name | TEXT | 知识点名称，如 `"变量定义"`, `"闭包"` |
| score | REAL | 掌握度评分（0.0-1.0） |
| chapter | TEXT | 所属章节，如 `"基础语法"`, `"函数"`, `"面向对象"` |
| last_updated | TEXT | 最后更新时间 |

用途：记录学生对各知识点的掌握度评分。种子数据（`_seed_mastery()` 第 411-438 行）包含 8 个知识点的初始评分：

| 编号 | 知识点 | 评分 | 章节 |
|---|---|---|---|
| 1.1 | 变量定义 | 0.90 | 基础语法 |
| 1.2 | 数据类型 | 0.85 | 基础语法 |
| 2.1 | 条件语句 | 0.75 | 控制流 |
| 2.2 | 循环 | 0.70 | 控制流 |
| 3.1 | 函数定义 | 0.62 | 函数 |
| 3.2 | 参数传递 | 0.55 | 函数 |
| 3.3 | 闭包 | 0.45 | 函数 |
| 4.1 | 类与对象 | 0.30 | 面向对象 |

该表为路径规划（决定优先学习什么）、练习出题（按掌握度调整难度）、学习报告（绘制掌握度图表）提供数据基础。

**contribution_days 表**（`backend/app/db.py` 第 70-78 行）：

```sql
CREATE TABLE IF NOT EXISTS contribution_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  count INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contribution_unique
  ON contribution_days(user_id, date);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增主键 |
| user_id | TEXT | 用户标识 |
| date | TEXT | 日期，如 `"2026-05-29"` |
| count | INTEGER | 当日学习活动次数 |

用途：学习热力图数据。通过 `(user_id, date)` 唯一索引保证每天一条记录，`count` 字段记录该日学习行为次数（如打开资源、完成练习、提交任务等），前端用此数据渲染 GitHub 风格的贡献热力图，直观展示学习活跃度。

#### 4.1.3 辅导与对话表

**tutor_roles 表**（`backend/app/db.py` 第 80-91 行）：

```sql
CREATE TABLE IF NOT EXISTS tutor_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  persona TEXT DEFAULT '',
  background TEXT DEFAULT '',
  style_guide TEXT DEFAULT '',
  rules TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增主键（角色 ID） |
| user_id | TEXT | 用户标识 |
| name | TEXT | 角色名称，如 `"小星同学-通用导师"` |
| persona | TEXT | 完整人格描述（200+ 字） |
| background | TEXT | 适用人群、教学场景、知识边界 |
| style_guide | TEXT | 风格指南 |
| rules | TEXT | 行为规则（必须做 / 不可做） |
| enabled | INTEGER | 是否启用（0/1），默认 1 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 最后更新时间 |

用途：定义 AI 辅导角色的完整人格模板。`persona` 字段存储完整的 System Prompt 级别描述，`rules` 字段以"必须做/不可做"的格式约束 Agent 行为边界。种子数据（第 448-484 行）默认创建"小星同学-通用导师"角色，其 persona 涵盖了"温和而专业"的教学风格、"启发式提问"的策略、以及"代码示例必须可运行、数学推导分步骤、关注学生情绪状态"等具体规则。

**tutor_conversations 表**（`backend/app/db.py` 第 93-100 行）：

```sql
CREATE TABLE IF NOT EXISTS tutor_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role_id INTEGER,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

用途：对话会话管理。每个会话关联一个 tutor_role（`role_id` 外键），`title` 默认 `"新对话"`，`updated_at` 记录最后一次消息的时间。

**tutor_messages 表**（`backend/app/db.py` 第 102-111 行）：

```sql
CREATE TABLE IF NOT EXISTS tutor_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  content TEXT NOT NULL,
  file_ids TEXT DEFAULT '[]',
  meta_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| conversation_id | INTEGER | 所属会话 ID |
| sender_role | TEXT | 发送者角色（`"user"` / `"assistant"` / `"system"`） |
| content | TEXT | 消息内容 |
| file_ids | TEXT | JSON 数组，关联的上传文件 ID |
| meta_json | TEXT | 扩展元数据 JSON（通过 `_ensure_tutor_message_columns()` 兼容旧表） |

用途：辅导对话的消息存储。`meta_json` 字段为后续扩展保留的元数据容器。

**tutor_files 表**（`backend/app/db.py` 第 113-121 行）：

```sql
CREATE TABLE IF NOT EXISTS tutor_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/octet-stream',
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
```

用途：辅导对话中上传的文件管理。文件存储在服务端的 `stored_path` 路径，`mime_type` 和 `size_bytes` 记录文件类型和大小。

**tutor_file_chunks 表**（`backend/app/db.py` 第 123-130 行）：

```sql
CREATE TABLE IF NOT EXISTS tutor_file_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding_json TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
```

用途：上传文件的分块存储，用于对话上下文相关文件内容的向量化检索。`embedding_json` 字段存储文本片的嵌入向量 JSON。

#### 4.1.4 知识库表（✅ RAG 重新设计后）

**knowledge_files 表**（`backend/app/db.py` 第 132-146 行）：

```sql
CREATE TABLE IF NOT EXISTS knowledge_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/octet-stream',
  size_bytes INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  tags TEXT DEFAULT '[]',
  summary TEXT DEFAULT '',
  chunk_count INTEGER DEFAULT 0,
  reference_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| status | TEXT | 处理状态：`pending` → `processing` → `indexed` → `failed` |
| tags | TEXT | JSON 数组，资源标签 |
| summary | TEXT | AI 生成的内容摘要 |
| chunk_count | INTEGER | 分块数量 |
| reference_count | INTEGER | 被引用次数 |

用途：知识库文件的元信息管理。文件上传后进入 `pending` 状态，经过分块处理和向量嵌入后变为 `indexed`；若处理失败则标记为 `failed`。`reference_count` 记录文件在回答中被引用的次数，作为文件价值的参考指标。

**knowledge_chunks 表**（`backend/app/db.py` 第 148-154 行）：

```sql
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

用途：知识库文件的文本切片。`chunk_index` 表示切片在文件中的顺序编号，`content` 存储该切片的文本内容。该表通过 `_ensure_knowledge_columns()`（第 399-402 行）兼容旧版本，动态添加 `embedding_json` 列（TEXT DEFAULT ''）以支持向量嵌入存储。

RAG 检索流程：文件上传 → `knowledge_files` 记录创建（status='pending'）→ 文本分块 → `knowledge_chunks` 写入 → 向量嵌入计算 → `embedding_json` 填充 → status='indexed'。查询时通过 embedding 相似度检索相关 chunk，再将 chunk 的上文 context 注入 LLM 回答。

#### 4.1.5 Agent 宠物表

**agent_pets 表**（`backend/app/db.py` 第 156-167 行）：

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

用途：学习伙伴（Agent 宠物）的身份数据。每个用户只允许拥有一只宠物（`UNIQUE(user_id)`）。`level` 从 1 到 5，升级阈值 `LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000]`；`xp` 累积经验值，完成任务后由 `_award_xp()` 函数增加。

**agent_tasks 表**（`backend/app/db.py` 第 169-184 行）：

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
```

| 字段 | 类型 | 说明 |
|---|---|---|
| task_type | TEXT | 任务类型：search/summarize/compare/recommend |
| input_text | TEXT | 用户输入（1-200 字符） |
| result_json | TEXT | 任务执行结果 JSON |
| error_message | TEXT | 失败时的错误信息 |
| feedback | TEXT | 用户反馈：useful/not_useful |
| status | TEXT | pending → running → completed/failed |

用途：Agent 任务的生命周期管理。每个任务绑定一只宠物（`pet_id`），任务类型由宠物的当前等级和 `LEVEL_ABILITIES` 字典决定是否可用。`feedback` 字段收集用户评价，用于优化后续推荐。

**agent_messages 表**（`backend/app/db.py` 第 186-196 行）：

```sql
CREATE TABLE IF NOT EXISTS agent_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

用途：Agent 任务内的对话消息记录。

**agent_task_steps 表**（`backend/app/db.py` 第 198-208 行）：

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

用途：Agent 任务的执行步骤日志。每个步骤由 `_add_step()` 写入，包含步骤序号、动作类型（如 start/extract/navigate/done/error）和描述。前端通过轮询此表获取任务实时进度。

#### 4.1.6 社区与管理表

**forum_posts 表**（`backend/app/db.py` 第 210-229 行）：

```sql
CREATE TABLE IF NOT EXISTS forum_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'published',
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  favorite_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

用途：社区论坛帖子。种子数据（`_seed_forum_posts()` 第 508-605 行）预置了 44 篇帖子，分布在 4 个模块中：
- `resource_share`（资源分享）：11 篇，如"Python 函数速查表（可打印版）"
- `qa`（问答求助）：11 篇，如"闭包为什么能记住外部变量？"
- `team_study`（组队共学）：11 篇，如"组队冲刺：Python 期末 14 天"
- `experience_share`（经验分享）：11 篇，如"我把错题本做成了提分系统"

每个帖子的 `like_count`/`comment_count`/`favorite_count`/`view_count` 由种子算法生成模拟数据。

**forum_comments 表**（`backend/app/db.py` 第 231-242 行）：

```sql
CREATE TABLE IF NOT EXISTS forum_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

用途：帖子评论。`status` 字段支持内容审核（published/hidden）。

**forum_post_likes 表**（`backend/app/db.py` 第 244-252 行）：`(post_id, user_id)` 唯一索引，防止重复点赞。

**forum_post_favorites 表**（`backend/app/db.py` 第 254-262 行）：`(post_id, user_id)` 唯一索引，防止重复收藏。

**forum_attachments 表**（`backend/app/db.py` 第 264-276 行）：帖子的文件附件管理。

**forum_browsing_history 表**（`backend/app/db.py` 第 278-289 行）：浏览历史，`(user_id, post_id)` 唯一索引每次浏览更新 `viewed_at`。

**teacher_broadcasts 表**（`backend/app/db.py` 第 301-313 行）：

```sql
CREATE TABLE IF NOT EXISTS teacher_broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'all',
  target_student_ids TEXT DEFAULT '[]',
  material_file_ids TEXT DEFAULT '[]',
  created_at TEXT NOT NULL
);
```

用途：教师广播通知。`target_type` 区分全员/定向推送，`target_student_ids` 和 `material_file_ids` 以 JSON 数组存储。

**teacher_material_files 表**（`backend/app/db.py` 第 291-299 行）：教师上传的教学资料文件管理。

**mcp_services 表**（`backend/app/db.py` 第 315-339 行）：

```sql
CREATE TABLE IF NOT EXISTS mcp_services (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'user',
  transport TEXT NOT NULL,
  endpoint TEXT DEFAULT '',
  command TEXT DEFAULT '',
  args_json TEXT DEFAULT '[]',
  env_json TEXT DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 0,
  last_status TEXT NOT NULL DEFAULT 'unknown',
  last_error TEXT DEFAULT '',
  last_tested_at TEXT DEFAULT '',
  startup_timeout_ms INTEGER NOT NULL DEFAULT 60000,
  tool_timeout_ms INTEGER NOT NULL DEFAULT 30000,
  long_task_timeout_ms INTEGER NOT NULL DEFAULT 120000,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

用途：MCP 插件的注册和管理。支持三种传输方式（`transport`）：stdio（本地命令行启动）、sse（Server-Sent Events）、streamable-http。三级超时体系：启动超时 60s、工具执行超时 30s、长任务超时 120s。每条服务有独立的状态检测记录（`last_status`/`last_error`/`last_tested_at`），`source` 字段区分 user（用户自定义）和 builtin（系统内置）。

### 4.2 迁移目标：PolarDB PostgreSQL（✅ 已适配）

#### 4.2.1 为什么选择 PolarDB PostgreSQL

PolarDB PostgreSQL 是阿里云自主研发的云原生关系型数据库，兼容 PostgreSQL 协议。选择理由：

1. **国产自主可控**：符合项目对国产化技术栈的要求，PolarDB 通过中国信通院等权威认证。
2. **PostgreSQL 生态兼容**：完全兼容 PostgreSQL 语法和工具链，迁移成本低。Python 生态中 `asyncpg` 和 `psycopg2` 是成熟的 PostgreSQL 驱动。
3. **云原生弹性扩展**：支持计算与存储分离，读写分离自动读写分离，适合未来多用户并发场景。
4. **JSON/JSONB 原生支持**：PostgreSQL 的 JSONB 类型提供二进制 JSON 存储和 GIN 索引加速，优于 SQLite 的 TEXT 存 JSON 字符串方案。
5. **向量扩展兼容**：pgvector 扩展可原生支持向量嵌入的存储和相似度检索，取代当前 SQLite 中 embedding 以 TEXT JSON 字符串存储的方式。

#### 4.2.2 SQLite → PostgreSQL 的关键差异

| 差异点 | SQLite 当前方案 | PostgreSQL 目标方案 | 迁移变更 |
|---|---|---|---|
| 自增主键 | `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` 或 `BIGSERIAL` | 直接替换 |
| 文本主键 | `TEXT PRIMARY KEY` (UUID) | `UUID PRIMARY KEY` 使用 `uuid-ossp` 扩展 | 类型替换，需引入 UUID 生成 |
| JSON 字段 | `TEXT` 存储 JSON 字符串 | `JSONB` 类型 | 原生 JSON 操作，支持索引 |
| 布尔字段 | `INTEGER DEFAULT 1` (0/1) | `BOOLEAN DEFAULT TRUE` | 语义更清晰 |
| 时间戳 | `TEXT NOT NULL` (ISO 字符串) | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | 原生时间类型，自动时区 |
| UNIQUE INDEX | SQLite 语法 | PostgreSQL 语法兼容 | 几乎无差异 |
| 不指定长度 TEXT | SQLite 接受 | PostgreSQL 使用 `TEXT` | 无差异 |
| 浮点数 | `REAL` | `DOUBLE PRECISION` 或 `NUMERIC` | 精度选项更多 |
| 数据库文件 | 单文件 `sparklearn.db` | 服务端数据库实例 | 架构变化 |

关键改进举例：

**profiles 表的 PostgreSQL 迁移版本**：
```sql
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY,
  goal JSONB DEFAULT '[]'::jsonb,
  knowledge_level TEXT DEFAULT '',
  weak_points JSONB DEFAULT '[]'::jsonb,
  learning_preference JSONB DEFAULT '[]'::jsonb,
  cognitive_style TEXT DEFAULT '',
  daily_time INTEGER DEFAULT 60,
  practical_ability TEXT DEFAULT '',
  current_stage TEXT DEFAULT '',
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- JSONB 索引加速按薄弱点/目标检索
CREATE INDEX idx_profiles_weak_points ON profiles USING GIN (weak_points);
CREATE INDEX idx_profiles_goal ON profiles USING GIN (goal);
```

**knowledge_chunks 表的 PostgreSQL 迁移版本（引入 pgvector）**：
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id BIGSERIAL PRIMARY KEY,
  file_id BIGINT NOT NULL REFERENCES knowledge_files(id),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),  -- 替换 TEXT JSON 字符串
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 向量相似度索引
CREATE INDEX idx_knowledge_chunks_embedding
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);
```

#### 4.2.3 迁移方案

迁移策略分为四个阶段：

**第一阶段：双写验证期**（预计 1 周）
- 在现有 FastAPI 后端中引入 PostgreSQL 连接（`asyncpg` 或 `psycopg2`）
- 每次写操作同时写入 SQLite 和 PostgreSQL
- 验证数据一致性，记录差异日志

**第二阶段：读切换期**（预计 2 周）
- 将读操作逐步切换到 PostgreSQL
- SQLite 作为备份数据源（读失败时回退）
- 监控查询延迟和 QPS 表现

**第三阶段：全量切换期**（预计 1 周）
- 移除 SQLite 读写依赖
- SQLite 文件保留作为离线备份
- 清理双写代码

**第四阶段：优化期**（持续）
- 利用 PostgreSQL JSONB GIN 索引加速画像搜索
- 利用 pgvector 实现高效向量相似度检索
- 配置读写分离（PolarDB 自动模式）

数据迁移工具使用 Python 脚本批量从 SQLite 导出表数据（使用 `fetch_all()`），经类型转换后批量 `INSERT` 到 PostgreSQL。JSON 文本字段使用 `json.loads()` 解析后以 JSONB 写入，时间戳字符串转换为 `TIMESTAMPTZ`。

#### 4.2.4 回滚策略

每一阶段都保留完整的回滚能力：
- SQLite 数据库文件在迁移期间不删除、不覆写，始终作为全量备份
- `backend/app/config.py` 中增加 `use_db` 配置项（`sqlite` / `postgresql`），运行时切换
- `get_conn()` 函数根据配置返回对应的数据库连接，上层代码无需修改
- 发现问题时可一键切回 `use_db=sqlite`，零数据丢失
- 回滚后对 PostgreSQL 中的数据进行审计对比，修复差异后重新迁移

---

## 5. JSON/JSONL 数据文件

除了 SQLite 数据库外，SparkLearn 通过 `backend/app/storage.py` 的 JSON/JSONL 文件系统存储了大量的学习过程数据和配置数据。所有文件位于 `backend/data/users/{user_id}/`（当前为 `single_user/`）目录下。

### 5.1 profile_snapshot.json

**位置**: `backend/data/users/single_user/profile_snapshot.json`
**格式**: JSON 对象
**用途**: 学生画像的轻量快照。与 `profiles` 数据库表保持同步，作为前端画像页面的直接数据源和 API 快速响应缓存。结构如下：

```json
{
  "goal": ["掌握核心技能"],
  "knowledge_level": "有一定基础",
  "weak_points": ["高级设计能力"],
  "learning_preference": ["动手实践，边学边做"],
  "cognitive_style": "归纳型",
  "daily_time": 30,
  "practical_ability": "能独立完成小项目",
  "current_stage": "函数与模块",
  "version": 1,
  "updated_at": "2026-05-28T11:31:28.955503Z"
}
```

与数据库 `profiles` 表的区别：此文件不包含 `user_id` 字段（因为属于特定用户目录），是面向前端 API 的扁平化视图。

### 5.2 memory_store.json（✅ 记忆层已重写后的四层结构）

**位置**: `backend/data/users/single_user/memory_store.json`
**格式**: JSON 对象
**用途**: AI 记忆引擎的持久化存储，由 `backend/app/memory_engine.py` 维护。采用四层记忆结构：

```json
{
  "version": 1,
  "updated_at": "2026-05-28T11:35:49.376978Z",
  "working": [...],     // 工作记忆（最近对话上下文，上限 80 条）
  "episodic": [...],    // 情景记忆（学习事件，上限 500 条）
  "semantic": {         // 语义记忆（长期知识抽取）
    "goals": [],
    "preferences": [],
    "constraints": [],
    "facts": [],
    "skills": [],
    "weak_points": [],
    "learning_stage": ""
  },
  "perceptual": [...]   // 感知记忆（资料摘要，上限 300 条）
}
```

**四层记忆详解**：

- **working（工作记忆）**: 存储最近 80 条用户交互相关的上下文，每条记录包含 `id`/`type`/`content`/`source`/`tags`/`importance`/`confidence`/`created_at`/`last_accessed_at`/`access_count`/`pinned`/`expires_at` 字段。类型标记为 `"context"` 或 `"current_turn"`（当前对话轮次）。内存管理通过 `WORKING_LIMIT = 80` 限制数量，超出自动裁剪。

- **episodic（情景记忆）**: 存储最近 500 条学习事件记录，包含完整的历史对话问答对（用户问题 + 助手回答摘要）。类型标记为 `"learning_event"`、`"qa_event"` 或 `"promoted_working"`（从工作记忆晋升）。通过 `consolidate_memory()` 函数实现从 working 到 episodic 的记忆巩固（importance >= 0.7 的条目自动晋升）。

- **semantic（语义记忆）**: 长期知识的结构化存储，包含 7 个子类：
  - `goals`：学习目标（从对话中抽取，如"期末提分"）
  - `preferences`：学习偏好（如"喜欢代码案例"）
  - `constraints`：学习约束（如"每天30分钟"）
  - `facts`：用户记忆的事实（用户要求记住的内容）
  - `skills`：已掌握的技能标签
  - `weak_points`：薄弱点列表
  - `learning_stage`：当前学习阶段

- **perceptual（感知记忆）**: 存储最近 300 条文档摘要和资料理解结果。类型标记为 `"asset_summary"` 或 `"document"`。上限由 `PERCEPTUAL_LIMIT = 300` 控制。

记忆引擎提供以下核心操作函数（均在 `memory_engine.py` 中）：

| 函数 | 功能 |
|---|---|
| `load_user_memory()` (第 75-134 行) | 加载并规范化记忆数据，自动补齐缺失字段 |
| `save_user_memory()` (第 137-151 行) | 合并保存记忆，以 base 记忆为基础增量更新 |
| `add_memory_item()` (第 154-195 行) | 向指定记忆层添加条目，自动裁剪超出限制 |
| `search_memory()` (第 234-275 行) | 语义搜索记忆（语义相似度 60% + 时间新近度 20% + 重要性 15% + 置顶加分 5%） |
| `consolidate_memory()` (第 278-313 行) | 记忆巩固：高重要性条目从 working 晋升 episodic，从 episodic 抽取语义特征 |
| `forget_memory()` (第 316-354 行) | 遗忘机制：清理低重要性/过期记录 |
| `build_injected_context()` (第 357-380 行) | 构建 Agent 上下文注入文本，组装语义记忆 + 相关历史记忆 |
| `update_memory_from_turn()` (第 383-436 行) | 从每轮对话更新记忆：记录 working + episodic，用正则抽取 goals/preferences/constraints/facts |

### 5.3 learning_events.jsonl

**位置**: `backend/data/users/single_user/learning_events.jsonl`
**格式**: JSONL（每行一个 JSON 对象）
**用途**: 学习事件流水。通过 `backend/app/storage.py` 的 `append_jsonl()` 函数追加写入。当前文件大小约 175KB，记录了大量学习行为事件。事件类型包括：

| 事件类型 | 说明 |
|---|---|
| `profile_onboarding` | 首次建档对话完成，附带完整画像 |
| `profile_dialog_completed` | 画像对话完成，附带 session_id 和更新后的画像 |
| `tutor_chat` | 辅导对话提问，附带 question 文本 |
| `submit_quiz` | 提交练习答案，附带 quiz_id 和 correct 结果 |

每条记录格式：`{"ts": "ISO时间戳", "type": "事件类型", ...事件载荷...}`（通过 `append_jsonl()` 自动添加 `ts` 字段，见 `storage.py` 第 27-31 行）。

### 5.4 resource_usage.jsonl

**位置**: `backend/data/users/single_user/resource_usage.jsonl`
**格式**: JSONL
**用途**: 资源使用追踪。记录每次资源生成和删除的操作日志。事件类型：
- `resource_generated`：资源生成完成，附带 `resource_id`
- `resource_deleted`：资源被删除，附带 `resource_id` 和 `removed_count`

当前文件约 11.7KB，包含大量资源生成/删除的历史记录，用于审计和恢复。

### 5.5 resources_index.json

**位置**: `backend/data/users/single_user/resources_index.json`
**格式**: JSON 数组
**用途**: 学生历史资源的聚合索引。前端资源列表页的直接数据源。每条资源记录的字段结构：

| 字段 | 说明 | 示例 |
|---|---|---|
| id | 资源唯一标识 | `"gen-96b542e2"` |
| title | 资源标题（含生成 prompt 摘要） | `"Python类精讲"` |
| type | 资源类型 | `"ppt"` / `"blog"` / `"document"` / `"mindmap"` |
| status | 状态 | `"completed"` |
| created_at | 创建日期 | `"2026-04-22"` |
| content | 原始 prompt + AI 补充内容 | Markdown 格式 |
| source_url | 资源链接 | PPT 链接 / HTML 文档链接 / Mermaid 链接 |
| cover_img_src | 封面图（PPT 类型） | 图片 URL |
| xf_sid | 讯飞智文 session ID（PPT 类型） | 字符串 |
| progress | 生成进度百分比 | 100 |

### 5.6 video_resources.json

**位置**: `backend/data/users/single_user/video_resources.json`
**格式**: JSON 数组
**用途**: 视频资源管理。记录生成的每个教学视频的完整元数据：

| 字段 | 说明 |
|---|---|
| id | 视频唯一标识，如 `"video_46634c07"` |
| title | 视频标题 |
| status | 状态（`"completed"`） |
| duration / duration_ms | 视频时长（秒/毫秒） |
| video_url | MP4 下载/播放地址 |
| audio_url | 音频分离下载地址 |
| subtitle_url | SRT 字幕文件地址 |
| timeline_url | 时间轴数据地址 |
| scene_url | 场景数据地址 |
| share_url | 分享链接 |
| resolution | 分辨率（`"1920x1080"`） |
| fps | 帧率（30） |
| provider | 渲染引擎（`"html_ppt"`） |
| tts_provider | 语音合成引擎（`"xunfei_tts"`） |
| slides | 幻灯片页数 |
| audio_status / frame_status / mux_status | 各子流程状态 |

### 5.7 quiz_records.json

**位置**: `backend/data/users/single_user/quiz_records.json`
**格式**: JSON 数组
**用途**: 练习作答记录。由 `backend/app/routes/quiz.py` 的提交接口写入。每条记录：

```json
{
  "quiz_id": "q1",
  "answer": "list",
  "correct": true,
  "correct_answer": "list",
  "knowledge_point_id": "1.2",
  "at": "2026-04-20"
}
```

此文件支撑 `GET /api/quiz/records`（获取作答历史）、`GET /api/quiz/records/stats`（统计数据）、`DELETE /api/quiz/records`（清除记录）等 API。注意：quiz 数据当前完全通过 JSON 文件管理，数据库中没有对应的 quiz_sets/quiz_records 表。

### 5.8 latest_quiz_set.json

**位置**: `backend/data/users/single_user/latest_quiz_set.json`
**格式**: JSON 数组
**用途**: 最新生成的每日练习题集。每个元素是一道题目，包含：

```json
{
  "id": "dq_e9c7de70_1",
  "type": "single",
  "content": "三元表达式的语法是什么？",
  "options": ["a if b else c", "if b then a else c", "b ? a : c", "a unless b else c"],
  "correct_answer": "a if b else c",
  "explanation": "Python 的三元表达式格式为 a if condition else b。",
  "knowledge_point_id": "2.2",
  "knowledge_point_name": "条件判断"
}
```

题目类型包括 `single`（单选）、`multiple`（多选）、`fill_blank`（填空）。该文件由每日练习生成流程自动覆盖更新。

### 5.9 其他数据文件

| 文件名 | 用途 |
|---|---|
| `path_planning_history.json` (约 60KB) | 学习路径规划的历史记录 |
| `quiz_favorites.json` | 收藏的练习题列表 |
| `task_progress.json` | 任务推进状态 |
| `tutor_history.json` | 辅导对话历史摘要 |
| `video_events.jsonl` | 视频生成事件流水 |
| `video_jobs.json` (约 35KB) | 视频生成任务详情 |

所有这些文件通过 `storage.py` 的 `read_json()` 和 `write_json()` 统一管理，编码格式为 UTF-8（读取使用 `utf-8-sig` 以兼容 BOM，写入使用 `utf-8`）。

---

## 6. 数据库迁移与版本管理 ✅

### 6.1 当前版本管理机制

SparkLearn 采用"渐进式列扩展 + 种子数据幂等插入"的轻量迁移策略，不依赖 Alembic 等重量级迁移框架。具体机制如下：

**列兼容性迁移**（`_ensure_*_columns()` 系列函数）：

```python
# backend/app/db.py

def _ensure_student_columns(conn):        # 第 393-396 行
    """检查并添加 email 列（旧版 students 表无此列）"""
    通过 PRAGMA table_info(students) 检查列，缺失时 ALTER TABLE ADD COLUMN

def _ensure_knowledge_columns(conn):      # 第 399-402 行
    """检查并添加 embedding_json 列（旧版 knowledge_chunks 表无此列）"""
    通过 PRAGMA table_info(knowledge_chunks) 检查列，缺失时添加

def _ensure_tutor_message_columns(conn):  # 第 405-408 行
    """检查并添加 meta_json 列（旧版 tutor_messages 表无此列）"""
```

这种策略的优势是：在 `init_db()` 每次启动时自动执行，无需人工执行迁移脚本。但局限性也很明显：SQLite 的 `ALTER TABLE` 仅支持添加列和重命名表，不支持删除列、修改列类型等复杂操作。

**种子数据幂等插入**：所有种子数据的插入都使用 `INSERT OR IGNORE` 或先 `SELECT COUNT(*)` 检查再插入的模式，确保多次运行 `init_db()` 不会产生重复数据。

**画像版本号机制**：`profiles` 表的 `version` 字段（INTEGER DEFAULT 1）在每次画像更新时递增，作为变更追踪的基本手段。

### 6.2 迁移到 PolarDB 后的版本管理方案

迁移到 PostgreSQL 后，将引入更规范的迁移管理：

```python
# 使用 Alembic 自动生成迁移脚本
# 目录结构：
# backend/
#   alembic/
#     versions/
#       001_initial_schema.py
#       002_add_user_avatar_column.py
#       ...
#   alembic.ini
```

每个 Alembic 迁移版本包含 `upgrade()` 和 `downgrade()` 两个函数，支持正向迁移和回滚。迁移脚本纳入 Git 版本管理，与代码保持同步。

### 6.3 JSON 文件的版本管理

JSON/JSONL 数据文件通过以下方式实现版本管理：

- `memory_store.json` 的 `version` 字段（第 19 行 `_default_memory()` 函数定义 `version: 1`），每次 `consolidate_memory()` 或 `forget_memory()` 操作后递增。
- `profile_snapshot.json` 的 `version` 字段，与数据库 `profiles` 表同步。
- JSONL 文件通过追加式的 `ts` 时间戳字段实现时间序列排序，不会覆写历史记录。

---

## 7. 待实现 🔲

### 7.1 知识图谱数据模型 🔲

当前系统中，知识点以 `mastery_records` 表的 `knowledge_point_id` + `chapter` 字段进行扁平化组织，缺乏知识点之间的依赖关系、前置关系和多对多标签体系。知识图谱数据模型预计需要新增以下表：

```sql
-- 知识点节点表
CREATE TABLE knowledge_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  chapter TEXT NOT NULL,
  difficulty_level INTEGER DEFAULT 1,
  description TEXT DEFAULT '',
  prerequisites_json TEXT DEFAULT '[]',  -- 前置知识点 ID 列表
  related_json TEXT DEFAULT '[]',        -- 关联知识点 ID 列表
  created_at TIMESTAMPTZ NOT NULL
);

-- 知识点关系边表（多对多）
CREATE TABLE knowledge_edges (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES knowledge_nodes(id),
  target_id TEXT NOT NULL REFERENCES knowledge_nodes(id),
  relation_type TEXT NOT NULL,  -- prerequisite / extends / relates_to / contradicts
  weight REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL
);
```

知识图谱将支撑：第一，基于前置依赖关系的自适应学习路径排序（必须先学会 A 再学 B）；第二，薄弱点的传播影响分析（如果函数是薄弱点，与函数相关的闭包、装饰器等节点也应重点关注）；第三，可视化知识拓扑图的前端渲染。

### 7.2 外部接口数据表 🔲

随着平台功能的扩展，以下外部接口相关数据表有待设计：

**SMS 验证码表**（待设计）：
```sql
CREATE TABLE sms_codes (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login',  -- login / register / reset_password
  expires_at TIMESTAMPTZ NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sms_codes_phone ON sms_codes(phone, created_at DESC);
```

**OSS 文件映射表**（待设计）：用于管理上传到阿里云 OSS（对象存储）的文件与本地文件之间的映射关系。

```sql
CREATE TABLE oss_file_mappings (
  id BIGSERIAL PRIMARY KEY,
  local_path TEXT NOT NULL,
  oss_url TEXT NOT NULL,
  oss_bucket TEXT NOT NULL,
  oss_key TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT DEFAULT 'application/octet-stream',
  upload_status TEXT DEFAULT 'pending',  -- pending / uploading / completed / failed
  created_at TIMESTAMPTZ NOT NULL
);
```

**外部信息流表**（待设计）：用于接入第三方的学习内容源（如 RSS 学术动态、在线课程平台 API 等）。

```sql
CREATE TABLE external_feeds (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  feed_type TEXT NOT NULL,  -- rss / api / webhook
  last_fetched_at TIMESTAMPTZ,
  fetch_interval_min INTEGER DEFAULT 360,
  enabled INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE external_feed_items (
  id BIGSERIAL PRIMARY KEY,
  feed_id BIGINT NOT NULL REFERENCES external_feeds(id),
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  source_url TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL,
  relevance_score REAL DEFAULT 0.0
);
```

---

## 附录：代码路径索引

| 系统组件 | 代码路径 |
|---|---|
| 数据库 Schema (init_db) | `backend/app/db.py` 第 31-390 行 |
| 数据库查询辅助 | `backend/app/db.py` 第 609-621 行 |
| JSON/JSONL 文件存储 | `backend/app/storage.py` |
| 星辰Agent开发平台适配器 (CozeAdapter) | `backend/app/coze.py` |
| Agent 路由（宠物认养/任务执行） | `backend/app/routes/agent.py` |
| 记忆引擎 | `backend/app/memory_engine.py` |
| 浏览器代理 (Playwright) | `backend/app/browser_agent.py` |
| 系统配置（环境变量） | `backend/app/config.py` 第 28-37 行（Coze）、第 80-82 行（Browser Headless） |
| 练习路由 | `backend/app/routes/quiz.py` |
| API 响应模型 | `backend/app/schemas.py` |
| 数据库文件 | `backend/data/db/sparklearn.db` |
| 用户数据目录 | `backend/data/users/single_user/` |
| 设计文档-数据设计 | `Dorc/第一阶段项目开发文档/学而思｜数据设计文档.md` |
| 设计文档-动态数据与Agent记忆 | `Dorc/第一阶段项目开发文档/学而思｜动态数据设计与 Agent 初始记忆设计文档.md` |
