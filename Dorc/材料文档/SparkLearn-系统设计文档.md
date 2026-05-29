# SparkLearn 系统设计文档

> 文档版本：v1.0
> 最后更新：2026-05-29
> 适用范围：SparkLearn 项目全栈（前端 `frontend/` + 后端 `backend/`）

---

## 1. 项目背景与目标

### 1.1 项目背景

当前教育领域的数字化学习工具普遍存在"千人一面"的问题，传统在线教育平台往往只提供固定的课程内容和标准化的练习题库，无法根据学习者的个体差异实现真正的个性化适配。与此同时，大语言模型（LLM）和多智能体技术的快速发展为教育场景带来了全新的可能性——利用 AI 理解学习者的知识水平、学习偏好和薄弱点，自动化地为每位学习者构建个性化的学习路径、生成适配的学科资源、进行智能辅导并持续跟踪学习效果。

SparkLearn 正是在这一背景下诞生的 —— 它是一个**个性化学习多智能体平台**，定位为"AI 驱动的学习操作系统"。平台将"档案构建 → 路径规划 → 资源生成 → 学习互动 → 练习评测 → 反馈报告 → 档案更新"串联为完整的闭环，学习者使用的时间越久，系统对其的理解越精准，提供的学习服务越个性化。

### 1.2 项目目标

SparkLearn 的核心目标可以归纳为三个层面：

**学习体验层面**：为每位学习者建立可演化的学习画像，根据画像自动规划学习路径、生成多模态学习资源（文档、思维导图、PPT、视频、练习题），并通过多智能体辅导系统提供可持续的学业支持。学习者在任何页面都可以通过智能辅导助手提问并获得个性化回答。

**教师赋能层面**：通过教师大屏（数据仪表盘），让教师直观看到全班学生的知识掌握分布、学习进展热力图、薄弱点识别，为教学决策提供数据支持。同时支持设置教学干预策略，批量推送针对性资源。

**技术探索层面**：本项目是一次严肃的"多智能体 + RAG + 记忆系统 + 防幻觉 + MCP 插件"工程化探索。系统采用讯飞星火大模型作为核心 AI 引擎，以星辰Agent开发平台作为资源生成 Bot 的执行中间层，通过 Nanobot 实现本机 Agent 托管，并在架构上为未来扩展（PolarDB 迁移、飞书接入、移动端适配）留有明确扩展路径。

### 1.3 学习闭环路径

SparkLearn 定义的学习闭环包含七个依次循环的阶段：

1. **画像构建**：学习者通过问卷、对话或手动编辑三种方式建立初始学习画像，系统采集学习目标、当前水平、薄弱点、学习偏好、可用学习时间等核心维度，并在此后每次学习行为中微调画像。
2. **路径规划**：基于画像和掌握度数据，由 AI 生成结构化的学习阶段路径（含阶段划分、节点清单、每节点推荐资源），并逐步向知识图谱演化。
3. **资源生成**：根据路径节点自动生成或推荐学习资源，覆盖文档、PPT、视频、练习题、代码案例、拓展阅读六种类型，支持多模态渲染和本地预览。
4. **学习互动**：学习者通过智能辅导系统进行多轮对话，系统在"角色设定 + 页面上下文 + 历史对话 + 画像信号 + 知识库片段"组成的上下文框架下给出可信回答。
5. **练习评测**：系统提供自动判题、错题收集、收藏题管理和掌握度统计，支持按知识模块筛选练习。
6. **反馈报告**：周期性生成学习分析总结，汇总掌握度分布、薄弱点排行、学习趋势，支持 AI 辅助的定性总结。
7. **画像更新**：每次练习判题后更新对应知识点的掌握度，练习行为、资源使用、对话记录作为事件流持续沉淀，驱动画像版本化更新。

---

## 2. 系统总体架构

### 2.1 四层架构概览

SparkLearn 采用清晰的分层架构设计，从上到下依次为：前端层、后端层、AI 引擎层、数据层。各层之间通过明确的协议边界解耦。

**前端层**：基于 Next.js 16 (App Router) 构建，路径位于 `frontend/`。采用 Tailwind CSS 和 lucide-react 图标库，支持服务端渲染和静态生成。前端页面分为两大布局群：学生端（`(shell)` 布局组）和教师端（`(teacher)` 布局组）。学生端提供画像、学习路径、练习评测、资源生成、智能辅导、视频学习、Agent 伙伴、学习社区等功能页面；教师端提供仪表盘、学生管理、班级报告、教学干预、消息广播等管理功能。前端通过与后端 FastAPI 的 REST 接口通信，辅导对话等实时交互通过 SSE（Server-Sent Events）实现流式响应。

**后端层**：基于 FastAPI（Python）构建，路径位于 `backend/`。应用采用工厂模式由 `create_app()` 创建，注册 14 个路由模块（profile、memory、learning、knowledge、path_planning、ppt、resources、quiz、tutor_eval、video、voice_admin、agent、teacher、forum、mcp）。后端通过 CORS 中间件允许前端跨域访问，启动时自动初始化 SQLite 数据库表结构。系统支持 Windows 与跨平台运行，在 Windows 下自动配置 ProactorEventLoop 以兼容 Playwright 子进程。

**AI 引擎层**：以讯飞星火大模型（Spark Lite）为核心，通过 WebSocket 协议进行 HMAC-SHA256 签名的流式对话。资源生成由星辰Agent开发平台（原 Coze 平台重组而来）的多个 Bot 实例承担，通过 HTTP SSE 协议调用。同时集成讯飞 Embedding API 提供文本向量化、讯飞 TTS API 为视频生成提供语音合成、讯飞智文 API 提供 PPT 在线生成能力。此外，通过 Nanobot 本机托管平台为 Agent 伙伴提供 OpenAI-compatible 的 API 服务。

**数据层**：当前以 SQLite 作为核心结构化存储（18 张表），数据库文件位于 `backend/data/db/sparklearn.db`。用户行为数据以 JSON/JSONL 文件形式存储于 `backend/data/users/single_user/` 目录下，包括学习事件流、练习记录、任务进度、资源使用记录等。向量化知识库由讯飞 Embedding API 提供 embedding 生成，chunk 文本与向量分别存储于 SQLite 和 JSON 文件中。数据库迁移路径已预留 PolarDB PostgreSQL（阿里云国产数据库）适配代码。

