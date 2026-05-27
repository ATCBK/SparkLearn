# SparkLearn 第三阶段 Tutor 与 MCP 改造交接文档（2026-05-27）

## 1. 本次改造目标
- 修复 Tutor 对话页的模式、流式、可信度展示混乱问题。
- 接入讯飞文生图能力，并在对话框中直接渲染图片。
- 做功能切分隔离：图片生成链路与可信回答链路隔离。
- 优化 MCP 商店配置逻辑，避免 HTTP 与 stdio 字段/校验冲突。
- 支持在对话中展示 MCP 调用轨迹（当后端有上报时）。

---

## 2. 关键改动总览

### 2.1 Tutor 对话链路（后端）
文件：`backend/app/routes/tutor_eval.py`

主要变更：
- 新增图片模式判断函数 `_is_image_mode(mode)`。
- `mode=image_gen` 走独立图片生成分支：
  - 不进入 trust controller。
  - 不触发置信度/引用/防幻觉流程。
- 图片模式返回内容改为纯 markdown 图片：
  - `![AI生成图](data:image/png;base64,...)`
- assistant 消息持久化 `meta_json` 已包含：
  - `confidence`
  - `citations`
  - `trust_meta`
  - `open_mode`
  - `mode`
- SSE 事件新增透传（可选）：
  - 若 `trust_meta.mcp_calls` 存在，逐条发 `mcp_call` 事件。

### 2.2 讯飞文生图接入（后端）
文件：`backend/app/xfyun_tti.py`（新增）

能力：
- 对接接口：`https://spark-api.cn-huabei-1.xf-yun.com/v2.1/tti`
- 实现 HMAC 鉴权签名（POST request-line）。
- 请求体包含 `app_id/domain/width/height/prompt`。
- 返回 `base64` 图片内容供对话页渲染。

### 2.3 Tutor 对话页（前端）
文件：`frontend/src/app/tutor/page.tsx`

主要变更：
- 清理多处乱码文案与断裂字符串，恢复可编译。
- 输入区改造：
  - 只保留“上传文档”相关入口（并保留用户要求的模式按钮布局调整）。
- 模式改造：
  - “图片模式”改为单点按钮（开/关）。
  - “可信模式”改为单点按钮（开/关），默认 `openMode=true`（即默认开放模式）。
- 发送请求时：
  - `mode = imageMode ? image_gen : knowledge_qa`
  - 图片模式下强制 `openMode=true`，确保链路隔离。
- 图片渲染修复：
  - `ReactMarkdown` 增加 `img` 安全渲染。
  - `urlTransform` 放行 `data:image/...`。
  - 增加兜底：检测到 base64 图片时直接 `<img>` 渲染。
- 置信度面板隔离：
  - 图片消息不展示置信度/引用折叠面板。
- MCP 调用展示：
  - 新增 `mcpCallsByMsg`。
  - 收到 `mcp_call` 事件时，在对应 assistant 消息下展示：`服务名 / 工具名`。

### 2.4 Tutor API 客户端（前端）
文件：`frontend/src/lib/api/real.ts`

主要变更：
- `sendMessage` SSE 处理新增 `mcp_call` 事件。
- 提供 `onMcpCall` 回调给页面层。
- 历史消息映射已支持 `confidence/citations/trust_meta`。

---

## 3. MCP 商店逻辑重构
文件：`frontend/src/app/tutor/mcp-store/page.tsx`

已完成：
- 新增“连接方式”第一步：
  - `远程 HTTP MCP`
  - `本地 stdio MCP`
- 字段按类型隔离：
  - HTTP：显示并要求 URL。
  - stdio：显示 command/args/env，不要求 URL。
- 提交前校验隔离：
  - `http`：URL 必填。
  - `stdio`：Command 必填。
- “配置”Tab 改为超时参数，不再混入 command/args/env。
- 标题与说明文案改为类型感知，减少误导。

后端配套：
文件：`backend/app/routes/mcp.py`
- 修复启用逻辑：
  - 之前：`enabled=true` 前必须手动测试通过，否则报 `service must pass test before enabled`。
  - 现在：点击启用时自动先测试，测试通过后自动启用；失败返回 `enable failed: ...`。

---

## 4. 环境配置变更
文件：项目根目录 `.env`

已写入：
- `SPARK_APP_ID=9211779c`
- `SPARK_API_KEY=4625229d8790bc775c6a1b2276f3ab34`
- `SPARK_API_SECRET=NDU0ZjM4OTQ1OTQ0YTgxZWQ3OWQyZGUx`

说明：
- 当前文生图接入复用 `spark_app_id/api_key/api_secret`。

---

## 5. 当前可验证清单

### 5.1 Tutor 文本问答
1. 打开 Tutor 对话页。
2. 保持默认（开放模式）。
3. 提问普通学习问题，确认流式输出正常。

### 5.2 Tutor 图片生成
1. 点击“图片模式”按钮使其激活。
2. 输入提示词（例如“画一座雪山日出”）。
3. 预期：assistant 回复中直接显示图片（非链接文本）。
4. 预期：该消息不显示置信度/引用面板。

### 5.3 可信模式
1. 关闭图片模式。
2. 点击“可信模式”按钮激活。
3. 提问事实性问题，预期可看到置信度/引用折叠区。

### 5.4 MCP 调用展示
1. 触发后端 MCP 调用链路（需上游填充 `trust_meta.mcp_calls`）。
2. 预期：assistant 消息下出现 “MCP 调用” 区块，显示 `服务名 / 工具名`。

### 5.5 MCP 商店配置
1. 进入 `/tutor/mcp-store`。
2. 选择 `本地 stdio MCP`，填写 `npx + args` 不再要求 URL。
3. 点启用：应自动测试后启用（失败给具体原因）。

---

## 6. 已知问题 / 风险

1. 全量 `next build` 仍会在另一个页面失败（与本次改造无关）
- 页面：`/generate`
- 问题：`useSearchParams` 需要 `Suspense` 包裹。

2. MCP 调用展示目前依赖上游透传
- 仅当 `trust_meta.mcp_calls` 有结构化数据时，前端才会显示调用轨迹。

3. MCP 商店仍有进一步产品化空间
- 可继续做“认证方式模板化”“URL 密钥脱敏展示”“测试结果明细分层”。

---

## 7. 后续建议（按优先级）

P0：
- 修复 `/generate` 的 `useSearchParams + Suspense`，恢复全量构建通过。

P1：
- 为 `trust_meta.mcp_calls` 制定统一 schema（service_id/service_name/tool_name/args摘要/耗时/状态）。
- 在 Tutor 历史消息中持久化并回放 MCP 调用轨迹。

P2：
- MCP 商店拆成真正的分步向导：类型选择 -> 配置 -> 测试 -> 保存启用。
- 增加“预设模板”（filesystem、tavily、github 等）。

---

## 8. 涉及文件清单
- `backend/app/xfyun_tti.py`（新增）
- `backend/app/routes/tutor_eval.py`
- `backend/app/routes/mcp.py`
- `frontend/src/app/tutor/page.tsx`
- `frontend/src/lib/api/real.ts`
- `frontend/src/app/tutor/mcp-store/page.tsx`
- `.env`

---

## 9. 交接结论
本轮改造已完成 Tutor 页“图片生成 + 可信链路隔离 + MCP 调用可视化”的核心闭环，并对 MCP 商店的类型/字段/校验冲突进行了实质修复。当前可用于继续联调与演示，阻塞项仅剩 `/generate` 页面独立构建问题。
