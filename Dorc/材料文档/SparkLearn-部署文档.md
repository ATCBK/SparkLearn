# SparkLearn 部署文档

> 适用版本：v3.0+ | 最后更新：2026-05-29

## 1. 环境要求 ✅

SparkLearn 项目包含 Python 后端（FastAPI）、Node.js 前端（Next.js 16）和本机 Nanobot Agent 服务三个核心组件。部署前需要确保开发环境满足以下最低要求。

**操作系统**：项目面向 Windows 10/11 64 位系统开发与测试。由于使用了 Windows 特定的进程管理（`WindowsProactorEventLoopPolicy`）和路径处理，不建议在 Linux/macOS 上直接部署，但可通过 WSL2 配合适配脚本运行。

**Python 环境**：需要 Python 3.12 或更高版本。项目使用了 `pydantic-settings==2.5.2` 和 `fastapi==0.115.0`，这些版本要求 Python 3.9+，但建议使用 3.12+ 以获得最佳兼容性和性能。推荐使用 `venv` 创建虚拟环境来隔离依赖。对于 Nanobot 服务，需要单独的 `.venv-nanobot` 虚拟环境（该目录已在 `.gitignore` 中排除）。

**Node.js 环境**：需要 Node.js 20 LTS 或更高版本。前端使用 Next.js 16.2.4（App Router），依赖 React 19.2.4、Tailwind CSS 4、ECharts 5.6.0 等。通过 `npm install` 自动安装所有依赖，无需额外全局工具。

**其他依赖**：Git 用于版本管理和项目克隆。Playwright（1.51.0）用于 Agent 浏览器自动化，安装后需执行 `python -m playwright install chromium` 下载浏览器内核。Windows 系统建议在终端中执行 `chcp 65001` 切换到 UTF-8 编码，避免中文日志和输出乱码。

## 2. 项目获取与依赖安装 ✅

本章详细说明从零开始获取 SparkLearn 项目代码并完成依赖安装的全过程，涵盖后端、前端和 Nanobot 三个部分。

**项目克隆**：通过 Git 从仓库克隆项目到本地。建议使用固定路径 `D:\Project_building\SparkLearn`，因为环境变量中的 `NANOBOT_PROJECT_DIR` 和 `db_path` 等配置依赖绝对路径。如果使用其他路径，需要相应修改 `.env` 文件中的所有路径配置。克隆完成后进入项目根目录。

**后端依赖安装**：打开终端进入 `backend/` 目录，执行 `pip install -r requirements.txt`。该文件包含的核心依赖有：FastAPI 0.115.0（Web 框架）、uvicorn[standard] 0.30.0（ASGI 服务器）、pydantic 2.9.0 / pydantic-settings 2.5.2（配置管理）、httpx 0.27.0（HTTP 客户端）、websockets 12.0（WebSocket 支持）、python-multipart 0.0.9（文件上传）、playwright 1.51.0（浏览器自动化）、PyMuPDF 1.24.10（PDF 处理）、python-docx 1.1.2（Word 文档处理）、pytest 8.3.3 / pytest-asyncio 0.24.0（测试框架）。安装完成后，务必执行 `python -m playwright install chromium` 来下载 Playwright 所需的 Chromium 浏览器，否则 Agent 宠物的浏览器搜索功能将无法工作。

**前端依赖安装**：进入 `frontend/` 目录，执行 `npm install`。前端依赖包括：Next.js 16.2.4（React 框架）、React 19.2.4 / react-dom 19.2.4（UI 库）、Tailwind CSS 4（样式框架）、lucide-react 1.11.0（图标库）、echarts 5.6.0（图表库）、react-markdown 10.1.0（Markdown 渲染）、zustand 5.0.12（状态管理）、@uiw/react-codemirror 4.25.9（代码编辑器）。开发依赖包括 TypeScript 5、ESLint 9、@playwright/test 1.59.1 等。安装完成后确认 `node_modules/` 目录生成成功。

**Nanobot 获取与配置**：Nanobot 是一个本机 OpenAI-compatible Agent 框架，端口监听 `8900`。需要将 Nanobot 源码放置在项目内的 `nanobot-main/` 目录下（该目录已在 `.gitignore` 中排除，不会提交到仓库）。创建独立的虚拟环境 `.venv-nanobot/` 并安装 Nanobot 依赖。核心配置文件位于 `nanobot-main\.nanobot\config.json`，需配置上游模型 API key（如 OpenAI API key 或兼容接口）。启动时通过 `--config` 和 `--workspace` 参数显式指定配置路径，避免加载用户目录下的历史残留配置。