### 2.2 Agent 部署架构

系统 Agent 的部署方式为 **Nanobot 本机托管**。Nanobot 运行在 `localhost:8900`，提供 OpenAI-compatible API 接口，用于 Agent 伴侣任务执行（如搜索、摘要、对比、推荐）。Nanobot 内部集成了浏览器自动化能力（通过 Playwright），可以执行网页搜索和信息提取，并将结果返回给 SparkLearn。Agent 伴侣支持等级成长机制（L1-L5），每级解锁新的任务能力，通过经验值（XP）驱动升级。

### 2.3 MCP 插件系统

系统实现了完整的 MCP（Model Context Protocol）插件协议支持，位于 `backend/app/routes/mcp.py`。插件商店支持两种传输方式：`stdio`（子进程标准输入输出）和 `http`（HTTP 端点）。每个插件可配置命令、参数、环境变量、启动超时和工具执行超时，运行时动态启停。系统已集成 Browse-use 插件，可将浏览器自动化能力作为一种可配置的外部工具扩展提供给系统。

当前已实现的系统架构状态：✅ 前后端分层架构已完成、✅ FastAPI 14 路由模块已注册、✅ AI 引擎层三通道（讯飞星火/星辰平台/Nanobot）已对接、✅ SQLite + JSONL 混合存储已运行、✅ MCP 插件协议已实现、✅ Agent 本机托管已就绪。

---

## 3. 技术栈选型说明

### 3.1 前端技术栈

**Next.js 16 (App Router)**：选择 Next.js 16 作为前端框架，核心考量包括：(1) App Router 的服务端组件（RSC）机制天然适合需要频繁获取后端数据的教育仪表盘页面，可以减少客户端数据获取的复杂度；(2) 文件系统路由约定使页面组织清晰，`(shell)` 和 `(teacher)` 两个布局组天然隔离学生端和教师端的 UI 风格；(3) 内建 SSE 流式消费能力，适配智能辅导对话的实时响应需求；(4) Tailwind CSS 作为实用优先的 CSS 框架，配合 lucide-react 图标库，可实现高效一致的设计系统。

**状态管理**：前端未引入全局状态库，利用 React 内置的 Context + 页面级状态管理即可满足当前需求。API 调用采用 fetch + SSE 流式读取模式，未使用 React Query 等缓存层，保持架构简洁。页面间通过 URL 参数和 localStorage 传递轻量上下文。

### 3.2 后端技术栈

**FastAPI**：选择 FastAPI 作为后端框架的理由：(1) 原生支持异步（async/await），适配 WebSocket 和流式响应的实时通信场景；(2) Pydantic 模型自动生成 OpenAPI 文档，便于前后端联调和接口管理；(3) 类型注解驱动的开发模式减少运行时错误；(4) 轻量级部署，适合单机开发环境和桌面应用内嵌场景。

**websockets**：用于与讯飞星火大模型的 WebSocket 通信，实现双向流式对话。系统通过 `spark_bridge.exe` 桥接程序（C++ 实现）作为备选通道，在 Python WebSocket 不可用时自动切换，提高了连接的鲁棒性。

**httpx**：用于发起 HTTP 请求（星辰Agent开发平台 API、讯飞 Embedding API、讯飞智文 PPT API 等），支持异步和超时控制。

### 3.3 AI 引擎技术栈

**讯飞星火 Lite（SparkLiteAdapter）**：选择讯飞星火作为核心 AI 引擎，是因为：(1) 星火大模型在教育领域有专门的优化和训练数据，生成内容更具学科适宜性；(2) Lite 版本在响应速度和成本之间取得了良好平衡，适合实时对话场景；(3) 讯飞生态内嵌 TTS、Embedding、智文 PPT 等服务，可减少多供应商的对接成本。`SparkLiteAdapter` 封装了 WebSocket 连接、HMAC-SHA256 签名、流式事件解析、历史窗口管理等功能，调用方只需传入 `prompt + history` 即可获得流式文本输出。

**讯飞 Embedding**：用于知识库文本的向量化，将知识文档的 chunk 转换为高维向量存储，支持后续的相似度检索。`XfyunEmbeddingClient` 封装了 HTTP 签名和向量解码（Base64 + 二进制解析）逻辑。

**讯飞 TTS**：用于视频资源的语音合成，默认发音人为 `xiaoyan`，通过 WebSocket 连接推送文本分段流，接收 PCM 音频数据。当前已知问题：发音人选择参数存在 bug，导致无法切换音色（🔲 待修复）。

**讯飞智文 PPT**：用于 AI 驱动的 PPT 在线生成。`xfyun_ppt_client` 通过 HTTP API 发起创建请求、轮询进度直到 PPT 生成完成，返回可分享的在线 PPT 链接。

### 3.4 平台与中间层

**星辰Agent开发平台**：本项目使用星辰Agent开发平台（原 Coze 平台重组而来）作为资源生成的 Bot 执行中间层。平台托管多个 Bot 实例，分别对应文档、思维导图、练习题、拓展阅读、代码案例五种资源类型的生成。每个 Bot 有独立的 `bot_id`，通过 Bearer Token 认证的 HTTP SSE 接口调用。选择星辰平台而非直接调用大模型的原因：(1) 平台提供了可视化的 Bot 编排工作流，可以沉淀资源生成的模板化流程；(2) Bot 内部可以组合调用多模型、多插件，生成质量高于单一 prompt 调用；(3) 平台提供了调试、版本管理和访问控制等运营能力。注意：代码中变量名 `coze_adapter`、`coze_bot_id_*` 指代的即星辰Agent开发平台。

**Nanobot**：作为本机 Agent 托管平台，提供 OpenAI-compatible API（`localhost:8900`），用于 Agent 伴侣的任务执行。Nanobot 内部集成了 Playwright 浏览器自动化，可以执行网页搜索和信息提取。选择本机托管而非云端调用的原因：(1) 桌面应用场景需要离线可用；(2) 避免外部 API 调用的延迟和配额限制；(3) 浏览器自动化需要本机环境。

