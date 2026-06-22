# A2UI 对话任务卡设计

## 目标

在网页端 `/tutor` 对话页面试点 A2UI 协议，让后端在普通文本回答之外，通过 SSE 追加结构化 UI 消息，前端在助理消息下方渲染多张学习任务卡。

## 范围

- 只接入主对话页 `/tutor`。
- 只实现一个 PoC catalog：`SparkTaskCards`。
- 只支持展示和轻量 action：完成、加入学习路径。
- 不改造登录、后台、教师端、全局布局和数据库结构。

## 架构

后端 `/api/tutor/chat` 继续输出现有 `text`、`done` 等 SSE 事件，同时在适合学习计划的问题中输出 `a2ui` 事件。`a2ui` 事件 payload 使用 A2UI v0.9.1 的流式 envelope 思路，包含 `createSurface`、`updateDataModel`、`updateComponents` 三类消息。

前端 `api.sendMessage()` 增加 `onA2UI` 回调，把事件挂到当前 assistant 消息的 `a2uiSurfaces` 字段。`/tutor` 页面通过 `A2UITaskCards` 组件渲染白名单 catalog，未知组件直接忽略并显示降级提示。

## 数据流

1. 用户在 `/tutor` 发送“帮我安排本周学习任务”之类请求。
2. 后端生成普通文本回答。
3. 后端根据问题和回答构造多张学习任务卡，并流式发送 `a2ui` 事件。
4. 前端把 `a2ui` 事件归并到当前 assistant 消息。
5. `A2UITaskCards` 渲染任务卡。
6. 用户点击卡片按钮时，前端用现有 `handleSend()` 发出一条明确文本指令，后端继续走原聊天链路。

## 协议约束

- 使用 `protocol: "a2ui"` 和 `version: "0.9.1"` 标记。
- `surfaceId` 必须稳定且唯一。
- `catalogId` 固定为 `sparklearn.task_cards.v1`。
- `dataModel.tasks` 必须是数组，每个任务包含 `id`、`title`、`description`、`durationMinutes`、`difficulty`、`resources`、`actions`。
- 前端只渲染 `component: "SparkTaskCards"`，不执行后端传来的任意 JS。

## 错误处理

- 缺少 `surfaceId`、`catalogId` 或 `tasks` 时前端不渲染任务卡。
- 未知 catalog 或未知 component 显示轻量降级提示。
- action 点击只转成普通对话文本，不直接写数据库。

## 验证

- 后端单元测试验证学习计划类问题会生成 `a2ui` 事件。
- 后端单元测试验证非学习计划类问题不会强行生成任务卡。
- 前端 lint 验证类型和组件可编译。
