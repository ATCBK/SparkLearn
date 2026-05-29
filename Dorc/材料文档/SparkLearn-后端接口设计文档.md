# SparkLearn 后端接口设计文档（SDK 接入平台）

> 中文撰写 | UTF-8 编码 | 基于 `develop-deeply-system` 分支（2026-05-29）
>
> 标注规则：✅ 已实现 | 🔲 规划中
>
> 术语约定：文档行文中"星辰Agent开发平台"指代原 Coze 平台，代码中变量名 `coze_*` 保留不变。

---

## 1. 后端架构概述 ✅

### 1.1 FastAPI 应用结构

SparkLearn 后端基于 FastAPI 构建，采用工厂函数模式组织应用创建。核心入口文件 `backend/app/main.py` 中的 `create_app()` 函数负责装配整个 FastAPI 实例：设置应用标题与版本号（通过 `settings.app_name` 和 `settings.app_version` 注入，当前为 `"SparkLearn API"` 和 `"1.0.0"`），注册中间件，绑定启动事件，并按模块挂载全部路由。

应用使用延迟实例化模式，模块顶层执行 `_configure_event_loop_policy()` 后立即调用 `create_app()` 并赋值给模块级变量 `app`。这种方式让 uvicorn 或其他 ASGI 服务器可以直接通过 `backend.app.main:app` 引用就绪的应用实例，同时保持配置与业务逻辑的解耦。所有配置项通过 `backend/app/config.py` 中的 `Settings` 类集中管理，使用 `pydantic_settings.BaseSettings` 自动从 `.env` 文件和环境变量加载，支持 `extra="ignore"` 忽略未定义字段。

### 1.2 CORS 中间件配置

在 `create_app()` 中通过 `app.add_middleware(CORSMiddleware, ...)` 注册跨域中间件。允许的来源列表 `allow_origins` 从配置项 `settings.cors_origins` 读取，当前默认值为 `["http://localhost:3000", "http://127.0.0.1:3000"]`，对应 Next.js 前端的开发服务器地址。`allow_credentials=True` 允许携带凭证信息，`allow_methods=["*"]` 和 `allow_headers=["*"]` 开放所有 HTTP 方法和请求头，满足前后端分离架构的全域调用需求。

### 1.3 路由模块划分

后端当前注册了 14 个独立路由模块（对应 `backend/app/routes/` 目录下的 14 个 `.py` 文件），加上 `main.py` 中的 `/health` 端点，总计覆盖约 80+ 个 API 端点。路由按业务领域垂直拆分：`profile`（画像管理）、`memory`（记忆系统）、`learning`（学习路径与任务）、`knowledge`（知识库 RAG）、`path_planning`（智能路径规划）、`ppt`（PPT 生成）、`resources`（资源生成）、`quiz`（练习评测）、`tutor_eval`（智能辅导与评估）、`video`（视频创作）、`voice_admin`（语音管理）、`agent`（学习宠物）、`teacher`（教师端大屏）、`forum`（学习社区）、`mcp`（MCP 插件管理）。每个模块使用 `APIRouter(prefix=..., tags=...)` 定义独立前缀，通过 `app.include_router()` 挂载。

### 1.4 启动流程

后端启动时执行两个关键初始化步骤。首先，`_configure_event_loop_policy()` 检测运行平台，在 Windows 环境下自动将事件循环策略设置为 `WindowsProactorEventLoopPolicy`，这是因为 Playwright（用于 PDF 导出和浏览器 Agent）的子进程管理依赖 Proactor 事件循环。设置过程使用 try/except 保护，确保兼容性异常不会阻塞启动。

其次，通过 `@app.on_event("startup")` 装饰器注册的 `on_startup()` 协程在应用启动时调用 `backend/app/db.py` 中的 `init_db()` 函数，自动创建所有需要的数据库表结构（SQLite 的 `CREATE TABLE IF NOT EXISTS`）。数据库文件路径由配置项 `settings.db_path` 指定，默认为 `backend/data/db/sparklearn.db`。应用还暴露 `/health` 端点返回 `{"ok": true}` 用于健康检查。

---

## 2. SDK 接入平台

### 2.1 讯飞星火大模型 SDK ✅

SparkLearn 的大模型对话能力全面基于讯飞星火大模型，通过 `backend/app/llm.py` 中的 `SparkLiteAdapter` 类实现接入。该适配器封装了 WebSocket 直连和本地 Bridge 可执行文件两种通信模式，并将最终对话流统一为 `(event_type, payload)` 元组的异步生成器，供上层路由消费。

**认证与连接机制**：`_build_auth_url()` 方法实现了讯飞星火的 HMAC-SHA256 签名认证。核心流程为：解析 WebSocket URL 获取 host 和 path，生成 RFC 1123 格式的 UTC 时间字符串，构造签名原文 `"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"`，使用 `api_secret` 作为密钥进行 HMAC-SHA256 签名，再将签名字节 Base64 编码。最后，将 `api_key`、算法声明和签名组装为 authorization 原文，再次 Base64 编码后与 date、host 一起作为查询参数附加到 WebSocket URL 上。这一机制确保每次连接都是动态签名、无长期凭证暴露。

**Bridge 模式 vs 直连模式**：`stream_chat_events()` 方法的第一个分支检测 `settings.spark_use_bridge` 和 `settings.spark_bridge_exe` 是否存在。Bridge 模式通过 `_stream_events_from_bridge()` 调用 `backend/bridge/bin/spark_bridge.exe` 本地可执行文件 —— 这是一个预编译的 Windows C++ 程序，通过 `asyncio.create_subprocess_exec()` 启动子进程，向其传递 `--app_id`、`--api_key`、`--api_secret`、`--domain`、`--input` 参数，从 stdout 逐行读取 JSON 事件流。每个 JSON 行包含 `type`（text/error/meta/done）和 `payload` 字段。Bridge 模式的优势在于将 SDK 调用与 Python 进程解耦，避免 GIL 阻塞和内存共享问题。

当 Bridge 不可用时，回退到 `_stream_events_from_ws()` 直连模式。该模式首先检测 API 凭证是否完整配置，若缺失则直接返回离线 fallback 文本（以分块方式模拟流式输出），避免接口报错。凭证完整时，通过 `websockets.connect()` 建立 WebSocket 连接，发送符合讯飞星火 V1.1 协议格式的 JSON 请求（包含 header、parameter、payload 三部分），然后循环接收响应帧。响应帧按 `header.code` 判断错误（非 0 即视为云端错误），按 `header.status == 2` 判断流结束，正常时从 `payload.choices.text[0].content` 提取增量文本。若发生 WebSocket 异常或云端错误，上层自动进入错误处理流程，最终以 fallback 文本兜底，确保前端始终有可展示内容。