### 3.5 数据库技术栈

**SQLite（当前开发环境）**：选择 SQLite 作为开发阶段数据库，因为：(1) 零配置、零依赖，嵌入进程内运行，适合桌面应用内嵌场景；(2) 文件型存储方便备份和传输；(3) 足以支撑当前单用户模式的数据量（万级记录）。

**PolarDB PostgreSQL（迁移中，🔲）**：规划迁移至阿里云 PolarDB PostgreSQL，原因：(1) 兼容 PostgreSQL 生态，支持丰富的数据类型（JSONB、向量、全文检索）；(2) 国产数据库，符合国内教育场景的数据合规要求；(3) 支持读写分离和自动扩展，适应未来多租户部署。系统已预留了 `polaris_sqlalchemy` 依赖和 PostgreSQL 连接配置项，迁移工作量可控。

**JSON/JSONL 文件存储**：用于存储用户行为事件流、练习记录快照、任务进度等半结构化数据。选择 JSONL 格式的原因：(1) 逐行追加写入，适合事件流的高频写场景；(2) 人类可读，便于调试和数据导出；(3) 可以按行流式读取，适合大文件场景。

---

## 4. 系统模块划分

### 4.1 学习画像模块 ✅

**关键文件**：`backend/app/routes/profile.py`、`backend/app/db.py`（profiles 表与 students 表）

**功能描述**：学习画像模块是整个系统的数据起点，负责为每位学习者建立和维护可演化的学习画像。画像数据存储于 SQLite 的 `students` 表（基础身份：姓名、邮箱、专业、年级）和 `profiles` 表（学习特征：学习目标、知识水平、薄弱点、学习偏好、认知风格、日均可学习时间、实践能力、当前阶段）。

**三种建档方式**：
1. **问卷建档**（`POST /api/profile/onboarding`）：用户一次性提交目标、水平、薄弱点、偏好、时间五个维度的结构化数据，系统调用 `_build_profile_from_onboarding` 将其映射为画像字段，落库并写快照。
2. **对话建档**（`POST /api/profile/initiate` + `POST /api/profile/chat`）：用户与 AI 进行 3 轮引导对话，每一轮 AI 提问、用户回答，系统收集自然语言回复并通过 `_build_profile_from_dialog` 从用户文本中抽取关键特征写入画像。
3. **手动编辑**（`PUT /api/profile`）：用户可随时修改画像的任意字段，系统自动 `version + 1` 并记录更新时间。

**数据沉淀**：每次建档操作都会：(1) upsert 数据库 `profiles` 表；(2) 写入 `profile_snapshot.json` 快照文件；(3) 追加 `learning_events.jsonl` 事件流，事件类型包含 `profile_onboarding`、`profile_dialog_completed`、`profile_updated`。

**待优化方向（🔲）**：对话建档中的 `_build_profile_from_dialog` 当前采用关键词规则抽取，尚未升级为结构化 JSON Schema + 置信度的方式。

### 4.2 路径规划模块 ✅ + 🔲

**关键文件**：`backend/app/routes/path_planning.py`

**功能描述**：路径规划模块根据学习者的画像和掌握度数据，自动生成个性化的学习路径。核心接口 `POST /api/path-planning/generate` 接收用户输入的目标（如"提升编程能力"），读取 `profiles` 表画像数据和 `mastery_records` 表掌握度统计，调用讯飞星火大模型生成结构化的路径规划结果（包含 `phases` 阶段划分、每阶段 `suggestions` 学习建议、对应 `resources` 推荐资源）。

**节点级建议**：`POST /api/path-planning/node-suggestions` 接口针对路径中的单个节点（知识主题），根据节点状态（已学/当前/下一跳/锁定）生成更细粒度的学习建议，实现"点击节点看详情"的学习路径交互模式。

**知识图谱关联（🔲 规划中）**：当前路径以树状结构组织（阶段→节点），规划升级为知识图谱：
- **节点**：表示学科知识点，附属性包含掌握度分数、错题频次、学习偏好权重；
- **边**：表示前置依赖关系（A 是 B 的前置知识）和关联关系（A 和 B 有交叉应用）；
- **动态推荐**：基于图谱状态自动计算"最优下一跳节点"、"回补路径（薄弱点反推前置知识）"、"每节点推荐资源组合"。

**前端呈现**：学习路径页面（`frontend/src/app/(shell)/path/page.tsx`）当前以阶段卡片 + 节点列表展示路径，规划支持图谱可视化（节点颜色反映掌握度热力图、点击节点弹出推荐资源和学习动作）。

### 4.3 资源生成模块 ✅

**关键文件**：`backend/app/routes/resources.py`、`backend/app/routes/ppt.py`、`backend/app/routes/video.py`、`backend/app/coze.py`

**功能描述**：资源生成模块是系统内容产出的核心，负责根据用户输入和知识库上下文，生成多种类型的学习资源并返回预览/下载地址。核心接口 `POST /api/resources/generate` 接收资源类型（`type`）和用户提示（`prompt`），在生成前先通过 `load_knowledge_context_async` 加载关联知识库文件的内容片段（上限 5000 字符），将其注入用户 prompt 中作为"优先参考"指令，再分发给对应的生成通道。

**六种资源类型与生成通道**：

| 资源类型 | 生成通道 | 产物格式 |
|---------|---------|---------|
| `document` 课程文档 | 星辰Agent开发平台 Bot（`coze_bot_id_resource_document`）→ 星火大模型 | Markdown 文本 |
| `mindmap` 思维导图 | 星辰Agent开发平台 Bot（`coze_bot_id_resource_mindmap`） | Markdown + Mermaid 格式 |
| `quiz` 练习题 | 星辰Agent开发平台 Bot（`coze_bot_id_resource_quiz`） | 结构化题目 JSON |
| `reading` 拓展阅读 | 星辰Agent开发平台 Bot（`coze_bot_id_resource_reading`） | Markdown 文本 |
| `code` 代码案例 | 星辰Agent开发平台 Bot（`coze_bot_id_resource_code`） | 代码 Markdown |
| `ppt` PPT | 讯飞智文 API（`xfyun_ppt_client`） | 在线 PPT 链接 + 封面图 |

