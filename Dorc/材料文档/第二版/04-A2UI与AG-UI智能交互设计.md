# A2UI 与 AG-UI 智能交互（第二版）

## 1. 为什么需要两套协议
- **A2UI**：定义最终渲染面板结构，适合“任务卡、卡片状态、组件布局”。
- **AG-UI**：定义过程事件，适合“推理阶段、工具调用、工作流状态”。

## 2. A2UI 实际格式（后端）
Tutor 侧通过 `a2ui` 事件写入三类 envelope：

1. `createSurface`：创建/更新页面 Surface。
2. `updateDataModel`：更新 surface 的数据模型。
3. `updateComponents`：更新组件树。

对应字段（示例语义）：
- `surfaceId`、`catalogId`、`path`、`value`、`components`。
- 常见来源：任务列表场景、资源推荐场景。

前端侧 `applyA2UIEnvelopeToSurfaces` 负责把消息合并到本地 `a2uiSurfaces`，用于 `A2UITaskCards` 渲染。

## 3. AG-UI 事件链
`/api/tutor/chat` 产生的 AGUI 事件包含：

- `RunStarted/RunFinished`
- `StepStarted/StepFinished`
- `ToolCallStart/ToolCallArgs/ToolCallResult`
- `StateDelta`

事件按阶段输出到 SSE：
- `agui`（运行中阶段）
- `mcp_call`（工具执行明细）
- `workshop_phase`（研讨会阶段）

## 4. 前端消费链路
在 `frontend/src/app/tutor/page.tsx` 与 `frontend/src/lib/api/real.ts` 中：

- `sendMessage(...,{ onA2UI,onAGUI,onMcpCall,onHub,...})`
- `readSSE` 解析 `text:` 格式事件，每条 `{type,payload}` 入事件处理函数。
- `a2uiSurfaces` 与 `aguiEvents` 挂载到 `Message`，和文本流并行显示。

## 5. 端到端交互顺序（实测可见）

1. 用户发送问题
2. 服务端先发 `meta/a2ui/agui/workshop_phase/hub/search_results` 等
3. 文本 `text` 按 chunk 递增
4. 若开启工具：`mcp_call` 逐条推入
5. 结束前发 `done`（含 `a2ui_events/agui_events`）

## 6. 兜底场景
- A2UI 面板无效：`a2ui_ui_only` 状态可保证界面至少有结构化响应。
- AGUI 事件过长：前端做逐条展示且不会阻塞文本流。
- 事件类型不识别：直接忽略，不影响主对话。

## 7. 可汇报点
“用户能看见模型不是黑箱：每一步都在 event 中留下可解释痕迹（工具调用、状态、阶段、结果）。”