## 3. 环境变量配置 ✅

本章从 `backend/app/config.py` 中提取所有配置项，提供完整的 `.env` 文件模板。在项目根目录 `D:\Project_building\SparkLearn\.env` 中创建文件（该文件已在 `.gitignore` 中排除，不会被提交到仓库）。

### 3.1 讯飞星火大模型（必要配置）

SparkLearn 的核心 AI 引擎基于讯飞星火大模型，以下配置为必填项。

```
# ─── 讯飞星火 Spark（核心大模型） ───
spark_app_id=你的_app_id
spark_api_key=你的_api_key
spark_api_secret=你的_api_secret
spark_model=lite                       # 可选: lite, generalv3, pro, max
spark_api_url=wss://spark-api.xf-yun.com/v1.1/chat
spark_use_bridge=true                  # 使用本地 WebSocket 桥接程序
spark_bridge_exe=backend/bridge/bin/spark_bridge.exe
```

- **spark_app_id / spark_api_key / spark_api_secret**：从讯飞开放平台控制台 (https://console.xfyun.cn) 获取。进入"我的应用"→ 选择应用 → 查看对应的 APIKey/APISecret/APPID。这三项必须全部填写且匹配一致。
- **spark_model**：模型版本选择。`lite` 为轻量版（免费额度较多，适合开发测试），`generalv3` 为通用版，`pro` 和 `max` 为增强版（需付费）。建议开发阶段使用 `lite`。
- **spark_api_url**：星火大模型的 WebSocket 接口地址，通常无需修改。
- **spark_use_bridge / spark_bridge_exe**：星火 API 使用 WebSocket 协议，FastAPI 通过本地桥接程序 (`spark_bridge.exe`) 与讯飞建立连接。`spark_use_bridge=true` 表示启用桥接模式。桥接程序路径相对于项目根目录。

### 3.2 星辰Agent开发平台（资源生成）

星辰Agent开发平台（代码中变量名为 `coze_*`）用于驱动资源生成 Bot，负责生成文档、思维导图、练习、阅读材料和代码示例。

```
# ─── 星辰Agent开发平台 Coze（资源生成 Bot）─��──
coze_base_url=https://api.coze.cn
coze_api_path_chat=/v3/chat
coze_api_token=你的_coze_api_token
coze_default_user_id=single_user
coze_bot_id_resource_default=你的_默认bot_id
coze_bot_id_resource_document=你的_文档bot_id
coze_bot_id_resource_mindmap=你的_思维导图bot_id
coze_bot_id_resource_quiz=你的_练习bot_id
coze_bot_id_resource_reading=你的_阅读bot_id
coze_bot_id_resource_code=你的_代码bot_id
```

- **coze_api_token**：从星辰Agent开发平台控制台获取的 API 访问令牌。进入"个人设置"→"API Token"生成。
- **coze_bot_id_resource_***：六个 Bot ID 分别对应六种资源类型：`default`（默认/通用生成器）、`document`（文档生成）、`mindmap`（思维导图生成）、`quiz`（练习题生成）、`reading`（阅读材料生成）、`code`（代码示例生成）。每个 Bot 需要在星辰平台单独创建和配置，Bot ID 在 Bot 编辑页的 URL 中可以找到。
- **coze_base_url / coze_api_path_chat**：星辰API 的基地址和聊天接口路径，国内用户使用 `https://api.coze.cn`，通常无需修改。

### 3.3 讯飞 TTS（视频配音）

讯飞语音合成服务用于为 AI 生成的视频提供配音旁白。

```
# ─── 讯飞 TTS（视频配音） ───
xf_tts_app_id=你的_tts_app_id
xf_tts_api_key=你的_tts_api_key
xf_tts_api_secret=你的_tts_api_secret
xf_tts_base_url=wss://tts-api.xfyun.cn/v2/tts
xf_tts_default_voice=xiaoyan           # 默认发音人
xf_tts_max_concurrency=2               # 最大并发合成任务数
xf_tts_timeout_ms=15000                # 超时时间(毫秒)
xf_tts_text_limit=1000                 # 单次合成文本长度限制
```

- **xf_tts_app_id / xf_tts_api_key / xf_tts_api_secret**：从讯飞开放平台 TTS 服务获取。注意这是独立的 TTS 服务凭据，和星火大模型的凭据不同（虽然可能在同一应用下）。
- **xf_tts_default_voice**：默认发音人。可选值包括 `xiaoyan`（小燕，女声）、`xiaofeng`（小峰，男声）等，完整列表见讯飞 TTS 文档。用户在前端也可切换音色。
- **xf_tts_max_concurrency**：控制同时进行的语音合成任务数，避免超出 API 配额限制。
- **xf_tts_timeout_ms**：语音合成请求的超时时间，默认 15 秒足够大多数场景。
- **xf_tts_text_limit**：单次合成请求的最大文本长度（字符数）。片段超过此值会自动拆分。

### 3.4 讯飞智文 PPT

讯飞智文用于将文本大纲自动生成 PPT 演示文稿。

```
# ─── 讯飞智文 PPT ───
xfyun_zw_base_url=https://zwapi.xfyun.cn
xfyun_zw_app_id=你的_zw_app_id
xfyun_zw_api_secret=你的_zw_api_secret
xfyun_zw_ppt_author=SparkLearn         # PPT 作者名
xfyun_zw_timeout_sec=240               # 生成超时(秒)
```

- **xfyun_zw_app_id / xfyun_zw_api_secret**：从讯飞智文平台获取。需要先在讯飞智文 (https://zw.xfyun.cn) 注册并创建应用。
- **xfyun_zw_ppt_author**：生成的 PPT 文档属性中显示的作者名称，可自定义。
- **xfyun_zw_timeout_sec**：PPT 生成任务的最长等待时间。复杂度高的 PPT 可能需要数分钟，240 秒为推荐值。

### 3.5 讯飞 Embedding（知识库向量化）

讯飞 Embedding 服务将知识库文档文本转换为向量，用于 RAG（检索增强生成）语义检索。

```
# ─── 讯飞 Embedding（HTTP） ───
xfyun_emb_base_url=https://emb-cn-huabei-1.xf-yun.com/
xfyun_emb_app_id=你的_emb_app_id
xfyun_emb_api_key=你的_emb_api_key
xfyun_emb_api_secret=你的_emb_api_secret
xfyun_emb_timeout_sec=20               # Embedding 请求超时(秒)
```

- **xfyun_emb_app_id / xfyun_emb_api_key / xfyun_emb_api_secret**：从讯飞开放平台 Embedding 服务获取。
- **xfyun_emb_base_url**：华北区域的 Embedding 服务地址。如果使用其他区域，需替换为对应区域地址。
- **xfyun_emb_timeout_sec**：单次 Embedding 请求超时。文档较大时分段较多，可能需要处理多个请求。

### 3.6 视频 AI 配置

视频生成模块使用 AI 大模型优化视频脚本和内容，支持 OpenAI-compatible API。

```
# ─── 视频 AI 生成 ───
video_creator_enabled=true
video_default_provider=html_ppt        # 默认视频生成器
video_ai_enabled=true
video_ai_provider=openai_compatible
video_ai_base_url=https://api.openai.com/v1
video_ai_chat_path=/chat/completions
video_ai_api_key=你的_video_ai_key
video_ai_model=                        # 使用的模型名，如 gpt-4o
video_ai_agent_url=                    # 可选：转接到 Agent
video_ai_agent_token=                  # Agent 鉴权 Token
video_ai_timeout_sec=45
video_ai_max_tokens=4096
video_ai_temperature=0.7
video_ai_fallback_enabled=true         # 模型不可用时降级为本地渲染
```

- **video_ai_api_key**：视频 AI 模块使用的 API key。可以是 OpenAI 官方的 API key，也可以是任何 OpenAI-compatible 接口的 key（如 Nanobot 本地接口 `http://127.0.0.1:8900/v1`）。
- **video_ai_model**：指定使用的模型名称，如 `gpt-4o`、`gpt-3.5-turbo` 等。如果使用 Nanobot 本地接口，填写 Nanobot 中配置的模型名。
- **video_ai_base_url / video_ai_chat_path**：AI 服务的接口地址，默认指向 OpenAI 官方 API。如果使用本地 Nanobot，修改 `video_ai_base_url` 为 `http://127.0.0.1:8900/v1`。
- **video_ai_max_tokens / video_ai_temperature**：控制生成文本的长度和随机性。
- **video_ai_fallback_enabled**：当 AI 接口不可用（如余额不足、网络不通）时，自动降级为 HTML 幻灯片本地渲染模式，确保视频仍能生成。

### 3.7 Agent 浏览器配置

Agent 宠物使用 Playwright 驱动真实浏览器进行网页搜索、内容抓取和对比分析。

```
# ─── Agent 浏览器设置 ───
agent_browser_headless=false            # false=演示模式(窗口可见)
agent_browser_slow_mo=800              # 操作间隔(毫秒)，慢一点便于观察
```

- **agent_browser_headless**：设为 `false` 时浏览器窗口可见（适合开发和演示阶段，可观察 Agent 的操作过程）；设为 `true` 时浏览器在后台无头运行（适合生产或本机资源紧张场景）。
- **agent_browser_slow_mo**：浏览器自动化操作之间的延迟（毫秒），增大此值可以让操作更慢、更易于人工观察 Agent 的搜索行为。

### 3.8 其他配置

```
# ─── 基础配置 ───
app_name=SparkLearn API
app_version=1.0.0
debug=true
single_user_id=single_user             # 当前仅支持单用户模式
use_mock_data=true                     # 没有真实数据时使用模拟数据
cors_origin=http://localhost:3000
cors_origins=["http://localhost:3000", "http://127.0.0.1:3000"]
data_dir=backend/data
db_path=backend/data/db/sparklearn.db
```

- **single_user_id**：当前系统以单用户模式运行，所有数据归属于此用户 ID。后续多用户架构改造时会扩展。
- **use_mock_data**：在没有真实 API 数据或配置不完整时，使用预设的模拟数据填充界面。开发阶段建议设为 `true`。
- **cors_origin / cors_origins**：允许跨域请求的前端地址。本地开发默认允许 `localhost:3000` 和 `127.0.0.1:3000`。
- **data_dir / db_path**：数据目录和 SQLite 数据库文件路径。数据库文件 `sparklearn.db` 由系统在首次启动时自动创建。

### 3.9 Nanobot 联动配置（可选）

当后端启动时可以自动拉起本机 Nanobot 服务，无需手动管理。

```
# ─── Nanobot 宠物联动 ───
NANOBOT_PET_ENABLED=true
NANOBOT_AUTO_START=true
NANOBOT_API_BASE_URL=http://127.0.0.1:8900
NANOBOT_PROJECT_DIR=D:\Project_building\SparkLearn\nanobot-main
NANOBOT_PYTHON_EXE=D:\Project_building\SparkLearn\.venv-nanobot\Scripts\python.exe
NANOBOT_CONFIG_PATH=D:\Project_building\SparkLearn\nanobot-main\.nanobot\config.json
NANOBOT_WORKSPACE=D:\Project_building\SparkLearn\nanobot-main\.workspace
```

- **NANOBOT_PET_ENABLED**：是否启用学习宠物由 Nanobot 驱动。设为 `true` 后，Agent 宠物任务将通过 Nanobot 执行（而非内置 LLM 回退）；设为 `false` 则使用内置模式。
- **NANOBOT_AUTO_START**：后端启动时是否自动拉起 Nanobot 进程。启动前会检查 8900 端口是否已被健康服务占用，避免重复启动。
- **NANOBOT_CONFIG_PATH / NANOBOT_WORKSPACE**：必须指向项目内路径，严禁使用用户目录下的历史配置，避免配置污染。

## 4. 数据库初始化 ✅

SparkLearn 使用 SQLite 作为默认数据库，数据库文件在系统首次启动时自动创建和初始化，无需手动执行 SQL 脚本。

**自动建表机制**：FastAPI 应用在 `startup` 生命周期事件中调用 `init_db()` 函数。该函数首先通过 `_ensure_dirs()` 创建必要的数据目录结构（`backend/data/db/` 和 `backend/data/users/{user_id}/`），然后执行 `CREATE TABLE IF NOT EXISTS` 语句初始化所有数据库表。使用 `IF NOT EXISTS` 语义确保多次启动不会丢失已有数据。

**数据库表结构**：系统自动创建以下核心表：`students`（学生基本信息）、`profiles`（学习画像，含目标、水平、学习偏好等字段，支持版本号 `version` 追踪变更历史）、`mastery_records`（知识点掌握度记录）、`contribution_days`（每日学习贡献/热力图数据）、`tutor_roles`（辅导导师角色定义）、`tutor_conversations`（辅导对话会话）、`tutor_messages`（对话消息，含置信度 `confidence_json` 和引用 `citations_json`）、`tutor_files`（辅导会话中上传的文件）、`knowledge_files`（知识库文件元数据，含索引状态 tags/chunks/references）、`knowledge_chunks`（知识库文本分段与向量数据）、`mcp_services`（MCP 插件服务注册）、`agent_pets`（学习宠物数据，含等级、经验值）、`agent_tasks`（Agent 任务记录）、`agent_task_steps`（任务执行步骤日志）、`agent_messages`（Agent 对话消息）、`quiz_questions`（练习题库）、`quiz_records`（答题记录）、`quiz_wrong_items`（错题本）、`quiz_favorites`（收藏题）、`learning_tasks`（学习任务）、`learning_resources`（学习资源记录）、`forum_posts`（学习社区帖子）、`forum_comments`（帖子评论）、`forum_likes`（点赞记录）、`forum_favorites`（收藏记录）、`forum_attachments`（帖子附件）、`teacher_broadcasts`（教师广播消息）、`teacher_materials`（教师教学资料）、`voice_profiles`（语音/音色配置）、`video_resources`（视频资源生成记录）和 `daily_reports`（每日学习报告）。

**数据目录结构**：默认数据目录为 `backend/data/`，包含以下子路径：`db/sparklearn.db`（SQLite 数据库主文件）、`users/{user_id}/`（用户专属文件存储，如上传的辅导资料、生成的学习资源）、`artifacts/`（生成的资源产物，如视频文件、PPT 文件）、`logs/`（运行日志，包括 `nanobot.stdout.log` 和 `nanobot.stderr.log`）。

**PolarDB PostgreSQL 迁移说明** ✅：当系统需要从单机部署升级到云端/多用户架构时，可将 SQLite 迁移到 PolarDB PostgreSQL（阿里云兼容 PostgreSQL 的云原生数据库）。迁移步骤包括：(1) 在 PolarDB 控制台创建数据库实例，获取连接地址、端口、用户名和密码；(2) 使用 `pgloader` 或自定义迁移脚本将 SQLite 数据导出并导入 PolarDB；(3) 修改 `backend/app/db.py` 中的数据库连接层，将 `sqlite3` 替换为 `asyncpg` 或 `psycopg2`；(4) 更新 `.env` 中新增 `DATABASE_URL=postgresql://user:pass@host:port/dbname` 配置项；(5) 执行 `CREATE TABLE` 对应的 PostgreSQL DDL 语句。注意 SQLite 和 PostgreSQL 在字段类型、自增主键语法（`AUTOINCREMENT` vs `SERIAL`）和 JSON 字段处理上的差异。

## 5. 启动服务 ✅

本章介绍开发环境下启动 SparkLearn 全部服务的完整流程和验证方法。

**启动后端**：打开终端，进入 `D:\Project_building\SparkLearn\backend` 目录，执行 `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`。`--reload` 参数启用热重载，代码修改后自动重启。后端启动时会依次执行：(1) 配置 Windows Proactor 事件循环策略（兼容 Playwright 子进程）；(2) 初始化数据库（建表）；(3) 如果 `.env` 中 `NANOBOT_AUTO_START=true`，自动检查 8900 端口并拉起 Nanobot 进程；(4) 注册所有 API 路由（学习、画像、路径、资源、辅导、练习、报告、Agent、教师、社区、MCP 等 15 个路由模块）。启动成功后会显示 `Uvicorn running on http://127.0.0.1:8000`。

**健康检查**：后端启动后访问 `http://127.0.0.1:8000/health`，返回 `{"ok": true}` 表示服务正常。同时可访问 `http://127.0.0.1:8000/docs` 查看 FastAPI 自动生成的 Swagger API 文档，所有接口均可在页面上直接测试。若 Nanobot 已启动，访问 `http://127.0.0.1:8900/health` 确认 Nanobot 健康状态。

**启动前端**：打开另一个终端，进入 `D:\Project_building\SparkLearn\frontend` 目录，执行 `npm run dev`。Next.js 开发服务器默认监听 `http://localhost:3000`。首次启动会进行编译，约需 10-30 秒。启动成功后终端显示 `Ready in Xs`。在浏览器中访问 `http://localhost:3000` 即可进入 SparkLearn 学生端主应用。

**Nanobot 启动（手动方式）**：如果不使用自动联动，可在第三个终端手动启动 Nanobot：进入 `nanobot-main/` 目录，使用 `.venv-nanobot` 虚拟环境的 Python 执行 `python -m nanobot serve --config .nanobot/config.json --workspace .workspace`。Nanobot 启动后监听 `http://127.0.0.1:8900`，提供 OpenAI-compatible API（`/v1/chat/completions` 等端点）。

**教师大屏**：教师大屏是一个独立的 HTML 页面，通过 Next.js 静态服务访问。地址为 `http://localhost:3000/screen/index.html`。大屏在后端启动时自动拉取真实班级数据（9 名学生，含真实用户和 8 名模拟学生）；后端未启动时自动降级为演示数据，所有图表仍可正常展示。从学生端进入：侧边栏 → 教师工具 → 教师大屏（新标签页打开）。

**验证完整链路**：访问 `http://localhost:3000` 能看到首页仪表盘（学习概览卡片、热力图、今日推荐）→ 点击侧边栏"学习画像"能查看画像信息 → 点击"智能辅导"能创建对话并发送消息收到 AI 回复 → 点击"资源生成"能选择类型并开始生成 → 点击"Agent 宠物"能看到宠物状态 → 以上功能均正常则部署成功。

## 6. 桌面应用部署（Electron） 🔲

SparkLearn 第四阶段计划将整个项目打包为 Windows 桌面应用，通过 Electron 壳统一托管前后端和 Nanobot 服务，实现一键启动。本章为规划中的方案说明。

**Electron 壳工程**：在仓库根目录创建 `desktop/` 工程目录，包含 `main/`（Electron 主进程逻辑）、`preload/`（安全桥接，控制渲染进程对 Node.js API 的访问）、`renderer/`（可选壳内辅助页面，如启动加载页、设置页）、`scripts/`（启动与清理脚本）、`config/`（桌面端配置模板）。Electron 主进程负责进程生命周期管理，渲染进程加载 Next.js 前端页面。

**进程生命周期管理**：Electron 启动后的时序为：(1) 检查 8000/8900 端口占用状态，如遇冲突则显示占用 PID 和处理建议；(2) 以子进程方式启动 Nanobot（`python -m nanobot serve`）；(3) 轮询 `http://127.0.0.1:8900/health` 等待 Nanobot 就绪；(4) 启动 Backend（`uvicorn app.main:app`）；(5) 轮询 `http://127.0.0.1:8000/health` 等待 Backend 就绪；(6) 打开 Electron 窗口加载 `http://localhost:3000`。退出时序：(1) 先停止 Backend 子进程；(2) 再停止 Nanobot 子进程；(3) 写入退出日志并释放所有句柄。异常策略：启动失败弹窗显示具体原因；运行中子进程退出自动重试 1 次，失败后提示用户并给出日志路径。

**Windows 打包流程**：使用 `electron-builder` 将 Electron 壳、前端构建产物和必要运行时打包为 Windows `.exe` 安装包。打包配置包括应用图标、安装路径、注册表项和桌面快捷方式。MVP 阶段先做内部测试渠道分发，后续可发布到应用商店或官网下载。Electron 打包的应用程序预计在双击后 60 秒内完成可用启动，关闭后无残留 `uvicorn/nanobot` 进程。

**安全与边界**：所有服务（Backend:8000、Nanobot:8900）仅监听 `127.0.0.1`，不暴露到公网。Electron 到 Backend 的请求后续将增加本地会话 Token 验证，禁止前端直接暴露敏感模型 key。日志默认对 API key/Token 等敏感字段打码处理。

## 7. 常见问题与排查 ✅

本章汇总部署和运行过程中的常见问题及解决方案，按照排查步骤由浅入深排列。

**端口占用问题**：启动时报错 `[Errno 10013]` 或 `address already in use`，说明 8000（后端）、3000（前端）或 8900（Nanobot）端口已被占用。解决方法：(1) Windows 下在 PowerShell 中执行 `netstat -ano | findstr :8000` 找到占用端口的 PID；(2) 使用 `taskkill /PID <PID> /F` 终止进程；(3) 如果 PID 对应的进程是系统关键进程，可更换端口：后端启动时改 `--port` 参数，前端在 `package.json` 中修改 `next dev -p 3001`，并同步修改 `.env` 中的 `cors_origin` 和 `nanobot_api_base_url`。注意：如果运行过旧版本的后端/Nanobot，务必在重启前清理所有残留进程，否则会导致新进程启动失败或行为异常。

**Nanobot 连接失败**：主要表现为 Agent 宠物任务执行失败或返回"任务超时"。排查步骤：(1) 确认 Nanobot 服务已启动：访问 `http://127.0.0.1:8900/health` 应返回健康状态；(2) 确认 `.env` 中 `NANOBOT_CONFIG_PATH` 指向项目内路径，而非用户目录下的历史配置。实际踩坑中曾因用户目录下 `C:\Users\xxx\.nanobot\config.json` 的残留配置导致 Nanobot 行为与预期不一致；(3) 检查 Nanobot 上游模型 API key 余额是否充足。曾有案例出现 `Sorry, your account balance is insufficient` 错误，这是上游模型账户余额不足，不是 SparkLearn 或 Nanobot 的接入代码问题；(4) 尝试手动启动 Nanobot 并观察控制台输出，确认无报错信息。后端日志中应出现"已切换到学习宠物新内核""正在调用 nanobot 处理任务"字样，表示 Nanobot 联动正常。

**讯飞 API 鉴权失败**：星火大模型连接失败通常表现为无 AI 回复或"鉴权错误"。排查步骤：(1) 确认 `spark_app_id`、`spark_api_key`、`spark_api_secret` 三者在讯飞控制台中属于同一个应用，且应用已开通"星火大模型"服务；(2) 确认 API key/secret 没有被意外修改或泄露（控制台可以重新生成）；(3) 检查网络是否可访问讯飞服务：`ping spark-api.xf-yun.com` 或使用浏览器访问讯飞控制台确认网络畅通；(4) 确认 `spark_model` 指定的模型版本已开通且有可用额度（`lite` 版本有免费额度但有限制，`pro/max` 需预付费）。注意：Embedding、TTS、智文 PPT 各自有独立的 API 凭据，需要分别在讯飞开放平台对应的服务中获取，不能混用。

**Windows 控制台编码问题**：在 Windows 终端中运行后端时，中文日志可能显示为乱码。解决方法：在启动命令前执行 `chcp 65001` 将终端编码切换为 UTF-8。或者在 PowerShell 中运行 `[Console]::OutputEncoding = [Text.Encoding]::UTF8`。建议将 `chcp 65001` 写入项目启动脚本或终端配置文件，避免每次手动切换。

**`.env` 配置遗漏**：如果启动后前端某些功能无响应或报"配置缺失"错误，通常是 `.env` 文件配置不完整。按照本文第 3 章的模板逐项核对：(1) 讯飞星火三件套（app_id/api_key/api_secret）为最核心配置，不填则整个 AI 链路不可用；(2) 星辰Agent开发平台 Bot ID（至少配置 `coze_bot_id_resource_default` 和 `coze_api_token`），不填则资源生成功能不可用；(3) 其他服务按需配置：视频功能需 TTS 和视频 AI 配置，知识库检索需 Embedding 配置，Agent 宠物浏览器搜索需 Playwright 浏览器；(4) 如果是纯本地体验（不看 AI 生成效果），可设置 `use_mock_data=true` 使用内置模拟数据。

**PolarDB PostgreSQL 连接配置** 🔲：当使用 PolarDB PostgreSQL 替代 SQLite 时，常见问题包括：(1) 连接超时：检查安全组/白名单是否放行了部署服务器的出站 IP；(2) SSL 连接问题：PolarDB 默认启用 SSL，连接字符串需添加 `?sslmode=require` 参数；(3) 字符集问题：确保数据库创建时使用 `UTF8` 编码，与项目 UTF-8 规范保持一致；(4) 连接池配置：使用 `asyncpg` 的连接池功能管理数据库连接，避免频繁创建和销毁连接。

**飞书接入配置** 🔲：飞书接入为规划中功能。根据第三阶段的踩坑复盘结论，正确的架构方向是"飞书侧只做账号/授权与配置下发，本机 SparkLearn 进程拉取配置并驱动本机 Nanobot"，而不是"用户在飞书内网页直接连接本机 localhost"。飞书内嵌浏览器的网络上下文与用户本机隔离，`127.0.0.1` 指向的是飞书容器自身而非用户电脑，因此该路径不具备可交付性。