**多模态模板沉淀**：每种资源类型都有对应的生成模板，沉淀在星辰平台的 Bot 工作流中。`CozeAdapter` 负责 HTTP SSE 流式调用、令牌管理、错误处理和资源链接提取。生成结果统一存储于 `resources_index.json` 索引文件，前端资源中心页面统一展示、预览和下载。

**PPT 生成子模块**：`backend/app/routes/ppt.py` 独立提供基于大模型的 PPT 大纲生成能力（`POST /api/ppt/generate-schema`），以结构化 JSON 输出幻灯片标题、布局类型（封面/要点/流程/总结）和内容片段，供后续不同 PPT 渲染引擎消费。

**视频生成子模块**：`backend/app/routes/video.py` 实现完整的"HTML-PPT → 分页讲稿 → TTS 音频 → 字幕对齐 → MP4 合成"链路。视频生成采用不依赖第三方视频 API 的稳定方案：大模型生成页面结构化的 HTML-PPT，按段落生成讲稿，调用讯飞 TTS 分段合成音频，基于音频时长生成 SRT 字幕时间轴，最终合成为可播放的 MP4 文件，并支持断点续跑。

**星辰Agent开发平台预览代理**：由于星辰平台返回的资源链接可能涉及 CORS 限制和签名过期问题，后端提供了预览代理层，判断内容类型（PDF/HTML/图片/其他）后返回安全预览地址，避免前端直接消费外链。

### 4.4 智能辅导模块 ✅

**关键文件**：`backend/app/routes/tutor_eval.py`、`backend/app/routes/agent.py`

**功能描述**：智能辅导模块是用户与 AI 进行深度交互的主通道，提供多轮对话辅导和 Agent 伴侣两种形态。

**多轮辅导对话**（`POST /api/tutor/chat`）：以 SSE 流式输出形式返回 AI 回答，支持以下上下文组装策略：
1. **角色上下文**（`_build_role_prompt`）：从 `tutor_roles` 表中读取当前角色的 persona（人设）、background（背景）、style_guide（风格规则）、rules（行为准则），构建系统级提示。
2. **页面上下文**（`_build_page_context_prompt`）：前端传入当前所在页面信息（如"用户当前在画像页"、"用户当前在路径规划页"），让模型感知用户所处的场景。
3. **对话历史**：从 `tutor_messages` 表取最近 12 条消息，按 user/assistant 角色映射组装历史数组。
4. **知识库上下文**：当请求携带 `knowledge_file_ids` 时，加载对应知识文件的分块内容注入 prompt。
5. **文件上下文**：支持上传文件（`tutor_files` 表），对 PDF、TXT 等文件做文本提取和分块索引（`tutor_file_chunks` 表），对话时自动关联。

**多模态对话（图片生成）✅**：辅导对话支持 `image_gen` 模式，当 mode 参数为 `image_gen` 时调用讯飞星火的图像生成能力（`xfyun_tti.generate_image_base64`），以 base64 编码返回生成的图片，嵌入对话流中展示。

**研讨会模式（workshop）**：当启用 `workshop_enabled` 时，系统同时路由多个角色（`workshop_role_ids`），各角色独立生成回答后汇总呈现，模拟"多个 AI 助手共同讨论"的效果，适用于需要多角度分析的学习场景。

**Agent 伴侣模块**（`backend/app/routes/agent.py`）：基于 Nanobot 本机托管，提供可养成式的学习伴侣体验：
- **宠物系统**：用户领养 Agent 宠物（可选 8 种头像），设定个性（简洁型/详细型/鼓励型）。
- **任务执行**：支持 4 种任务类型——搜索（search）、摘要（summarize）、对比（compare）、推荐（recommend），通过 Nanobot + Playwright 执行网页搜索和信息提取。
- **等级成长**：L1-L5 等级体系，每升一级解锁新能力，通过 XP 经验值驱动升级。

**防幻觉控制器 ✅**：完整的可信回答链路（详见 4.10 节），在辅导对话中集成，确保模型输出有据可查。

### 4.5 练习评测模块 ✅

**关键文件**：`backend/app/routes/quiz.py`

**功能描述**：练习评测模块提供结构化练习题的获取、提交、判题和记录管理功能。系统预置了 25 道 Python 编程练习题（覆盖数据类型、函数、循环、条件判断、列表操作五个模块），每题附带知识点 ID、知识点名称、选项、正确答案和解析。

**核心功能**：
- **获取题目**（`GET /api/quiz` 和 `GET /api/quiz/generate`）：按知识点（`kp_id`）和题目类型（`quiz_type`：single/multiple）筛选题目，也支持 AI 动态生成题目。
- **提交判题**（`POST /api/quiz/submit`）：对比用户答案与正确答案，返回判题结果（正确/错误）、题目解析和掌握度建议。提交后同时写入 `quiz_records.json` 和 `learning_events.jsonl` 事件流。
- **掌握度更新**（`_update_mastery`）：判题后自动更新 `mastery_records` 表中对应知识点的 `score` 字段（0-1），支持后续路径推荐和薄弱点分析。
- **错题管理**（`GET /api/quiz/mistakes`）：查询用户答错的题目列表，支持重新练习。
- **收藏管理**（`POST /api/quiz/favorite`）：用户可收藏题目，支持 `GET /api/quiz/favorites` 查看收藏列表。
- **贡献日历**（`GET /api/quiz/contributions`）：统计每日刷题数量，生成类似 GitHub 贡献热力图的数据。

### 4.6 知识库模块 ✅

**关键文件**：`backend/app/routes/knowledge.py`、`backend/app/embeddings.py`

**功能描述**：知识库模块为系统的 RAG（检索增强生成）能力提供基础支撑。用户可上传各类学习资料（PDF、TXT、Markdown 等），系统对文档做文本提取、分块（chunking）、向量化（embedding），构建可检索的知识片段库。

