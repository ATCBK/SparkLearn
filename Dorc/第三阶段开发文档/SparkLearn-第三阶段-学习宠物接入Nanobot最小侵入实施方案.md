# SparkLearn-第三阶段-学习宠物接入Nanobot最小侵入实施方案

## 1. 目标与约束

### 1.1 目标

1. 学习宠物能力底座切换到 `nanobot`。
2. 飞书等外部渠道由 `nanobot` 原生接入。
3. SparkLearn 现有前端展示效果尽量保持不变（页面结构、宠物交互样式、任务流展示不重做）。

### 1.2 硬约束

1. 尽量不改 `nanobot` 核心代码（agent loop / channel manager / tool core）。
2. SparkLearn 侧做适配层，不侵入学习业务核心路由。
3. 首版优先稳定闭环，不追求全能力一次性迁移。

---

## 2. 代码检查结论（基于 `D:\Project_building\SparkLearn\nanobot-main`）

1. `nanobot` 已内置 Feishu channel：`nanobot/channels/feishu.py`。
2. `nanobot` 已支持外部 channel 插件：`docs/channel-plugin-guide.md`。
3. `nanobot` 已支持外部 tool 插件：`nanobot/agent/tools/loader.py`（`entry_points: nanobot.tools`）。
4. `nanobot` 已支持 MCP Server：`config.tools.mcpServers`（见 `docs/configuration.md`）。
5. `nanobot` 自带 OpenAI-compatible API：`nanobot/api/server.py`（`/v1/chat/completions`）。

结论：

- 技术上可以做到“零改或极少改 nanobot”。
- 最优路径是：SparkLearn 提供工具服务，`nanobot` 调用它。

---

## 3. 最小侵入总体架构

1. 渠道层：`nanobot`（飞书/其他）
2. 智能体层：`nanobot`（对话、记忆、工具决策）
3. 业务工具层：SparkLearn 新增 `agent_gateway`（统一对外工具 API）
4. 业务能力层：SparkLearn 现有 `/api/profile` `/api/resources` `/api/quiz` `/api/report` ...
5. 前端层：SparkLearn 现有学习宠物 UI 保持主视觉与交互结构

核心原则：

- `nanobot` 负责“会话与决策”；
- SparkLearn 负责“教育业务与数据”。

---

## 4. 为保持展示效果不变的关键设计

### 4.1 前端不直接连 nanobot

保持当前前端 `frontend/src/lib/api/real.ts` 的接口形态不变，继续请求 SparkLearn 后端。

### 4.2 后端增加“宠物会话兼容层”

新增 SparkLearn 路由层：

- `/api/agent/pet/chat`（新）
- `/api/agent/pet/tasks/*`（新）

这些接口内部转发到：

- 本地运行的 `nanobot` OpenAI-compatible API（`/v1/chat/completions`）
- 或自定义 tool 触发服务

这样前端展示与状态管理基本不动。

### 4.3 保留当前宠物 UI 数据结构

输出继续沿用你现有字段风格，例如：

- `task_id`
- `status`
- `steps`
- `result`

兼容层负责把 nanobot 返回结果映射成旧结构。

---

## 5. Nanobot 接入方式（按改动最小排序）

### 方案A（推荐，最小改动）

1. 不改 nanobot 内核。
2. SparkLearn 把业务能力做成 MCP Server 或 HTTP Tool Service。
3. 在 `~/.nanobot/config.json` 注册 `mcpServers` 或工具插件。
4. 飞书直接挂 nanobot channel。

优点：

- 升级 nanobot 成本低。
- 可快速复用其飞书、会话、流式能力。

### 方案B（次选）

1. 自定义 `nanobot.tools` 插件包（独立仓库/目录）。
2. 插件中调用 SparkLearn API。

适用：

- 你希望 tool 名称、参数、权限完全可控。

### 方案C（不推荐首版）

1. 直接改 nanobot 源码增加内置工具。

问题：

- 后续 upstream 升级冲突大。

---

## 6. 建议的工具暴露清单（MVP）

1. `spark_get_profile`
2. `spark_get_learning_path`
3. `spark_generate_resource`
4. `spark_quiz_generate`
5. `spark_quiz_judge`
6. `spark_get_report`
7. `spark_browser_search`（代理你已有浏览器插件）

参数设计建议：

- 全部显式包含 `user_id`（或由会话映射注入）
- 设置 `timeout_ms`
- 返回统一 `success/data/error/trace_id`

---

## 7. 飞书接入策略

1. 首版直接用 `nanobot/channels/feishu.py` 能力。
2. SparkLearn 不重复实现飞书 webhook。
3. 用户身份映射在 SparkLearn 保存：`feishu_open_id -> spark_user_id`。

最小新增表：

- `external_identities(provider, open_id, spark_user_id, tenant_key, created_at, updated_at)`

---

## 8. 浏览器插件接入策略

将“浏览器控制能力”封装为 `spark_browser_search` 工具，通过 SparkLearn 网关转调你已有逻辑。

首版安全边界：

1. 只读动作：search/open/read/summary
2. 域名白名单
3. 任务超时
4. 步数上限

不建议首版开放：

- 表单提交
- 登录态操作
- 文件上传下载

---

## 9. 迁移路径（保证可回退）

### Phase 1：并行接入

1. 新增 `/api/agent/pet/chat` 走 nanobot。
2. 旧 `/api/agent/*` 保留。
3. 前端通过开关切流（仅学习宠物模块）。

### Phase 2：功能对齐

1. 对齐任务流、步骤流、推荐流。
2. 对齐宠物等级/经验值逻辑（可继续由 SparkLearn 维护）。

### Phase 3：灰度替换

1. 内部账号切全量。
2. 稳定后逐步下线旧宠物对话实现。

---

## 10. 保持展示效果的实现要点

1. 继续使用你现有 `AIAssistant` / `AgentChat` 前端组件。
2. 响应格式由兼容层统一转换，前端尽量零改。
3. 保留当前“步骤进度文案”风格（如：开始处理/检索中/已完成）。
4. 若 nanobot 返回流式文本，兼容层按现有 SSE 格式转发给前端。

---

## 11. 你当前应拍板的4件事

1. 工具扩展方式：`MCP` 还是 `nanobot.tools` 插件（推荐 MCP 起步）。
2. 前端切流策略：学习宠物模块是否允许灰度开关。
3. 浏览器插件首版权限：是否确认“只读模式”。
4. 身份映射策略：飞书首次发言是否自动建 SparkLearn 用户。

---

## 12. 最终建议

在你“最少改 nanobot”的前提下，最佳落地是：

1. `nanobot` 原生运行（飞书 + agent loop + 记忆）。
2. SparkLearn 提供 MCP/HTTP 业务工具。
3. SparkLearn 保留现有宠物前端展示，后端做兼容转发。
4. 首版只迁移学习宠物链路，其他模块不动。