**流式输出与多领域支持**：上层 `stream_chat()` 方法对 `stream_chat_events()` 做了一层简化封装，仅 yield `text` 类型事件的 `content` 字段值（纯字符串生成器），适合非结构化文本收集场景。`normalize_domain()` 方法将用户传入的 mode 字符串映射为星火 API 支持的 domain 参数，支持 `knowledge_qa`（知识问答）、`step_hint`（步骤提示）、`follow_up`（追问）、`resource`（资源生成）、`general`（通用对话）五种领域，最终统一归一化为 `"lite"` 域。此外，`summarize()` 方法对 `stream_chat()` 做二次封装，将多轮对话摘要为不超过 120 字的精简文本，用于学习报告等场景。

---

### 2.2 星辰Agent开发平台 ✅

资源生成的核心引擎对接了星辰Agent开发平台（原 Coze 平台），通过 `backend/app/coze.py` 中的 `CozeAdapter` 类实现。该适配器负责将 SparkLearn 的资源生成请求路由到星辰平台的不同 Bot，并解析其 SSE 流式响应。

**认证与路由**：星辰平台采用 Bearer Token 认证机制。每次请求在 HTTP Header 中同时携带 `Authorization: Bearer {token}` 和 `token: {token}` 两个字段（后者为兼容性保留），Token 值从 `settings.coze_api_token` 读取。`CozeAdapter.resolve_resource_bot_id()` 方法依据资源类型（`document` / `mindmap` / `quiz` / `reading` / `code`）从配置项中映射到不同的 Bot ID，配置项分别为 `coze_bot_id_resource_document`、`coze_bot_id_resource_mindmap`、`coze_bot_id_resource_quiz`、`coze_bot_id_resource_reading`、`coze_bot_id_resource_code`，若对应类型未配置则回退到 `coze_bot_id_resource_default`。请求体包含 `bot_id`、`user_id`、`stream=True`、`auto_save_history=True` 和嵌套在 `additional_messages` 中的用户 prompt（`content_type: "text"`）。

**SSE 流式解析**：`stream_resource_text()` 方法是核心入口，返回 `(event_type, payload)` 的异步生成器。其内部的 `_iter_sse_frames()` 逐行读取 `httpx.Response` 的 SSE 流，按 `event:` 和 `data:` 行前缀分组，将空行视为帧边界。每个 SSE 帧的 data 文本传入 `_decode_payload()`，该方法先对顶层 JSON 字符串做一次解析，再通过递归的 `_inflate()` 方法解包嵌套 JSON —— 特别是星辰平台常见的 `{"data": "{...嵌套JSON...}"}` 双层包装结构。解包后的对象分别进入 `_extract_error()`（检测业务错误码）、`_extract_links()`（提取文件/网页链接，支持递归遍历和正则匹配，自动去重）和 `_extract_text()`（提取有效的文本内容片段）。

`_extract_text()` 实现了精细的过滤逻辑：排除 `role == "user"` 的消息、`type` 为 `function_call/tool_response/question` 的结构化消息、以及 `msg_type` 以 `finish` 结尾的控制帧；优先从 `content.text` 字段提取，其次尝试 `answer` 和 `text` 字段；对类似控制协议 payload 的文本（以 `{` 开头且包含 `msg_type` 或 `generate_answer_finish` 的字符串）进行过滤。`_to_delta_text()` 利用 `_StreamState` 状态对象维护上一次的完整文本，通过前缀匹配计算增量（delta），有效避免流式输出中的重复拼接，同时处理偶尔的乱序小块。

整体流程遵循"先提取错误、再提取链接、最后提取文本"的顺序，链接通过 `meta` 事件类型向外暴露（供前端预览或下载），文本通过 `text` 事件类型流式输出，所有异常统一捕获后通过 `error` 和 `done` 事件妥善收敛。注意：代码中变量名均使用 `coze_*` 前缀保留，文中统一以"星辰Agent开发平台"指代。

---

### 2.3 讯飞 Embedding SDK ✅

知识库 RAG 的向量化能力由 `backend/app/embeddings.py` 中的 `XfyunEmbeddingClient` 提供，对接讯飞 Embedding HTTP API（`https://emb-cn-huabei-1.xf-yun.com/`）。

**认证机制**：`_build_headers()` 方法实现了与星火大模型类似的 HMAC-SHA256 签名方案，但适用于 HTTP POST 请求。核心流程为：解析 Base URL 获取 host 和 path，生成 RFC 1123 格式 GMT 时间字符串，构造签名原文 `"host: {host}\ndate: {date}\nPOST {path} HTTP/1.1"`，使用 `xfyun_emb_api_secret` 作为密钥进行 HMAC-SHA256 签名并 Base64 编码，再将 api_key、算法声明、签名组装为 authorization 字符串。返回的请求头字典包含 `host`、`date`、`authorization` 和 `content-type: application/json`，供 `httpx.AsyncClient` 发送 POST 请求使用。

**请求结构与向量解码**：`embed()` 方法接收两个参数：`text`（原始文本，截断至 2000 字符）和 `domain`（领域标识，支持 `"para"` 和 `"query"` 两种模式）。文本先被包装为 `{"messages": [{"content": text, "role": "user"}]}` 格式，再 Base64 编码后嵌入请求体的 `payload.messages.text` 字段。请求成功后的响应是一个包含 `payload.feature.text` 字段的 JSON 对象，该字段为 Base64 编码的向量二进制数据。

`_decode_embedding_text()` 方法实现了三重向量解码策略：首先尝试将 Base64 解码后的原始字节按小端序（little-endian）32 位浮点数解包（`struct.unpack(f"<{N}f", raw)`），失败则尝试大端序（big-endian），均失败后尝试将字节按 UTF-8 解码为 JSON 字符串并解析为浮点数数组。这种多级回退策略确保兼容讯飞 Embedding API 可能返回的不同编码格式，提高了系统的鲁棒性。