**文件管理**：支持文件上传、标签分类、状态追踪（pending → chunked → indexed）、引用计数统计。文件分块按 `chunk_index` 顺序存储，每个 chunk 的 embedding 向量存储在 JSON 字段中。

**RAG 检索**：知识库在资源生成和辅导对话两种场景下被调用。`load_knowledge_context_async` 函数按 `file_id + chunk_index` 顺序拼接已 `indexed` 的 `knowledge_chunks`，上限 5000 字符，确保上下文不会无限增长。向量检索基于讯飞 Embedding API 生成的 embedding 向量做余弦相似度匹配，以最高分前 K 个 chunk 作为检索结果。

**Embedding 引擎**：`XfyunEmbeddingClient` 封装了讯飞 Embedding API 的 HTTP 调用，通过 HMAC-SHA256 签名认证，支持文本到 float 向量数组的转换。embedding 向量以 base64 编码传输，支持小端和大端两种字节序解码尝试，兼容不同返回格式。

**RAG 已重新设计（✅）**：第三阶段对 RAG 进行了重新设计，当前实现中知识库由向量化 Embedding 检索和知识库 SQLite 表结合构成，chunk 文本存储于 SQLite（便于全量检索），embedding 向量存储于 JSON 中（便于向量相似度计算）。

### 4.7 MCP 插件商店 ✅

**关键文件**：`backend/app/routes/mcp.py`

**功能描述**：MCP 插件商店是系统的扩展能力中心，允许用户安装、配置和管理 MCP 协议兼容的外部工具插件。每个插件为一个独立的工具服务，通过标准化的 MCP 协议（Model Context Protocol）与系统通信。

**插件管理功能**：
- **CRUD 操作**：支持插件注册（`POST`）、列表查询（`GET`）、配置更新（`PUT`）、删除（`DELETE`）。
- **启停控制**：每个插件有 `enabled` 开关，支持运行时动态启停。
- **传输方式**：支持 `stdio`（启动子进程，通过标准输入输出进行 JSON-RPC 风格通信）和 `http`（远程 HTTP 端点）两种传输方式。
- **超时配置**：支持分别配置启动超时（`startup_timeout_ms`）和工具执行超时（`tool_timeout_ms` 和 `long_task_timeout_ms`）。

**Stdio 客户端实现**：`_McpStdioClient` 类实现完整的子进程管理生命周期——创建子进程、发送 MCP 初始化请求、工具列表枚举、工具调用、资源清理（terminate → kill fallback）。通信协议为 MCP 标准的 JSON-RPC 格式（`Content-Length: xxx\r\n\r\n` + JSON body）。

**已集成的插件**：
- **Browse-use**：浏览器自动化插件，通过 Playwright 执行网页导航、内容提取、元素交互等操作，为 Agent 伴侣提供真实网页搜索能力。

### 4.8 记忆系统 ✅

**关键文件**：`backend/app/memory_engine.py`

**功能描述**：记忆系统采用"分层记忆"架构，而非单一的向量记忆方案，实现了从短期到长期的多层级记忆管理。

**三层记忆结构**：

1. **短期记忆（Working Memory）**：
   - 容量上限：80 条记录
   - 用途：当前会话的上下文暂存、任务状态片段
   - 典型数据：当前辅导会话的临时上下文、进行中的任务描述

2. **中期记忆（Episodic Memory）**：
   - 容量上限：500 条记录
   - 用途：结构化学习事件记录
   - 来源：对话历史（`tutor_messages` 表）、练习记录、行为事件流（`learning_events.jsonl`）
   - 回放策略：辅导对话取最近 12 条消息作为上下文；大模型调用取最近 6 条历史控制 token

3. **长期记忆（Semantic Memory + Perceptual Memory）**：
   - Semantic Memory：抽象化的知识状态，包括 `goals`（学习目标）、`preferences`（偏好）、`constraints`（限制条件）、`facts`（已掌握事实）、`skills`（技能清单）、`weak_points`（薄弱点）、`learning_stage`（学习阶段）
   - Perceptual Memory：资源资产摘要，容量上限 300 条，记录已生成资源的元信息
   - 来源：画像快照（`profile_snapshot.json`）、掌握度记录（`mastery_records` 表）、任务进度（`task_progress.json`）、路径规划历史（`path_planning_history.json`）

**记忆操作接口**：
- `load_user_memory`：加载用户完整记忆（含数据清洗和去重）
- `save_user_memory`：合并保存记忆（merge 策略，不覆盖已有数据）
- `add_memory_item`：添加单条记忆项，按 `memory_type` 自动分配至对应层级
- `search_memory`：基于关键词的语义搜索，结合 Jaccard 相似度、子串匹配、中文字符重叠三种评分方式，返回按重要性 + 时效性 + 相关性排序的结果

**第三阶段重写（✅）**：记忆系统在第三阶段进行了完整重写，适配个性化采集场景。新增了 `build_injected_context` 和 `update_memory_from_turn` 两个关键函数，在每轮对话结束时自动更新记忆，并在下一轮对话时注入相关记忆。

### 4.9 防幻觉控制器 ✅

**关键文件**（7 个文件）：
- `backend/app/trust_router.py`：查询路由与风险评估
- `backend/app/trust_schemas.py`：数据模型定义
- `backend/app/trust_retriever.py`：证据检索
- `backend/app/trust_judge.py`：可回答性判决
- `backend/app/trust_citation.py`：引用渲染
- `backend/app/trust_rules.py`：置信度消息映射规则
- `backend/app/trust_answer_controller.py`：可信回答主控制器

**功能描述**：防幻觉控制系统为模型生成提供了一个完整的"可信回答"审查链路，确保输出的每一句回答都有据可查、可追溯、可验证。

