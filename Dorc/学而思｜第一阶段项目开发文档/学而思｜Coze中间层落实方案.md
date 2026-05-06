# Coze 中间层落实方案（资源生成链路）

## 1. 目标

- 将“资源生成”与“智能导师”模型链路解耦。
- 除 `PPT`、`视频` 外，资源生成统一走 Coze 智能体调用。
- 支持按资源类型动态切换 `bot_id`，便于后续多智能体扩展。

## 2. 范围与边界

- 本期改造范围：`/api/resources/generate`
- 保持不变：
  - `PPT` 生成：继续使用现有 `/api/ppt/generate-schema`
  - `视频` 相关链路：保持现状
  - 导师对话链路：保持现状（不与资源生成复用 bot）

## 3. 中间层设计

新增 `backend/app/coze.py`，作为统一 Coze Provider，职责如下：

1. 鉴权与请求封装  
   - 固定对接 `https://api.coze.cn/v3/chat`
   - 统一处理 `token` 鉴权头
2. 流式事件解析  
   - 解析 SSE 流中的 `event/data`，抽取增量文本
   - 输出统一事件格式：`text / error / done / meta`
3. bot 路由  
   - 根据资源类型选择不同 `bot_id`
   - 支持默认 bot 回退
4. 容错兜底  
   - Coze 调用失败时返回 `error` 事件
   - 上层可根据事件给前端展示重试提示

## 4. bot_id 映射策略

优先级从高到低：

1. 类型专用 bot（如课程文档）  
2. 资源默认 bot  
3. 空值（触发可观测错误，避免静默失败）

示例（环境变量）：

- `COZE_BOT_ID_RESOURCE_DOCUMENT`：课程文档 bot
- `COZE_BOT_ID_RESOURCE_DEFAULT`：资源生成默认 bot

## 5. 配置项（.env）

最小必填：

- `COZE_API_TOKEN`
- `COZE_BOT_ID_RESOURCE_DOCUMENT`

可选：

- `COZE_BASE_URL`（默认 `https://api.coze.cn`）
- `COZE_API_PATH_CHAT`（默认 `/v3/chat`）
- `COZE_DEFAULT_USER_ID`（默认 `single_user`）
- `COZE_BOT_ID_RESOURCE_DEFAULT`
- 其它资源类型 bot：`COZE_BOT_ID_RESOURCE_MINDMAP/QUIZ/READING/CODE`

## 6. 资源生成调用约定

请求体（后端 -> Coze）核心字段：

- `bot_id`
- `user_id`
- `stream=true`
- `auto_save_history=true`
- `additional_messages`（最后一条为 user question）

后端 -> 前端 SSE 事件保持：

- `progress`
- `text`
- `error`
- `done`

## 7. 交付顺序

1. 新增 Coze 中间层
2. 增加配置项与 bot_id 映射
3. 改造资源生成路由（先打通 `document`）
4. 自测：接口可调用、流式文本可返回、资源可落盘
5. 再扩展其余资源类型到各自 bot