**应用场景**：该类暴露两个便捷方法 —— `embed_para(text)` 用于段落级嵌入（文档索引时的 chunk 向量化）和 `embed_query(text)` 用于查询级嵌入（用户检索时的查询向量化），分别对应 `domain="para"` 和 `domain="query"`。在知识库模块 `backend/app/routes/knowledge.py` 中，`embed_para` 用于文件索引时的 chunk embedding 并存入 SQLite 的 `knowledge_chunks` 表，`embed_query` 用于检索时计算查询向量并与已有 chunk 做余弦相似度匹配，返回最相关的知识片段作为 Tutor 对话的上下文注入。

---

### 2.4 讯飞 TTS SDK ✅ + 🔲 Bug

语音合成能力对接讯飞 TTS WebSocket API，实现在 `backend/app/routes/voice_admin.py` 中。TTS 服务配置项以 `xf_tts_*` 前缀定义在 `backend/app/config.py` 中，主要包括 `xf_tts_app_id`、`xf_tts_api_key`、`xf_tts_api_secret`、`xf_tts_base_url`（默认 `wss://tts-api.xfyun.cn/v2/tts`）和 `xf_tts_default_voice`（默认 `"xiaoyan"`）。

**认证与合成流程**：`_build_auth_url()` 函数使用与星火大模型相同的 HMAC-SHA256 + Base64 双编码签名方案生成带认证参数的 WebSocket URL。`_synthesize()` 函数实现了完整的语音合成管线：先将长文本按 `xf_tts_text_limit`（默认 1000 字符）分段，对每段文本 Base64 编码后构造 JSON 请求体，包含 `common.app_id`、`business`（音频编码参数 `aue="raw"`、`auf="audio/L16;rate=16000"`、发音人 `vcn`、语速/音量/音高）和 `data`（status=2 表示最后一帧、text 为 Base64 编码的文本内容），通过 WebSocket 发送并循环接收响应。每帧响应中的 `data.audio` 字段为 Base64 编码的 PCM 音频数据，累积后通过 `_pcm_to_wav()` 将 16kHz 单声道 16-bit PCM 转换为标准 WAV 格式（添加 44 字节文件头）返回。

**多音色支持与已知 Bug**：接口通过 `/api/voice/tts` 接受 `TTSReq` 请求体，包含 `text`（待合成文本）、`voice`（发音人标识）、`speed`/`volume`/`pitch`（合成参数）字段。默认发音人为 `xiaoyan`（即 `settings.xf_tts_default_voice`）。响应以 `audio/wav` MIME 类型直接返回二进制音频数据，并通过 `X-TTS-Provider` 和 `X-TTS-Voice` 响应头标记供应商和音色。🔲 当前存在一个已知 Bug：`voice` 参数虽然从前端传入并在合成时赋值给 `business.vcn`，但在特定音色（非默认值）场景下，参数传递逻辑存在问题，导致实际使用的发音人与用户选择不一致。该问题涉及参数验证边界和默认值覆盖逻辑，有待进一步排查和修复。

---

### 2.5 讯飞智文 PPT SDK ✅

PPT 生成能力对接讯飞智文 HTTP API，由 `backend/app/xfyun_ppt.py` 中的 `XfyunPptClient` 类实现。配置项以 `xfyun_zw_*` 前缀定义，包括 `xfyun_zw_base_url`（默认 `https://zwapi.xfyun.cn`）、`xfyun_zw_app_id`、`xfyun_zw_api_secret`、`xfyun_zw_ppt_author`（作者名称，默认 `"SparkLearn"`）和 `xfyun_zw_timeout_sec`（超时时间，默认 240 秒）。

**认证机制**：与 WebSocket 签名不同，讯飞智文使用基于时间戳的 MD5+SHA1 签名方案。`_headers()` 方法生成当前 Unix 时间戳 `ts`，计算 `MD5(appId + ts)` 得到签名原文，再以 `api_secret` 为密钥对签名原文做 HMAC-SHA1 签名并 Base64 编码，最终返回 `{"appId": ..., "timestamp": ..., "signature": ...}` 的请求头字典。

**异步生成流程**：`create_ppt()` 方法向 `/api/ppt/v2/create` 发送 POST 请求，携带 `query`（PPT 主题）、`language`、`search`、`isFigure`、`aiImage`、`author` 等参数。返回结果中的 `sid` 用于后续的进度轮询。`wait_progress()` 方法通过 GET `/api/ppt/v2/progress?sid=xxx` 每隔 3 秒轮询一次生成进度，直到 `pptStatus == "done"` 且 `pptUrl` 非空时返回最终数据（包含 PPT 文件 URL、总页数 `totalPages`、已完成页数 `donePages`）；若状态为 `"build_failed"/"failed"` 则抛出异常；超时则抛出 `XfyunPptError`。生成的 PPT 以 URL 形式返回前端，通过 Microsoft Office Online 的嵌入预览渲染，同时记录在用户的资源索引中。

**主题与模板配置**：PPT 生成支持 `tech-blue` 等预设主题风格，通过 Spark Lite 大模型作为 Schema 生成器（`backend/app/routes/ppt.py`），将用户输入的主题和大纲转化为结构化的幻灯片 JSON Schema（包含 cover/bullets/process/summary 四种布局），再通过前端 HTML 幻灯片渲染引擎呈现。

---

### 2.6 讯飞图片生成 SDK ✅（多模态对话）

图片生成能力对接讯飞星火 TTI（Text-to-Image）API，由 `backend/app/xfyun_tti.py` 中的 `generate_image_base64()` 函数实现。该接口使用与星火大模型相同的 `spark_app_id`、`spark_api_key`、`spark_api_secret` 凭证（无需独立申请）。

**接口对接**：`generate_image_base64()` 函数向 `https://spark-api.cn-huabei-1.xf-yun.com/v2.1/tti` 发送 HTTP POST 请求。认证流程与 WebSocket 模式相似但略有不同 —— `_build_auth_headers()` 函数生成 HMAC-SHA256 签名后以查询参数形式附加到 URL 上。请求体包含 `header.app_id`、`parameter.chat.domain`（固定为 `"general"`）、`parameter.chat.width` 和 `height`（默认 512x512），以及 `payload.message.text` 中的用户 prompt（截断至 1000 字符）。响应中 `payload.choices.text[0].content` 即为 Base64 编码的 PNG 图片数据。