**处理链路**：
1. **路由分析**（`route_query`）：根据用户查询内容做意图分类（`personalized_guidance` / `knowledge_qa` / `resource_based` / `open_ended`）和风险评估（高风险：含"必须/一定/唯一"等绝对化关键词；中风险：长文本或含问号；低风险：其他），同时判断需要哪些证据源（知识库、画像、文件、规则）。
2. **证据检索**（`retrieve_evidence`）：根据路由分析结果，从知识库（按 chunk 相似度）、用户画像、上传文件、预设规则中检索相关证据片段。
3. **可回答性判决**（`judge_answerability`）：评估证据充分性，输出置信度分数（0-1）、置信度等级（`high`/`medium`/`low`）、响应模式（直接回答 / 保守回答 / 建议澄清）、缺失需求清单和建议用户行动。
4. **可信提示构建**（`_build_prompt`）：将角色设定 + 页面上下文 + 学习记忆 + 证据片段（最多 6 条，带标签）组装为最终 prompt，根据置信度等级附加不同的生成策略（high：直接给出结论；medium：明确证据边界；low：保守语气，避免强确定性措辞）。
5. **引用渲染**（`render_citations`）：将证据来源格式化为可展示的引用标记。
6. **结果输出**（`TrustAnswerResult`）：包含答案文本、置信度分数、置信度等级、引用列表、验证信息和信任元数据。

### 4.10 教师大屏模块 ✅

**关键文件**：`backend/app/routes/teacher.py`、`frontend/src/app/(teacher)/teacher/` 目录下的多个页面

**功能描述**：教师大屏提供面向教师角色的班级数据可视化和管理功能。后端 `teacher.py` 路由提供 `/api/teacher` 前缀接口，包含：

- **班级概览数据**：学生总数、活跃学生数、平均掌握度、连续学习天数等聚合统计
- **知识点掌握分布**：按 5 个学习阶段（基础语法 → 函数与模块 → 面向对象 → 文件处理 → 高级特性）统计 20 个知识点的全班掌握度，支持热力图和雷达图展示
- **学生列表与个体画像**：查看每位学生的学习画像、掌握度雷达图、最近学习活动
- **AI 辅助报告**：基于 `spark_lite.summarize` 生成班级周期学习分析总结
- **教学干预**：创建针对特定学生或全班的干预任务（推送资源、补充练习）
- **消息广播**：向全体或特定学生发送学习通知

前端教师端页面包括：仪表盘（`dashboard`）、学生管理（`students`）、学生详情（`students/[id]`）、班级报告（`reports`）、教学干预（`interventions`）、消息广播（`broadcast`）、AI 分析（`ai`）、教师登录（`login`）。

### 4.11 学习社区模块 ✅

**关键文件**：`backend/app/routes/forum.py`、`frontend/src/app/(shell)/forum/` 和 `frontend/src/app/plaza/` 目录下的多个页面

**功能描述**：学习社区模块提供学习者之间的内容分享和交流平台。

**后端能力**：`/api/forum` 前缀接口实现帖子 CRUD（标题/内容/标签）、评论系统、附件上传（支持 PDF/Office/图片/ZIP，最大 20MB）和帖子状态管理。帖子支持 Markdown 格式内容和文件附件存储。

**前端页面**：社区首页（`forum/page.tsx`）、帖子详情（`forum/[postId]/page.tsx`）、发帖页（`forum/new/page.tsx`）构成基础论坛功能。此外还有一个知识广场（`plaza/`）布局，提供经验分享（`experience-share`）、问答（`qa`）、资源分享（`resource-share`）、组队学习（`team-study`）、浏览历史（`history`）、我的评论（`my-comments`）、我的点赞（`my-likes`）等功能子页面。

### 4.12 Admin 端（🔲 规划中）

规划中的管理员后台，将提供系统级配置管理、用户管理（多用户支持）、知识库批量管理、模型参数调优、系统日志查看等功能。当前系统以单用户模式运行，Admin 端将在多租户改造完成后着手开发。

### 4.13 外部接口模块（🔲 规划中）

**SMS 登录**：规划接入短信验证码登录，降低用户注册门槛，替代当前的单用户 ID 模式。

**OSS 存储**：规划将资源文件（PPT、视频、上传文档）从本地文件系统迁移至阿里云 OSS 对象存储，解决本地存储容量限制和多端访问问题。

**资料分发**：规划对外提供学习资料的 API 分发接口，支持第三方平台调用 SparkLearn 生成的教学资源。

**飞书接入智能体**：规划将 SparkLearn 的智能辅导能力接入飞书机器人，学生可在飞书中直接与 AI 导师对话，接收学习提醒和资源推送。

---

## 5. 系统边界与外部依赖

### 5.1 讯飞星火大模型 API

系统与讯飞星火的交互通过 `SparkLiteAdapter`（`backend/app/llm.py`）完成，使用 WebSocket 协议进行流式双向通信。认证方式为 HMAC-SHA256 签名，每次连接前根据 `app_id + api_key + api_secret` 计算签名 URL。系统支持两种调用方式：

1. **Python WebSocket 直连**（`_stream_events_from_ws`）：使用 `websockets` 库直接与星火 WebSocket 端点连接，支持携带历史消息数组（最近 6 条）。
2. **Bridge 桥接**（`_stream_events_from_bridge`）：当 `spark_use_bridge=true` 且 `spark_bridge.exe` 存在时，通过 C++ 桥接程序发起子进程调用，返回 JSON 行格式的流式事件。此方式为备选通道，在 Python WebSocket 不可用时提高连接鲁棒性。

**依赖配置项**：`spark_app_id`、`spark_api_key`、`spark_api_secret`、`spark_model`（当前使用 `lite`）、`spark_api_url`（默认 `wss://spark-api.xf-yun.com/v1.1/chat`）。

### 5.2 星辰Agent开发平台 API

星辰Agent开发平台（原 Coze 平台重组而来）通过 `CozeAdapter`（`backend/app/coze.py`）调用，使用 HTTP SSE 协议进行流式文本生成。认证方式为 Bearer Token（`coze_api_token`）。每个资源类型对应一个独立 Bot（`coze_bot_id_resource_*`），支持的资源类型：document、mindmap、quiz、reading、code，以及一个兜底的 default bot。

**依赖配置项**：`coze_base_url`（默认 `https://api.coze.cn`）、`coze_api_path_chat`（默认 `/v3/chat`）、`coze_api_token`、`coze_default_user_id` 以及 6 个 `coze_bot_id_resource_*` 配置项。

