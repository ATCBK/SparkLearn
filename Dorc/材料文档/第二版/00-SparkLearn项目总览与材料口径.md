## SparkLearn 项目总览与材料口径（第二版）

### 1. 版本目标
本版本文档用于“可以直接用于汇报/答辩/验收”的材料，目标是让每个模块都能从：
- 业务能力
- 接口/事件
- 数据流转
- 失败兜底
- 运维落地
这五个维度完整对应到代码实现。

统一口径如下：
- 学习闭环主线：`画像 -> 检索 -> 对话 -> 生成 -> 评测 -> 回灌`。
- 多工具平台统一写作：**星辰Agent平台**。
- 数据库写作口径：**PostgreSQL（PG SQL）**，工程代码运行时可兼容 `sqlite`（在 `settings.db_type` 中保留迁移兼容项）。

### 2. 技术栈（与实现一致）
- 前端：Next.js 16（App Router）
- 后端：FastAPI
- 大模型：讯飞星火
- 多工具层：星辰Agent平台（MCP，stdio/http）
- 向量检索：课程知识库分片 + Embedding 检索
- 存储：`backend/data/` 目录下 SQLite/JSON/JSONL + 业务数据库

### 3. 项目现状能讲的“核心卖点”
1. **画像驱动的个性化闭环**：`/api/profile` + `/api/learning-path` + `/api/tasks` + `/api/memory`。
2. **证据优先回答**：`/api/tutor/chat` 结合 Web 检索、知识库、MCP 结果，返回 `confidence/citations/trust_meta`。
3. **流式可观测交互**：SSE 事件统一承载：`meta`、`a2ui`、`agui`、`search_results`、`progress`、`error`、`done`。
4. **工具自治和降级机制**：MCP 工具调用失败并不会阻塞整个会话；失败会降级为无工具上下文继续回答，并记录错误。
5. **多模态产出闭环**：文本类资源、PPT、博客、代码、视频都有生成链路和失败兜底。

### 4. 术语统一
- **A2UI**：结构化前端渲染协议（surface/createSurface/updateDataModel/updateComponents）。
- **AG-UI**：模型执行过程事件协议（RunStarted/StepStarted/ToolCallStart/ToolCallResult/RunFinished 等）。
- **RAG**：课程文件与检索上下文增强。
- **Learning Loop**：学习闭环（Profile->Path->Task->Quiz->Report）。

### 5. 总体架构（实现入口）
- `backend/app/main.py` 统一初始化数据库、CORS、请求日志、路由。
- API 统一前缀：
  - 认证 `/api/auth`
  - 教学与画像 `/api/profile`
  - 学习 `/api/learning-path`、`/api/tasks*`、`/api/mastery`
  - RAG 与知识库 `/api/knowledge`
  - Tutor `/api/tutor`
  - 资源 `/api/resources`
  - 视频 `/api/video`
  - 记忆 `/api/memory`
  - MCP `/api/mcp`
  - 发现 `/api/info-stream`
  - 资源分享 `/api/sharing`

### 6. 本版文档用途
- **对外汇报**：每篇可单独给到评审。
- **对内开发**：每篇可作为实现与联调依据。
- **交付验收**：11 号文档给测试场景，10 号文档给部署环境。

---

如果你要做 1 页“答辩摘要”，建议直接用这四点：
1. 画像驱动学习闭环
2. 证据约束的可解释回答
3. A2UI/AG-UI 透明化交互
4. 工具降级和失败恢复机制