**集成到 Tutor 对话流**：图片生成功能直接集成在智能辅导对话流中（`backend/app/routes/tutor_eval.py` 的 `tutor_chat` 端点）。当 `mode == "image_gen"` 时，系统跳过常规的防幻觉控制流程，直接调用 `generate_image_base64()` 生成图片，并将返回的 Base64 字符串嵌入 Markdown 图片语法 `![AI生成图](data:image/png;base64,...)`，通过 SSE `text` 事件流式输出给前端渲染。这种集成方式使得用户可以在 Tutor 对话中直接请求生成图片（如"生成一幅展示 Python 递归调用栈的示意图"），实现了文生图与对话流的一体化体验。

---

### 2.7 Nanobot 本机 Agent ✅

学习宠物（Learning Companion Agent）的智能体执行引擎基于 Nanobot 本机部署的 Agent 内核，运行在 `localhost:8900` 端口，提供 OpenAI-compatible API 接口。

**Agent 角色系统**：学习宠物支持 8 种虚拟形象（fox、owl、robot、cat、dragon、penguin、bunny、panda）和 3 种性格模式（concise、verbose、encouraging），每种性格对应不同的系统提示词模板。宠物具有等级系统（5 级，通过累积 XP 升级），解锁不同能力：Lv.1 仅有搜索能力，Lv.2 解锁摘要，Lv.3 解锁对比，Lv.4+ 解锁推荐和每日推荐。任务类型包括 `search`（浏览器搜索学习资源）、`summarize`（URL 内容摘要）、`compare`（多源对比分析）和 `recommend`（学习资源推荐）。

**任务执行架构**：宠物任务通过 FastAPI 的 `BackgroundTasks` 异步执行（`backend/app/routes/agent.py` 中的 `_execute_task()` 函数）。执行流程分为两个路径：对于 `search`、`summarize`、`compare` 三种类型，优先使用 Playwright 驱动浏览器实际访问网页获取内容（`backend/app/browser_agent.py` 中的 `_get_agent()`），失败或超时后自动降级为 Spark Lite 大模型离线生成（如 `_do_search_llm_fallback()`）。任务执行过程中的每个步骤通过 `agent_task_steps` 表记录。对于 `recommend` 类型，直接通过大模型根据学习画像生成推荐内容。

**宠物与学习闭环**：学习宠物不仅执行独立任务，还通过 `/api/agent/recommendations` 接口根据用户当前学习阶段和薄弱点生成每日推荐资源，通过 `/api/agent/bookmark` 将搜索结果一键收藏到知识库，通过 `submit_feedback` 收集用户对任务结果的满意度反馈。这种设计将宠物从独立的对话玩具升级为融入学习闭环的"AI 学习伙伴"。

---

## 3. API 路由总表

### 3.1 画像管理 — `/api/profile` ✅

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/api/profile/onboarding` | 兴趣选择式首次画像建档 | ✅ |
| POST | `/api/profile/initiate` | 对话式画像采集——发起会话 | ✅ |
| POST | `/api/profile/chat` | 对话式画像采集——SSE 流式多轮对话 | ✅ |
| GET | `/api/profile` | 获取当前用户结构化画像 | ✅ |
| PUT | `/api/profile` | 更新画像字段（知识水平/薄弱点/偏好等） | ✅ |

画像模块实现了"双写"机制：每次画像变更同时写入 SQLite 的 `profiles` 表和 JSON 快照文件（`profile_snapshot.json`），并通过 `append_jsonl` 追加事件日志到 `learning_events.jsonl`。对话式画像采集最多 3 轮对话后自动结构化落库并关闭会话。

### 3.2 记忆系统 — `/api/memory` ✅（已重写）

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/memory` | 加载完整用户记忆 | ✅ |
| GET | `/api/memory/profile/{user_id}` | 获取语义记忆（目标/偏好/约束等） | ✅ |
| POST | `/api/memory/add` | 添加记忆条目（支持类型/标签/重要性/置信度） | ✅ |
| POST | `/api/memory/search` | 语义搜索记忆 | ✅ |
| POST | `/api/memory/inject-context` | 根据当前问题注入记忆上下文 | ✅ |
| POST | `/api/memory/consolidate` | 记忆整合（合并同义/去重） | ✅ |
| POST | `/api/memory/forget` | 记忆遗忘（按时间/重要性清除） | ✅ |
| PUT | `/api/memory/profile` | 更新语义记忆片段 | ✅ |

记忆系统是第三阶段重构的核心模块（`backend/app/memory_engine.py`），实现了短期（working memory）与长期（episodic/semantic）双层记忆架构，支持标签化存储、语义搜索、自动遗忘和上下文注入。每次 Tutor 对话后通过 `update_memory_from_turn()` 自动更新记忆。

### 3.3 学习路径 — `/api` ✅ + 🔲

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/learning-path` | 获取知识图谱（节点+边+阶段+知识树） | ✅ |
| POST | `/api/learning-path/node-advice` | 节点级个性化学习建议（AI 生成） | ✅ |
| POST | `/api/learning-path/adjust` | 手动调整学习路径/当前阶段 | ✅ |
| GET | `/api/tasks/today` | 获取今日学习任务 | ✅ |
| POST | `/api/tasks` | 创建学习任务 | ✅ |
| PUT | `/api/tasks/{task_id}/complete` | 完成任务并更新贡献日历 | ✅ |
| DELETE | `/api/tasks/{task_id}` | 删除任务 | ✅ |
| GET | `/api/contribution` | GitHub 风格贡献热力图数据 | ✅ |
| GET | `/api/mastery` | 知识点掌握度列表 | ✅ |
| GET | `/api/dashboard/stats` | 仪表盘聚合统计 | ✅ |
| GET | `/api/daily-quote` | 每日格言 | ✅ |
| GET | `/api/videos` | 视频列表（模拟数据） | ✅ |
| POST | `/api/path-planning/generate` | AI 智能路径规划（三阶段+节点+建议） | ✅ |
| GET | `/api/path-planning/history` | 路径规划历史 | ✅ |
| POST | `/api/path-planning/node-suggestions` | 路径节点建议+资源推荐 | ✅ |
| GET | `/api/path-planning/{path_id}` | 特定路径规划详情 | ✅ |
| 🔲 | 🔲 | 知识图谱与真实学期数据关联 | 🔲 |

知识图谱内置了 21 个 Python 知识点节点（5 个阶段：基础语法/函数与模块/面向对象/文件处理/高级特性），节点掌握度从 `mastery_records` 表读取，状态按阈值划分（0% 待学习、1%-79% 学习中、80%+ 已掌握）。`path_planning` 模块使用 Spark Lite 大模型生成三阶段路径（补弱/达标/目标），每阶段 4 个可执行节点。

### 3.4 资源生成 — `/api/resources` ✅

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/resources` | 资源列表（含视频资源合并） | ✅ |
| POST | `/api/resources/generate` | SSE 流式生成资源（document/mindmap/quiz/reading/code/blog/ppt） | ✅ |
| GET | `/api/resources/{resource_id}` | 资源详情 | ✅ |
| GET | `/api/resources/{resource_id}/preview` | 资源预览链接 | ✅ |
| GET | `/api/resources/{resource_id}/preview/html` | 资源预览 HTML 页面 | ✅ |
| GET | `/api/resources/{resource_id}/download` | PDF 下载 | ✅ |
| GET | `/api/resources/{resource_id}/download/html` | HTML 源文件下载 | ✅ |
| GET | `/api/resources/{resource_id}/download/pdf` | PDF 下载（显式指定） | ✅ |
| GET | `/api/resources/{resource_id}/download/source` | 资源源文件下载 | ✅ |
| DELETE | `/api/resources/{resource_id}` | 删除资源 | ✅ |
| GET | `/api/resources/recommendations/list` | 资源智能推荐 | ✅ |