### 5.3 讯飞智文 PPT API

通过 `xfyun_ppt_client`（`backend/app/xfyun_ppt.py`）调用，使用 HTTP REST API（POST 创建 → GET 轮询进度）。认证方式为 `app_id + api_secret` 签名。生成流程分为两步：(1) 调用 `/api/ppt/create` 创建 PPT 任务，返回 `sid`；(2) 轮询 `/api/ppt/progress/{sid}` 直到状态为完成，返回 `pptUrl` 下载链接。

**依赖配置项**：`xfyun_zw_base_url`（默认 `https://zwapi.xfyun.cn`）、`xfyun_zw_app_id`、`xfyun_zw_api_secret`、`xfyun_zw_ppt_author`（默认 "SparkLearn"）、`xfyun_zw_timeout_sec`（默认 240 秒）。

### 5.4 讯飞 TTS API

通过 WebSocket 连接讯飞 TTS 服务进行语音合成，用于视频生成链路的音频产出。`xf_tts_base_url` 为 `wss://tts-api.xfyun.cn/v2/tts`，发送文本后接收 PCM 格式的音频流。默认发音人为 `xiaoyan`，发音人选择功能存在 bug（🔲 待修复）。

**依赖配置项**：`xf_tts_app_id`、`xf_tts_api_key`、`xf_tts_api_secret`、`xf_tts_default_voice`、`xf_tts_max_concurrency`（默认 2）、`xf_tts_timeout_ms`（默认 15000）、`xf_tts_text_limit`（默认 1000 字符/次）。

### 5.5 讯飞 Embedding API

通过 `XfyunEmbeddingClient`（`backend/app/embeddings.py`）调用，使用 HTTP REST API（POST）。认证方式为 HMAC-SHA256 签名。将文本发送至 `/v1/embeddings` 端点，返回 Base64 编码的 float 浮点向量数组。

**依赖配置项**：`xfyun_emb_base_url`（默认 `https://emb-cn-huabei-1.xf-yun.com/`）、`xfyun_emb_app_id`、`xfyun_emb_api_key`、`xfyun_emb_api_secret`、`xfyun_emb_timeout_sec`（默认 20 秒）。

### 5.6 Nanobot 本机托管

Nanobot 运行在 `localhost:8900`，提供 OpenAI-compatible API（`/v1/chat/completions`）。用于 Agent 伴侣的任务执行（搜索、摘要、对比、推荐）。Nanobot 内部集成了 Playwright 浏览器自动化，可执行真实网页搜索和内容提取。与 Nanobot 的通信通过 `httpx` HTTP 客户端发起，支持流式和非流式两种模式。浏览器行为可通过 `agent_browser_headless`（默认 false，演示模式下可见浏览器窗口）和 `agent_browser_slow_mo`（默认 800ms，操作慢速可见）配置。

### 5.7 外部依赖汇总

| 外部服务 | 协议 | 认证方式 | 通信模式 | 当前状态 |
|---------|------|---------|---------|---------|
| 讯飞星火大模型 | WebSocket | HMAC-SHA256 签名 | 双向流式 | ✅ 已对接 |
| 星辰Agent开发平台 | HTTP SSE | Bearer Token | 单向流式 | ✅ 已对接 |
| 讯飞智文 PPT | HTTP REST | app_id + secret | 请求-轮询 | ✅ 已对接 |
| 讯飞 TTS | WebSocket | HMAC-SHA256 签名 | 流式推送 | ✅ 已对接（音色选择 bug 🔲） |
| 讯飞 Embedding | HTTP REST | HMAC-SHA256 签名 | 请求-响应 | ✅ 已对接 |
| Nanobot | HTTP REST | OpenAI-compatible | 请求-响应 | ✅ 已对接 |
| 飞书机器人 | 待定 | 待定 | 待定 | 🔲 规划中 |

---

## 6. 部署架构

### 6.1 开发环境

开发环境采用前后端分离的本地运行模式：

- **前端开发服务器**：Next.js dev server，运行于 `localhost:3000`，支持热模块替换（HMR）和快速的开发迭代。启动命令为 `npm run dev`（在 `frontend/` 目录下）。
- **后端开发服务器**：uvicorn ASGI server，运行于 `localhost:8000`，启动命令为 `uvicorn backend.app.main:app --reload --port 8000`。支持自动重载和调试日志。
- **跨域配置**：CORS 中间件允许 `localhost:3000` 和 `127.0.0.1:3000` 两个来源的跨域请求，`allow_methods=["*"]` 和 `allow_headers=["*"]` 提供了开发便利性。
- **外部依赖**：讯飞星火/星辰平台/Embedding/TTS/智文 PPT API 均为云端服务，通过 HTTPS/WSS 协议通信。Nanobot 需在开发机上独立启动并运行于 `localhost:8900`。

### 6.2 桌面应用

SparkLearn 规划以 Electron 框架封装为桌面应用：

- **托管模式**：Electron 主进程负责启动 uvicorn（后端）和 Next.js standalone（前端），子进程启动 Nanobot。用户双击桌面图标即可启动完整的本地学习环境。
- **数据目录**：`backend/data/` 目录作为用户数据根目录，包含 SQLite 数据库（`db/sparklearn.db`）、用户文件（`users/single_user/` 下的 JSON/JSONL、上传文件、知识库文件）、导出资源等。数据目录独立于应用安装目录，便于升级不丢失数据。
- **后台常驻**：Nanobot 作为独立子进程运行，Agent 伴侣支持托盘最小化和通知弹窗。

### 6.3 数据目录结构

```
backend/data/
├── db/
│   └── sparklearn.db           # SQLite 主数据库
├── users/
│   └── single_user/            # 当前单用户根目录
│       ├── profile_snapshot.json
│       ├── memory_store.json
│       ├── learning_events.jsonl
│       ├── quiz_records.json
│       ├── task_progress.json
│       ├── path_planning_history.json
│       ├── resources_index.json
│       ├── video_resources.json
│       ├── resource_usage.jsonl
│       ├── video_events.jsonl
│       ├── knowledge/          # 上传的知识文件
│       ├── forum/              # 社区附件
│       └── tutor_files/        # 辅导上传文件
```