资源生成包含三种生成管线：`document/mindmap/quiz/reading/code` 类型通过星辰Agent开发平台 Bot 流式生成（`coze_adapter.stream_resource_text()`）；`blog` 播客类型通过 Spark Lite 大模型直接生成口语化脚本；`ppt` 类型通过讯飞智文 API 生成。生成结果持久化到 `resources_index.json`。

### 3.5 PPT — `/api/ppt` ✅

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/api/ppt/generate-schema` | AI 生成 PPT 结构化大纲（JSON Schema） | ✅ |

PPT Schema 生成由 Spark Lite 大模型驱动，输出标准化 JSON（包含 deck_id、theme、slides 数组），每张幻灯片包含 layout（cover/bullets/process/summary）、title、对应内容的 bullets/nodes/summary_points 和旁白 narration。前端渲染引擎据此生成 HTML 幻灯片播放器。

### 3.6 视频 — `/api/video` ✅（Bug 已修复）

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/api/video/polish` | 视频脚本润色 | ✅ |
| POST | `/api/video/jobs` | 创建视频生成任务 | ✅ |
| GET | `/api/video/jobs/{job_id}/events` | SSE 视频任务进度事件流 | ✅ |
| GET | `/api/video/resources` | 视频资源列表 | ✅ |
| GET | `/api/video/resources/{resource_id}` | 视频资源详情+时间轴 | ✅ |
| GET | `/api/video/resources/{resource_id}/timeline` | 视频时间轴（分段数据） | ✅ |
| GET | `/api/video/resources/{resource_id}/scene` | HTML 教学场景预览 | ✅ |
| GET | `/api/video/resources/{resource_id}/download/audio` | 下载旁白音频 WAV | ✅ |
| GET | `/api/video/resources/{resource_id}/download/srt` | 下载字幕 SRT 文件 | ✅ |
| GET | `/api/video/resources/{resource_id}/download/mp4` | 下载合成 MP4 视频 | ✅ |
| POST | `/api/video/resources/{resource_id}/share` | 创建视频分享链接 | ✅ |
| DELETE | `/api/video/resources/{resource_id}` | 删除视频资源 | ✅ |

视频生成管线支持 HTML PPT 渲染为教学视频，包含脚本润色、分镜生成、TTS 语音合成、字幕生成和 FFmpeg 合成四个阶段，通过 SSE 实时推送进度。

### 3.7 练习评测 — `/api/quiz` ✅

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/quiz` | 获取练习题（支持章节/数量/LLM生成模式） | ✅ |
| POST | `/api/quiz/submit` | 提交答案并判题（规则+LLM辅助双模） | ✅ |
| GET | `/api/quiz/records` | 所有答题记录 | ✅ |
| GET | `/api/quiz/records/stats` | 答题统计（总数/正确数/正确率） | ✅ |
| DELETE | `/api/quiz/records/{quiz_id}` | 删除特定答题记录 | ✅ |
| GET | `/api/quiz/wrong` | 错题本（按题分组+变式题） | ✅ |
| DELETE | `/api/quiz/wrong/{quiz_id}` | 删除错题 | ✅ |
| GET | `/api/quiz/favorites` | 收藏题目列表 | ✅ |
| POST | `/api/quiz/favorites` | 收藏/取消收藏题目 | ✅ |

评测模块内置了 80 道 Python 预设题库（单选 25 题/多选 15 题/填空 10 题/字符串处理 10 题/异常处理 10 题/文件操作 10 题），支持按章节筛选和数量控制。判题采用两阶段策略：先由 `_is_correct_rule()` 进行精确规则匹配（多选集合相等、填空去除空格大小写、单选不区分大小写），规则判题失败时对填空题启用 LLM 辅助判题（包含同义词/近似表达识别），最终结果更新掌握度（正确 +0.05，错误 -0.03）。

### 3.8 智能辅导 — `/api` ✅（含多模态+防幻觉）

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/tutor/roles` | 导师角色列表 | ✅ |
| POST | `/api/tutor/roles` | 创建自定义导师角色 | ✅ |
| PUT | `/api/tutor/roles/{role_id}` | 更新导师角色 | ✅ |
| DELETE | `/api/tutor/roles/{role_id}` | 删除导师角色 | ✅ |
| POST | `/api/tutor/roles/optimize-prompt` | AI 一键优化角色提示词 | ✅ |
| GET | `/api/tutor/conversations` | 对话列表 | ✅ |
| POST | `/api/tutor/conversations` | 创建新对话 | ✅ |
| PUT | `/api/tutor/conversations/{conversation_id}` | 更新对话设置 | ✅ |
| DELETE | `/api/tutor/conversations/{conversation_id}` | 删除对话 | ✅ |
| GET | `/api/tutor/messages` | 对话历史消息 | ✅ |
| DELETE | `/api/tutor/messages/{message_id}` | 删除消息 | ✅ |
| POST | `/api/tutor/files` | 上传辅导文件（PDF/TXT/MD） | ✅ |
| GET | `/api/tutor/files` | 上传文件列表 | ✅ |
| DELETE | `/api/tutor/files/{file_id}` | 删除上传文件 | ✅ |
| POST | `/api/tutor/chat` | SSE 流式辅导对话（核心） | ✅ |
| GET | `/api/tutor/history` | 对话历史（含置信度/引用） | ✅ |
| GET | `/api/evaluation/report` | 学习评估报告 | ✅ |
| POST | `/api/evaluation/refresh` | 刷新评估 | ✅ |
| POST | `/api/report/ai-summary` | AI 生成学习报告摘要（SSE） | ✅ |

Tutor 模块是 SparkLearn 最核心的功能模块。`POST /api/tutor/chat` 支持三种对话模式：
- **常规模式**（防幻觉控制）：通过 `TrustAnswerController` (`backend/app/trust_answer_controller.py`) 对用户问题做可信度评估，计算置信度分数和级别，构建包含记忆上下文、页面上下文、角色提示词的多层 prompt，通过 Spark Lite 流式输出，同时返回 confidence/citations/trust_meta/MCP 调用信息。
- **文生图模式**（`mode="image_gen"`）：直接调用讯飞 TTI API 生成图片。
- **研讨会模式**（`workshop_enabled=True`）：模拟 4 个 AI Agent（提问优化师/学科导师/质疑者/行动教练）多轮辩论，最终由 FinalAnswerAgent 综合各轮观点产出最终答案。
- **开放模式**（`open_mode=True`）：绕过防幻觉控制器，直接将用户问题和文件上下文发送给大模型。

### 3.9 Agent 宠物 — `/api/agent` ✅

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/api/agent/pet` | 认养学习宠物 | ✅ |
| GET | `/api/agent/pet` | 获取宠物信息（等级/经验/能力） | ✅ |
| PATCH | `/api/agent/pet` | 更新宠物设定（性格/名称） | ✅ |
| POST | `/api/agent/task` | 创建宠物任务（搜索/摘要/对比/推荐） | ✅ |
| GET | `/api/agent/task/{task_id}` | 任务详情+执行步骤 | ✅ |
| GET | `/api/agent/tasks` | 任务列表（分页） | ✅ |
| POST | `/api/agent/task/{task_id}/feedback` | 任务反馈（有用/无用） | ✅ |
| POST | `/api/agent/bookmark` | 搜索结果一键收藏到知识库 | ✅ |
| GET | `/api/agent/recommendations` | 每日学习推荐 | ✅ |

### 3.10 知识库 RAG — `/api/knowledge` ✅

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/knowledge/files` | 知识文件列表（支持状态/搜索过滤） | ✅ |
| POST | `/api/knowledge/files` | 上传知识文件（支持批量） | ✅ |
| PUT | `/api/knowledge/files/{file_id}/index` | 执行文件索引（chunk+embedding） | ✅ |
| GET | `/api/knowledge/files/{file_id}` | 文件详情 | ✅ |
| DELETE | `/api/knowledge/files/{file_id}` | 删除文件及关联 chunks | ✅ |
| GET | `/api/knowledge/stats` | 知识库统计 | ✅ |
| GET | `/api/knowledge/chunks` | 文件切分片段列表 | ✅ |

知识库模块支持 PDF（通过 PyMuPDF/fitz）、TXT 和 Markdown 三种格式。文件上传后处于 `pending` 状态，调用 `/index` 接口后触发异步索引流程：文本提取 → 结构化分段（按段落+句子边界，max 700 字符，120 字符重叠）→ 调用讯飞 Embedding API 向量化 → 存入 `knowledge_chunks` 表 → AI 摘要+标签提取 → 状态更新为 `indexed`。检索时通过 `retrieve_knowledge_context_async()` 函数计算用户查询的 query embedding 并与所有 indexed chunks 做余弦相似度匹配，返回 Top-K 相关片段。

### 3.11 MCP 管理 — `/api/mcp` ✅

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/mcp/services` | MCP 服务列表（可按 all/system/user 过滤） | ✅ |
| POST | `/api/mcp/services` | 创建 MCP 服务 | ✅ |
| PUT | `/api/mcp/services/{service_id}` | 更新 MCP 服务 | ✅ |
| DELETE | `/api/mcp/services/{service_id}` | 删除 MCP 服务 | ✅ |
| POST | `/api/mcp/services/{service_id}/test` | 测试 MCP 服务连接 | ✅ |
| POST | `/api/mcp/services/{service_id}/toggle` | 启用/禁用服务 | ✅ |
| GET | `/api/mcp/services/{service_id}/tools` | 获取服务提供的工具列表 | ✅ |
| POST | `/api/mcp/services/{service_id}/call` | 调用 MCP 工具 | ✅ |

MCP 模块基于 JSON-RPC 2.0 协议实现，当前仅支持 `stdio` 传输模式。`_McpStdioClient` 类实现了完整的 MCP 客户端协议：通过 `asyncio.create_subprocess_exec()` 启动子进程，使用 Content-Length 帧协议（`Content-Length: N\r\n\r\n` + body）进行通信，支持 initialize 握手、tools/list 查询和 tools/call 调用。MCP 服务在 Tutor 对话的防幻觉控制流程中被引用，通过 TrustAnswerController 判断是否需要调用 MCP 工具来增强回答的可信度。

### 3.12 教师端 — `/api/teacher` ✅

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/teacher/dashboard` | 大屏聚合数据（班级总览/阶段分布/知识点掌握/风险学生/活跃趋势） | ✅ |
| GET | `/api/teacher/students` | 学生列表（含模拟 19 人班级） | ✅ |
| GET | `/api/teacher/students/{student_id}` | 学生详情 | ✅ |
| POST | `/api/teacher/ai/diagnose` | AI 单生诊断建议 | ✅ |
| POST | `/api/teacher/ai/daily-report` | AI 班级日报 | ✅ |
| GET | `/api/teacher/broadcast/recipients` | 广播接收人列表 | ✅ |
| POST | `/api/teacher/broadcast/materials` | 上传广播资料 | ✅ |
| GET | `/api/teacher/broadcast/materials` | 广播资料列表 | ✅ |
| GET | `/api/teacher/broadcast/materials/{file_id}/download` | 下载广播资料 | ✅ |
| POST | `/api/teacher/broadcasts` | 创建班级广播 | ✅ |
| GET | `/api/teacher/broadcasts` | 广播列表 | ✅ |