### 6.4 手机端适配方案（🔲 规划中）

规划手机端适配，优先级方案为：
1. **响应式 Web**：利用 Tailwind CSS 的响应式断点（sm/md/lg/xl），优先适配主流移动浏览器，学生可在手机上完成练习、查看报告和进行简单的辅导对话。
2. **PWA 渐进式应用**：通过 Service Worker 实现离线可用、消息推送、添加到主屏幕等原生体验。
3. **小程序**：中长期规划接入微信/飞书小程序生态，利用现有后端 API，以小程序前端壳覆盖核心学习功能。

---

## 7. 产品深度与规划方向

### 7.1 逆构个性化系统（🔲 规划中）

"随手拍"功能：学习者拍摄教材、习题、板书等任意学习材料，系统通过 OCR + 大模型自动识别内容主题和难度层级，反向推断学习者的学习阶段和需求，自动生成对应的教学规划（补充讲解、相关练习题、拓展阅读）。这是"先建画像再推荐"模式的逆向补充，适用于"我不知道该学什么，但我拍了这个"的零门槛使用场景。

### 7.2 趣味性与游戏化 Demo（🔲 规划中）

将学习过程游戏化，设计关卡式学习体验：每个知识点为一个"关卡"，通过练习评测解锁下一关；掌握度分数映射为"经验值"和"等级"；错题重练有"复活"机制；连续学习天数获得"签到奖励"。Agent 伴侣宠物作为游戏化的 UI 载体，承担"任务指引"、"成就展示"、"鼓励反馈"的角色。

### 7.3 外部优秀资源展示（🔲 规划中）

集成 B 站、慕课网、CSDN 等平台的优质教学视频和文章链接，在知识图谱节点上展示"外部资源推荐"。系统根据学习者的知识水平和偏好，自动匹配最适合的外部内容，并在 SparkLearn 内部通过 iframe 或跳转方式呈现。此功能需注意版权和内容审核机制。

### 7.4 平滑使用体验（弱目标模式）（🔲 规划中）

当前系统的初始使用门槛较高——用户需要先建画像、再规划路径、再开始学习。规划"弱目标模式"：用户可以不设定明确学习目标，直接使用智能辅导（问一个问题即开始）、练习评测（选择模块即开始刷题）或资源浏览（按学科标签浏览生成资源），系统在后台根据用户行为隐式构建画像，逐步引导用户进入完整的学习闭环。

---

## 附录 A：路由模块总览

| 路由模块 | 文件 | URL 前缀 | 状态 |
|---------|------|---------|------|
| 学习画像 | `routes/profile.py` | `/api/profile` | ✅ |
| 记忆系统 | `routes/memory.py` | `/api/memory` | ✅ |
| 通用学习 | `routes/learning.py` | `/api/learning` | ✅ |
| 知识库 | `routes/knowledge.py` | `/api/knowledge` | ✅ |
| 路径规划 | `routes/path_planning.py` | `/api` | ✅ |
| PPT 生成 | `routes/ppt.py` | `/api/ppt` | ✅ |
| 资源生成 | `routes/resources.py` | `/api/resources` | ✅ |
| 练习评测 | `routes/quiz.py` | `/api/quiz` | ✅ |
| 智能辅导 | `routes/tutor_eval.py` | `/api` | ✅ |
| 视频生成 | `routes/video.py` | `/api/video` | ✅ |
| 声音管理 | `routes/voice_admin.py` | `/api/voice` | ✅ |
| Agent 伴侣 | `routes/agent.py` | `/api/agent` | ✅ |
| 教师大屏 | `routes/teacher.py` | `/api/teacher` | ✅ |
| 学习社区 | `routes/forum.py` | `/api/forum` | ✅ |
| MCP 插件 | `routes/mcp.py` | `/api/mcp` | ✅ |

## 附录 B：关键代码定位清单

| 模块 | 关键文件 |
|------|---------|
| 应用入口与路由注册 | `backend/app/main.py` |
| 全部配置项 | `backend/app/config.py` |
| 数据库模型与初始化 | `backend/app/db.py` |
| 讯飞大模型适配器 | `backend/app/llm.py` |
| 星辰平台适配器 | `backend/app/coze.py` |
| 讯飞 Embedding 客户端 | `backend/app/embeddings.py` |
| 记忆引擎 | `backend/app/memory_engine.py` |
| 防幻觉控制器 | `backend/app/trust_answer_controller.py` |
| 防幻觉路由 | `backend/app/trust_router.py` |
| 防幻觉证据检索 | `backend/app/trust_retriever.py` |
| 防幻觉可回答性判决 | `backend/app/trust_judge.py` |
| 防幻觉引用渲染 | `backend/app/trust_citation.py` |
| 防幻觉规则定义 | `backend/app/trust_rules.py` |
| 防幻觉数据模型 | `backend/app/trust_schemas.py` |
| 数据存储层 | `backend/app/storage.py` |
| 讯飞 TTS 客户端 | `backend/app/xfyun_tts.py` |
| 讯飞智文 PPT 客户端 | `backend/app/xfyun_ppt.py` |
| 讯飞图片生成 | `backend/app/xfyun_tti.py` |

## 附录 C：数据库表一览

| 表名 | 用途 | 状态 |
|------|------|------|
| `students` | 学习者基础身份信息 | ✅ |
| `profiles` | 学习画像（版本化） | ✅ |
| `mastery_records` | 知识点掌握度评分 | ✅ |
| `contribution_days` | 每日学习活跃统计 | ✅ |
| `tutor_roles` | 辅导角色模板 | ✅ |
| `tutor_conversations` | 辅导对话会话 | ✅ |
| `tutor_messages` | 辅导对话消息 | ✅ |
| `tutor_files` | 辅导上传文件元数据 | ✅ |
| `tutor_file_chunks` | 辅导文件文本分块 | ✅ |
| `knowledge_files` | 知识库文件元数据 | ✅ |
| `knowledge_chunks` | 知识库文本分块 | ✅ |
| `agent_pets` | Agent 伴侣宠物数据 | ✅ |