### 3.13 学习社区 — `/api/forum` ✅

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/forum/posts` | 帖子列表（支持 latest/hot/recommended 排序+搜索+标签筛选） | ✅ |
| POST | `/api/forum/posts` | 发布帖子 | ✅ |
| GET | `/api/forum/posts/{post_id}` | 帖子详情（自动增加浏览数） | ✅ |
| DELETE | `/api/forum/posts/{post_id}` | 删除帖子（软删除） | ✅ |
| GET | `/api/forum/posts/{post_id}/comments` | 帖子评论列表 | ✅ |
| POST | `/api/forum/posts/{post_id}/comments` | 发表评论 | ✅ |
| DELETE | `/api/forum/comments/{comment_id}` | 删除评论 | ✅ |
| POST | `/api/forum/posts/{post_id}/like` | 点赞/取消点赞 | ✅ |
| POST | `/api/forum/posts/{post_id}/favorite` | 收藏/取消收藏 | ✅ |
| POST | `/api/forum/posts/{post_id}/attachments` | 上传附件 | ✅ |
| GET | `/api/forum/posts/{post_id}/attachments` | 附件列表 | ✅ |
| GET | `/api/forum/attachments/{attachment_id}/download` | 下载附件 | ✅ |
| GET | `/api/forum/my/posts` | 我的帖子 | ✅ |
| GET | `/api/forum/my/favorites` | 我的收藏 | ✅ |
| GET | `/api/forum/my/likes` | 我的点赞 | ✅ |
| GET | `/api/forum/my/comments` | 我的评论 | ✅ |
| GET | `/api/forum/my/history` | 浏览历史 | ✅ |

### 3.14 语音管理 — `/api` ✅

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/api/voice/asr` | 语音识别（占位，返回固定结果） | ✅ |
| POST | `/api/voice/tts` | 文本转语音（讯飞 TTS WebSocket） | ✅ |
| GET | `/api/voice/tts/status` | TTS 服务状态查询 | ✅ |
| GET | `/api/admin/students` | 管理端学生列表（简化版） | ✅ |
| GET | `/api/admin/resources` | 管理端资源列表 | ✅ |
| GET | `/api/admin/dashboard` | 管理端仪表盘 | ✅ |

### 3.15 规划中模块 🔲

| 路由前缀 | 功能 | 状态 |
|----------|------|------|
| `/api/admin` | 完整管理后台（用户管理/系统配置/数据统计） | 🔲 |
| `/api/auth` | SMS 短信验证码登录 | 🔲 |
| `/api/external` | 外部系统对接接口（OSS 对象存储/资料分发/第三方平台回调） | 🔲 |

---

## 4. SSE 事件格式规范

### 4.1 统一 SSE 包装

所有流式接口使用 `backend/app/routes/common.py` 中的统一包装函数。`sse_event(event_type, payload)` 将事件类型和负载字典序列化为标准 SSE 格式 `"data: {json}\n\n"`（`ensure_ascii=False` 保证中文不转义）。`sse_wrap(generator)` 是一个异步生成器包装器，接收 `AsyncGenerator[tuple[str, dict], None]` 并将其逐项转换为 SSE 事件字符串，供 `StreamingResponse` 以 `text/event-stream` 媒体类型输出。

### 4.2 标准事件类型

| 事件类型 | 含义 | 使用场景 |
|----------|------|----------|
| `text` | 增量文本片段 | Spark Lite / 星辰Agent开发平台 流式对话的主体内容输出 |
| `progress` | 阶段进度 | 资源生成（started/creating/building/generating/done）、视频创作（scripting/video_rendering/tts_synthesizing/muxing） |
| `meta` | 结构化元信息 | 星辰Agent开发平台返回的文件链接/URL、Tutor 对话模式信息 |
| `confidence` | 可信度信息 | Tutor 防幻觉控制器的置信度分数/级别/原因码 |
| `citations` | 引用来源 | Tutor 回答中引用的知识库文件、MCP 来源 |
| `trust_meta` | 信任元数据 | Tutor 可信度评估的完整元信息（含 MCP 调用清单） |
| `workshop_meta` | 研讨会元数据 | Tutor 研讨会模式的轮次/参与者信息 |
| `workshop_phase` | 研讨会阶段 | profile_analysis/discussion/synthesis 各阶段的状态 |
| `hub` | 研讨会中枢消息 | 各 Agent 在讨论中的发言内容 |
| `mcp_call` | MCP 工具调用 | Tutor 对话中触发的 MCP 服务/工具名称 |
| `sources` | 资料来源 | Tutor 对话中上传文件检索到的相关片段 |
| `done` | 流结束 | 所有流式接口的结束标识，payload 中包含最终结果摘要 |
| `error` | 错误 | 流式中断或调用失败的错误信息 |

### 4.3 前端解析约定

前端使用 `EventSource` 或 `fetch` + `ReadableStream` 接收 SSE 流，按 `data:` 行前缀提取 JSON，根据 `type` 字段分发到不同处理逻辑：
- `text` 事件累积拼接为对话文本
- `progress` 事件更新进度条/状态指示器
- `meta` 事件中的 `links` 数组用于预览卡片渲染
- `done` 事件触发消息落库确认和 UI 稳定状态
- `error` 事件展示错误提示（Toast/内联错误消息）
- `confidence`/`citations`/`trust_meta` 事件用于防幻觉展示层的标记和引用标注

---

## 5. 数据存储

### 5.1 SQLite 表结构 ✅（当前）

当前产品环境使用 SQLite 作为主数据库（文件位置 `backend/data/db/sparklearn.db`），由 `backend/app/db.py` 中的 `init_db()` 函数在应用启动时自动建表。核心业务表包括：

| 表名 | 用途 |
|------|------|
| `profiles` | 学习者画像（目标/知识水平/薄弱点/学习偏好/认知风格/每日时长/实践能力/当前阶段/版本号） |
| `students` | 学生基本信息（姓名/邮箱/专业/年级） |
| `mastery_records` | 知识点掌握度（分数/章节/更新时间） |
| `contribution_days` | 贡献日历（日期/学习次数计数） |
| `tutor_roles` | 导师角色定义（名称/persona/背景/风格指南/规则） |
| `tutor_conversations` | 对话会话（关联 role_id/标题/消息数） |
| `tutor_messages` | 对话消息（发送者角色/内容/附加文件/元信息 JSON） |
| `tutor_files` | 辅导上传文件（文件名/存储路径/MIME 类型/大小） |
| `tutor_file_chunks` | 辅导文件文本分段（chunk_index/内容/embedding） |
| `knowledge_files` | 知识库文件（状态 pending/processing/indexed/failed/标签/摘要） |
| `knowledge_chunks` | 知识库文本分段（embedding JSON 存储） |
| `mcp_services` | MCP 服务注册信息（传输模式/命令/参数/环境变量/状态） |
| `agent_pets` | 学习宠物（名称/形象/性格/等级/经验） |
| `agent_tasks` | 宠物任务（类型/输入/状态/结果/反馈） |
| `agent_task_steps` | 任务执行步骤记录 |
| `agent_messages` | 宠物对话消息 |
| `forum_posts` | 社区帖子（含点赞数/评论数/收藏数/浏览数） |
| `forum_comments` | 社区评论 |
| `forum_post_likes` | 帖子点赞关系 |
| `forum_post_favorites` | 帖子收藏关系 |
| `forum_attachments` | 帖子附件 |
| `forum_browsing_history` | 浏览历史 |
| `teacher_material_files` | 教师端资料文件 |
| `teacher_broadcasts` | 教师广播消息 |

### 5.2 PolarDB PostgreSQL 适配 ✅（已完成）

系统已完成对阿里云 PolarDB PostgreSQL 的数据库适配。通过统一的 `fetch_one()`、`fetch_all()`、`execute()` 抽象层（`backend/app/db.py`），数据库切换对业务代码透明。PolarDB 适配主要解决了 SQLite 的 `?` 占位符与 PostgreSQL 的 `$1/$2` 占位符差异，以及 `INSERT ... ON CONFLICT` 语法差异。

### 5.3 JSON/JSONL 文件存储 ✅

除了关系型数据库，系统大量使用 JSON 和 JSONL 文件存储用户级别的非结构化数据和事件日志。`backend/app/storage.py` 提供了三个核心工具函数：

- `read_json(user_id, filename, default)` — 从 `data/users/{user_id}/` 目录读取 JSON 文件，使用 `utf-8-sig` 编码处理可能的 BOM 头，文件不存在时返回 default 值
- `write_json(user_id, filename, payload)` — 将 Python 对象以 `ensure_ascii=False` + `indent=2` 格式写入 JSON 文件，中文内容原样保存
- `append_jsonl(user_id, filename, record)` — 向 JSONL 文件追加一行记录，自动附加 `ts`（ISO 时间戳）字段

当前使用文件存储的数据包括：`profile_snapshot.json`（画像快照）、`task_progress.json`（任务进度）、`resources_index.json`（资源索引）、`quiz_records.json`（答题记录）、`latest_quiz_set.json`（最新题目集）、`quiz_favorites.json`（收藏题目）、`path_planning_history.json`（路径规划历史）、`video_jobs.json`（视频任务）、`video_resources.json`（视频资源）、`resource_usage.jsonl`（资源使用日志）、`learning_events.jsonl`（学习行为事件流）、`video_events.jsonl`（视频创作事件流）。

---

## 6. 已知问题与待实现

### 6.1 🔲 TTS 发音人选择 Bug

讯飞 TTS 模块的 `voice` 参数在合成请求中的传递逻辑存在缺陷。虽然 `TTSReq` 请求体包含 `voice` 字段，`_synthesize()` 函数也将其赋值给 `business.vcn`，但在某些特定发音人标识（非默认值 `"xiaoyan"` 的其他音色）场景下，参数可能被默认值覆盖或未正确传递给 WebSocket 请求体。问题根源可能在于参数验证或默认值处理逻辑中的边界条件。需要排查 `voice_admin.py` 中 `_synthesize()` 的 `voice or settings.xf_tts_default_voice` 逻辑和前端传参格式的一致性。

### 6.2 🔲 外部接口（SMS 登录 / OSS 存储 / 资料分发）

当前产品未实现用户认证系统（使用 `single_user_id` 单用户模式运行），缺少 SMS 短信验证码登录接口。未来规划的 `/api/auth` 路由模块需要对接第三方短信服务商（如阿里云短信服务），实现手机号验证码登录、Token 签发（JWT）、Token 刷新和会话管理。同时，文件存储当前使用本地文件系统，后续需要对接 OSS 对象存储服务以实现静态资源的 CDN 加速分发和跨设备访问。资料分发功能需要支持教师端向学生端推送学习资料（PDF/视频/练习）的完整链路。

### 6.3 🔲 知识图谱与真实学期数据关联

当前知识图谱（`_GRAPH_NODES`）为硬编码的 21 个 Python 知识点节点，掌握度数据来自 `mastery_records` 表但知识点之间存在脱节。规划中的改进方向是引入教材/课标数据源，使知识图谱节点与真实课程大纲对齐，并根据学生的实际作答轨迹和资源消费行为动态调整节点掌握度和推荐策略。同时，知识图谱的 edges 关系当前仅表示先修依赖，需要扩展为更丰富的语义关系（如"构成关系""相似关系""互补关系"）以支持更精细的学习路径推荐。

### 6.4 🔲 飞书接入

已完成飞书接入的技术调研和 Nanobot 本机部署的踩坑复盘（参见 `Dorc/第三阶段开发文档/SparkLearn-第三阶段-飞书接入与本机Nanobot部署踩坑复盘-2026-05-27.md`），但尚未在产品代码中落地。飞书接入的主要方向包括：飞书机器人消息通道（通过 Webhook 或 SDK 接收和发送课程通知/学习提醒）、飞书文档作为知识库数据源、飞书审批流程集成（学习任务审批闭环）。

### 6.5 🔲 其他规划功能

- **`/api/admin` 完整管理后台**：当前 `/api/admin/*` 端点为简化占位实现（混合在 `voice_admin.py` 中），仅返回单用户演示数据。需要建立完整的管理后台 API（用户管理 CRUD、系统配置管理、数据统计看板、日志查询）。
- **桌面应用打包**：第四阶段规划的 Desktop 应用（参见 `Dorc/第四阶段开发文档/SparkLearn-第四阶段-桌面应用开发技术方案-2026-05-27.md`），使用 Electron / Tauri 将前端打包为桌面应用，需要后端适配本地文件路径和进程管理。
- **MCP 插件的 HTTP 传输模式**：当前 MCP 客户端仅支持 `stdio` 子进程模式，`http` 传输模式已在数据模型中预留但未实现客户端逻辑。
- **语音识别（ASR）实际对接**：当前 `/api/voice/asr` 端点为占位实现（直接返回固定文本），需要对接讯飞语音识别 API。
