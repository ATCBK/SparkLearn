# SparkLearn 微信小程序技术设计文档

## 1. 文档目标

本文档基于 `proposal.md` 产出，描述 SparkLearn 微信小程序重构的技术设计。新小程序定位为“移动端 AI 学习辅助与练习工具”，使用 Taro 构建微信小程序前端，围绕 `AI助学 / 刷题 / 我的` 三个 Tab 组织能力。

本文档只设计本期确认范围内的能力。除微信登录所需的最小后端补齐外，业务数据全部复用现有后端接口，不迁移旧小程序页面内容，不引入首页、知识图谱、学习伙伴宠物化、`/api/agent` 任务系统。

## 2. 已确认决策

| 编号 | 决策项 | 结论 |
| --- | --- | --- |
| D1 | 小程序技术栈 | Taro |
| D2 | 工程方式 | `miniapp` 按从零新建小程序工程设计 |
| D3 | 文档位置 | 项目根目录 `miniprogram-design.md` |
| D4 | 底部 Tab | `AI助学 / 刷题 / 我的` |
| D5 | 登录方式 | 微信登录 |
| D6 | 配置来源 | 复用 `.env` 相关配置 |
| D7 | AI 输出 | 必须实现真实流式输出 |
| D8 | 输入能力 | 支持文本、语音输入、图片上传、文件上传 |
| D9 | AI 回复渲染 | 支持 Markdown、代码块、表格、图片预览 |
| D10 | 导师角色 | 只做选择已有角色/默认角色，不做新建/编辑/删除 |
| D11 | 多角色研讨 | 前端使用后端默认参与角色 |
| D12 | MCP | 小程序端提供开关 |
| D13 | MCP 展示粒度 | 只显示调用了什么工具和结果摘要 |
| D14 | 刷题主题映射 | 小程序主题字段映射为 `chapter` |
| D15 | 题目生成 | 默认 `use_llm=true` |
| D16 | 默认主题 | `Python 基础`，题目数量可设置 |
| D17 | 判题方式 | 每题提交一次，即时判题 |
| D18 | 问 AI | 答对和答错后都允许问 AI |
| D19 | 我的子页面 | 答题记录、错题本、收藏题作为独立子页面 |
| D20 | 学习画像 | 本期只展示，不编辑 |
| D21 | 设置页 | 账号信息、清缓存、后端地址、退出登录、隐私协议均在范围内 |
| D22 | 图标方案 | 可使用小程序可用图标方案，不强依赖 Lucide |
| D23 | 接口字段 | 文档包含字段级定义和 TypeScript 类型 |
| D24 | 交付管理 | 文档包含任务拆分、测试用例和验收 checklist |

## 3. 范围边界

### 3.1 本期范围

- 使用 Taro 构建微信小程序前端。
- 新建三 Tab 信息架构：`AI助学 / 刷题 / 我的`。
- AI 助学使用 `/api/tutor` 相关能力。
- 刷题使用 `/api/quiz` 相关能力。
- 个人中心使用 `/api/profile`、`/api/quiz`、`/api/contribution`、`/api/mastery`、`/api/dashboard/stats` 等现有数据接口。
- 新增微信登录所需的最小后端接口。
- 支持 AI 真实流式输出。
- 支持语音输入：小程序端完成语音转文本后发送文本。
- 支持图片上传：图片仅作为对话附件展示/本地预览，不进入 AI 理解链路。
- 支持文件上传：复用 `/api/tutor/files`，可上传文本类资料并通过 `file_ids` 进入 AI 对话。

### 3.2 不在本期范围

- 旧首页、知识图谱、学习路径、资源生成、论坛等入口。
- 学习伙伴宠物化、XP、等级、成长任务。
- `/api/agent` 任务系统。
- 教师端、管理端、桌面端或 Web 端改造。
- 视频、PPT、语音、多媒体资源生成。
- 图片理解、多模态视觉问答。
- 导师角色创建、编辑、删除。
- 学习画像编辑或 onboarding 流程。

### 3.3 允许的后端变化

本期原则是复用现有后端，但微信登录需要后端与微信服务端交换 `code`，因此允许新增最小后端能力：

- 新增 `POST /api/auth/wechat/login`。
- 新增微信账号映射数据结构。
- 在 `backend/app/config.py` 中接入 `.env` 的 `WECHAT_MINI_APPID`、`WECHAT_MINI_SECRET`。

除此之外，不新增业务接口，不改变 `/api/tutor`、`/api/quiz`、`/api/profile` 等业务接口契约。

## 4. 技术架构

### 4.1 总体架构

```text
微信小程序用户
  -> Taro 小程序前端
    -> API Client
      -> SparkLearn FastAPI 后端
        -> 现有业务接口
        -> 新增微信登录接口
        -> SQLite/PostgreSQL 数据层
        -> LLM / MCP / 文件索引等现有服务
```

### 4.2 前端技术栈

| 层级 | 技术 |
| --- | --- |
| 跨端框架 | Taro |
| 目标端 | 微信小程序 |
| 语言 | TypeScript |
| 页面样式 | SCSS 或 Taro 推荐样式方案 |
| 状态管理 | Zustand 或 Taro 轻量全局 store |
| 网络请求 | `Taro.request`、`Taro.uploadFile`、原生 request task 流式能力 |
| Markdown | 小程序兼容 Markdown 渲染组件 |
| 语音输入 | 微信录音能力 + 微信同声传译/语音识别插件 |
| 本地缓存 | `Taro.setStorageSync` / `Taro.getStorageSync` |

状态管理建议使用轻量 store。小程序页面数量少、状态边界清晰，不建议引入复杂 Redux 体系。

### 4.3 后端现状

从当前代码可确认：

- AI 助学接口位于 `backend/app/routes/tutor_eval.py`，路由路径为 `/api/tutor/*`。
- 刷题接口位于 `backend/app/routes/quiz.py`，路由路径为 `/api/quiz/*`。
- 学习画像接口位于 `backend/app/routes/profile.py`，路由路径为 `/api/profile/*`。
- 认证模块位于 `backend/app/auth.py`，已有 JWT、短信登录、`/api/auth/me`、`/api/auth/logout`。
- `POST /api/tutor/chat` 使用 `StreamingResponse`，媒体类型为 `text/event-stream`。
- SSE 数据格式为：

```text
data: {"type":"text","payload":{"content":"..."}}

```

### 4.4 配置设计

后端继续从项目根目录 `.env` 加载配置。小程序前端不能直接读取根目录 `.env`，需要在构建期生成小程序端可用配置。

建议新增：

```text
miniapp/.env.development
miniapp/.env.production
```

小程序端配置项：

| 变量 | 用途 |
| --- | --- |
| `TARO_APP_API_BASE_URL` | 后端 API 地址 |
| `TARO_APP_UPLOAD_BASE_URL` | 文件上传地址，默认与 API 地址一致 |
| `TARO_APP_WECHAT_APPID` | 小程序 AppID，仅用于前端环境标识 |
| `TARO_APP_ENABLE_STREAM` | 是否启用真实流式输出，固定为 `true` |

后端需补齐配置项：

| 变量 | 用途 |
| --- | --- |
| `WECHAT_MINI_APPID` | 微信小程序 AppID |
| `WECHAT_MINI_SECRET` | 微信小程序 AppSecret |

## 5. 小程序工程结构

`miniapp` 当前按空目录处理，建议结构如下：

```text
miniapp/
  config/
    dev.ts
    prod.ts
    index.ts
  src/
    app.config.ts
    app.scss
    app.ts
    pages/
      tutor/
        index.config.ts
        index.scss
        index.tsx
      quiz/
        index.config.ts
        index.scss
        index.tsx
      mine/
        index.config.ts
        index.scss
        index.tsx
      mine-records/
        index.config.ts
        index.scss
        index.tsx
      mine-wrong/
        index.config.ts
        index.scss
        index.tsx
      mine-favorites/
        index.config.ts
        index.scss
        index.tsx
      settings/
        index.config.ts
        index.scss
        index.tsx
      privacy/
        index.config.ts
        index.scss
        index.tsx
    components/
      AiMessageBubble/
      AnswerResult/
      AttachmentBar/
      ConfidenceBadge/
      EmptyState/
      ErrorState/
      FilePicker/
      MarkdownView/
      McpCallPanel/
      QuizCard/
      SkeletonBlock/
      StatCard/
      TutorRoleSheet/
      VoiceInputButton/
      WorkshopPanel/
    services/
      apiClient.ts
      authApi.ts
      tutorApi.ts
      quizApi.ts
      profileApi.ts
      uploadApi.ts
    stores/
      authStore.ts
      tutorStore.ts
      quizStore.ts
      profileStore.ts
      settingsStore.ts
    types/
      api.ts
      auth.ts
      tutor.ts
      quiz.ts
      profile.ts
    utils/
      env.ts
      format.ts
      markdown.ts
      sseParser.ts
      storage.ts
      validators.ts
```

## 6. 路由与导航

### 6.1 Tab 路由

| Tab | 页面路径 | 标题 | 说明 |
| --- | --- | --- | --- |
| AI助学 | `pages/tutor/index` | AI助学 | 默认进入最近对话或默认对话 |
| 刷题 | `pages/quiz/index` | 刷题 | 当前练习主流程 |
| 我的 | `pages/mine/index` | 我的 | 数据概览与复盘入口 |

### 6.2 非 Tab 页面

| 页面 | 路径 | 进入方式 |
| --- | --- | --- |
| 答题记录 | `pages/mine-records/index` | 我的 |
| 错题本 | `pages/mine-wrong/index` | 我的 |
| 收藏题 | `pages/mine-favorites/index` | 我的 |
| 设置 | `pages/settings/index` | 我的 |
| 隐私协议 | `pages/privacy/index` | 设置 |

### 6.3 跳转约定

刷题结果进入 AI 讲解时，通过页面参数或全局 store 传递上下文：

```ts
type QuizAskAiContext = {
  source: 'quiz_result' | 'wrong_detail' | 'favorite_detail'
  quizId: string
  question: string
  questionType: QuizType
  userAnswer: string | string[]
  correctAnswer?: string | string[]
  explanation?: string
  knowledgePointName?: string
}
```

进入 `AI助学` 后，前端自动构造用户问题，但不自动发送。用户可编辑后发送。

## 7. 登录与鉴权设计

### 7.1 小程序登录流程

1. 小程序启动。
2. 检查本地 `token`。
3. 若无 token，调用 `Taro.login()` 获取 `code`。
4. 调用新增接口 `POST /api/auth/wechat/login`。
5. 后端使用 `WECHAT_MINI_APPID`、`WECHAT_MINI_SECRET` 调用微信 `code2Session`。
6. 后端根据 `openid` 查询或创建用户。
7. 后端返回 JWT token 和用户信息。
8. 小程序保存 token，后续请求带 `Authorization: Bearer <token>`。

### 7.2 新增接口

#### `POST /api/auth/wechat/login`

请求：

```ts
type WechatLoginRequest = {
  code: string
  nickname?: string
  avatar?: string
}
```

响应：

```ts
type WechatLoginResponse = ApiResponse<{
  token: string
  user: {
    user_id: string
    name: string
    avatar?: string
    openid_bound: true
  }
}>
```

### 7.3 后端数据结构建议

不建议直接把 `openid` 写入 `students` 主表，建议新增映射表：

```sql
CREATE TABLE IF NOT EXISTS wechat_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT NOT NULL UNIQUE,
  unionid TEXT DEFAULT '',
  user_id TEXT NOT NULL,
  session_key_hash TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

用户创建策略：

- 若 `openid` 已存在，复用映射的 `user_id`。
- 若不存在，生成 `user_id = 'wx_' + hash(openid)`。
- 在 `students` 中插入最小用户信息：`user_id`、`name`、`avatar`、`created_at`、`updated_at`。
- 返回 `create_access_token(user_id)` 生成的 JWT。

### 7.4 兼容现有单用户模式

当前业务代码仍大量使用 `settings.single_user_id`。为了微信登录真正隔离用户数据，后续需要将业务接口逐步改为从 `get_current_user` 获取 `user_id`。本期技术设计要求：

- 登录接口先返回真实 JWT。
- 小程序请求统一带 token。
- 若后端仍处于兼容模式，则数据仍可能落到 `single_user`，这是后端改造风险，不由小程序端绕开。
- 验收时需明确当前运行模式：演示单用户模式或真实多用户模式。

## 8. API Client 设计

### 8.1 统一响应类型

现有后端常用 `ok(...)` 包装，前端按如下类型处理：

```ts
export type ApiResponse<T> = {
  ok: boolean
  data: T
  error?: string
  message?: string
}
```

### 8.2 请求封装

```ts
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string
  data?: unknown
  header?: Record<string, string>
  skipAuth?: boolean
}
```

统一逻辑：

- 自动拼接 `TARO_APP_API_BASE_URL`。
- 自动注入 `Authorization`。
- 处理 `401`：清理 token，重新发起微信登录。
- 处理网络错误：抛出可展示错误。
- 对业务错误统一转换为 `AppError`。

## 9. AI 助学设计

### 9.1 页面目标

为学生提供多智能体辅助对话能力，支持围绕学习问题进行多角色讨论、可信回答和可追溯解释。

### 9.2 页面结构

```text
顶部区域
  当前对话标题
  导师角色选择入口
  新建对话按钮

消息区域
  用户消息
  AI 消息
  Markdown 内容
  可信度标识
  引用来源
  多智能体研讨折叠面板
  MCP 调用摘要

附件区域
  图片附件预览
  文件附件列表

底部输入区
  文本输入框
  语音输入按钮
  图片上传按钮
  文件上传按钮
  多角色研讨开关
  MCP 开关
  发送按钮
```

### 9.3 使用接口

| 能力 | 接口 | 用途 |
| --- | --- | --- |
| 获取导师角色 | `GET /api/tutor/roles` | 只展示可选角色 |
| 获取对话列表 | `GET /api/tutor/conversations` | 最近对话列表 |
| 创建对话 | `POST /api/tutor/conversations` | 新建对话 |
| 更新对话 | `PUT /api/tutor/conversations/{conversation_id}` | 修改标题或角色 |
| 删除对话 | `DELETE /api/tutor/conversations/{conversation_id}` | 删除对话 |
| 获取消息 | `GET /api/tutor/messages` | 加载当前对话消息 |
| 上传文件 | `POST /api/tutor/files` | 上传 txt/md/pdf 等可索引文件 |
| 获取文件列表 | `GET /api/tutor/files` | 展示已上传文件 |
| 发送消息 | `POST /api/tutor/chat` | 真实流式对话 |
| 获取历史 | `GET /api/tutor/history` | 历史辅助数据 |

### 9.4 请求类型

```ts
export type TutorChatRequest = {
  message: string
  mode?: 'knowledge_qa' | string
  conversation_id?: number
  role_id?: number
  file_ids?: number[]
  page_context?: Record<string, unknown>
  workshop_enabled?: boolean
  workshop_role_ids?: number[]
  open_mode?: boolean
  web_search?: boolean
  mcp_enabled?: boolean
  model?: string
}
```

小程序默认：

```ts
const req: TutorChatRequest = {
  message,
  mode: 'knowledge_qa',
  conversation_id,
  role_id,
  file_ids,
  page_context,
  workshop_enabled,
  workshop_role_ids: [],
  mcp_enabled,
}
```

### 9.5 流式输出解析

后端返回 `text/event-stream`，每个 chunk 形如：

```text
data: {"type":"text","payload":{"content":"一段内容"}}

```

前端必须实现真实流式输出。建议封装 `requestSse`：

```ts
export type TutorStreamEvent =
  | { type: 'text'; payload: { content: string } }
  | { type: 'meta'; payload: Record<string, unknown> }
  | { type: 'confidence'; payload: ConfidencePayload }
  | { type: 'citations'; payload: { items: Citation[] } }
  | { type: 'trust_meta'; payload: TrustMeta }
  | { type: 'workshop_meta'; payload: Record<string, unknown> }
  | { type: 'workshop_phase'; payload: WorkshopPhase }
  | { type: 'hub'; payload: HubMessage }
  | { type: 'mcp_call'; payload: McpCall }
  | { type: 'sources'; payload: { items: Citation[] } }
  | { type: 'done'; payload: Record<string, unknown> }
  | { type: 'error'; payload: { message?: string; detail?: string } }
```

实现要求：

- 使用支持 chunk 回调的请求能力读取响应。
- 将二进制 chunk 解码为字符串。
- 按 `\n\n` 拆分 SSE 事件。
- 提取 `data:` 后的 JSON。
- `text` 事件追加到当前 AI 消息。
- `hub`、`workshop_phase` 更新研讨面板。
- `confidence` 更新可信度徽标。
- `citations`、`sources` 更新引用列表。
- `mcp_call` 或 `trust_meta.mcp_calls` 更新 MCP 摘要。
- `error` 保留已输出内容并展示重试入口。

### 9.6 多智能体研讨展示

前端不选择 `workshop_role_ids`，只提供“多角色研讨”开关：

- 关闭：`workshop_enabled=false`。
- 开启：`workshop_enabled=true`，`workshop_role_ids=[]`，由后端使用默认参与角色。

UI 展示：

- 默认折叠。
- 标题展示当前阶段：画像分析、讨论、第 N 轮、综合。
- 展开后显示角色名称、阶段、摘要内容。
- 不显示模型 prompt、内部推理或技术日志。

### 9.7 MCP 展示

小程序提供 MCP 开关：

- 关闭：`mcp_enabled=false`。
- 开启：`mcp_enabled=true`。

展示粒度：

- 工具名称。
- 调用状态：调用中、成功、失败。
- 结果摘要。

不展示：

- 原始请求参数。
- 原始返回 JSON。
- 服务端内部错误堆栈。
- 耗时等技术指标。

### 9.8 语音输入

语音输入走小程序端转文本：

1. 用户长按或点击录音。
2. 使用微信录音能力采集音频。
3. 调用微信同声传译/语音识别插件得到文本。
4. 将识别文本填入输入框。
5. 用户确认后发送 `/api/tutor/chat`。

语音文件本身不上传到 SparkLearn 后端。

### 9.9 图片上传

图片上传只用于附件展示和对话上下文提示，不进入 AI 理解：

- 用户选择图片后，前端展示缩略图。
- 发送消息时，图片不作为 `file_ids` 传给后端。
- 可在 `page_context.attachments` 中记录图片文件名、尺寸、数量等非敏感摘要。
- AI 回答中不得声称“已查看图片内容”。

### 9.10 文件上传

文件上传复用 `/api/tutor/files`：

- 支持 `txt`、`md`、`pdf` 等文本可解析文件。
- 上传成功后获得 `file_id`。
- 发送消息时传入 `file_ids`。
- 后端会检索文件片段并以 `sources` / `citations` 形式返回。

文件上传限制建议：

| 项 | 建议 |
| --- | --- |
| 单文件大小 | 10 MB 以内 |
| 单次数量 | 3 个以内 |
| 类型 | `txt/md/pdf` |
| 图片 | 不走此接口进入 AI 理解 |

## 10. 刷题设计

### 10.1 页面目标

提供轻量、高频练习入口，让用户按主题生成题目、逐题作答、即时判题、查看解析并进入 AI 追问。

### 10.2 页面结构

```text
顶部
  主题输入，默认 Python 基础
  题目数量选择
  生成题目按钮

中部
  当前题号 / 总题数
  题型标签
  知识点标签
  题目内容
  选项或填空输入

底部
  提交
  下一题
  收藏
  问 AI
```

### 10.3 使用接口

| 能力 | 接口 |
| --- | --- |
| 获取/生成题目 | `GET /api/quiz?chapter=Python%20基础&count=4&use_llm=true` |
| 提交答案 | `POST /api/quiz/submit` |
| 收藏题目 | `POST /api/quiz/favorites` |

### 10.4 字段类型

```ts
export type QuizType = 'single' | 'multiple' | 'fill_blank'

export type QuizQuestion = {
  id: string
  type: QuizType
  content: string
  options?: string[] | null
  knowledge_point_id?: string
  knowledge_point_name?: string
}

export type GetQuizParams = {
  chapter?: string
  count?: number
  use_llm?: boolean
}

export type SubmitQuizRequest = {
  quiz_id: string
  answer: string | string[]
}

export type SubmitQuizResult = {
  quiz_id: string
  correct: boolean
  correct_answer: string | string[]
  explanation: string
  knowledge_point_id: string
  mastery_delta: number
  current_mastery: number
}

export type FavoriteQuizRequest = {
  quiz_id: string
  favorite: boolean
}
```

### 10.5 交互流程

1. 进入刷题页。
2. 默认主题为 `Python 基础`。
3. 用户设置题目数量。
4. 点击生成，调用 `GET /api/quiz`，默认 `use_llm=true`。
5. 前端展示第一题。
6. 用户作答。
7. 每题点击提交，调用 `POST /api/quiz/submit`。
8. 展示正确/错误、正确答案、解析、掌握度变化。
9. 用户可收藏题目。
10. 用户可点击“问 AI”，无论答对或答错。
11. 点击下一题继续。

### 10.6 题目数量

后端当前 `GET /api/quiz` 注释说明 `count` 支持 `1-50`，默认 `4`。小程序建议：

- 默认：4。
- 最小：1。
- 最大：20。
- 若需要完整使用后端能力，可在设置中允许到 50；主流程不建议过大，避免移动端等待时间过长。

### 10.7 问 AI 上下文模板

```text
请讲解这道题：

题目：{question}
题型：{type}
知识点：{knowledgePointName}
我的答案：{userAnswer}
正确答案：{correctAnswer}
解析：{explanation}

请先指出关键考点，再说明我的答案为什么对/错，最后给一个类似练习建议。
```

## 11. 我的设计

### 11.1 页面目标

集中展示个人学习数据、复盘入口和设置能力，不抢占 AI 与刷题主流程注意力。

### 11.2 页面结构

```text
顶部
  用户头像
  用户昵称
  学习状态摘要

数据概览
  正确率
  累计答题
  错题数
  收藏数

学习画像
  目标
  基础水平
  薄弱点
  学习偏好

掌握度
  知识点掌握度列表

复盘入口
  答题记录
  错题本
  收藏题

设置入口
```

### 11.3 使用接口

| 能力 | 接口 |
| --- | --- |
| 学习画像 | `GET /api/profile` |
| 答题统计 | `GET /api/quiz/records/stats` |
| 答题记录 | `GET /api/quiz/records` |
| 错题本 | `GET /api/quiz/wrong` |
| 收藏题 | `GET /api/quiz/favorites` |
| 贡献日历 | `GET /api/contribution` |
| 掌握度 | `GET /api/mastery` |
| 学习统计 | `GET /api/dashboard/stats` |

### 11.4 子页面

#### 答题记录

- 路径：`pages/mine-records/index`。
- 展示答题时间、题目摘要、用户答案、是否正确、知识点。
- 支持删除记录：`DELETE /api/quiz/records/{quiz_id}`。

#### 错题本

- 路径：`pages/mine-wrong/index`。
- 展示错题分组、错误次数、最近错误时间。
- 支持删除错题：`DELETE /api/quiz/wrong/{quiz_id}`。
- 支持问 AI。

#### 收藏题

- 路径：`pages/mine-favorites/index`。
- 展示收藏题列表。
- 支持取消收藏：`POST /api/quiz/favorites`，`favorite=false`。
- 支持问 AI。

### 11.5 设置页

设置页包含：

- 账号信息。
- 后端地址查看/切换。
- 清缓存。
- 隐私协议。
- 退出登录。

退出登录流程：

1. 调用 `POST /api/auth/logout`。
2. 清理本地 token、用户信息、业务缓存。
3. 回到 `AI助学` 或登录引导状态。

## 12. 状态管理

### 12.1 Auth Store

```ts
type AuthState = {
  token: string
  user?: CurrentUser
  loginStatus: 'unknown' | 'logging_in' | 'logged_in' | 'guest' | 'error'
}
```

### 12.2 Tutor Store

```ts
type TutorState = {
  conversations: TutorConversation[]
  currentConversationId?: number
  roles: TutorRole[]
  currentRoleId?: number
  messages: TutorMessage[]
  streaming: boolean
  streamError?: string
  workshopEnabled: boolean
  mcpEnabled: boolean
  pendingFileIds: number[]
  pendingImages: LocalImageAttachment[]
}
```

### 12.3 Quiz Store

```ts
type QuizState = {
  chapter: string
  count: number
  questions: QuizQuestion[]
  currentIndex: number
  answers: Record<string, string | string[]>
  results: Record<string, SubmitQuizResult>
  favorites: Record<string, boolean>
  loading: boolean
  error?: string
}
```

### 12.4 Profile Store

```ts
type ProfileState = {
  profile?: LearningProfile
  stats?: QuizStats
  mastery: MasteryItem[]
  records: QuizRecord[]
  wrongItems: WrongQuizItem[]
  favorites: FavoriteQuizItem[]
  loadedAt?: number
}
```

## 13. UI/UX 规范

### 13.1 视觉方向

参考 `Dorc/材料文档/SparkLearn-UIUX设计说明与视觉风格.md`：

- 浅蓝科技感 + Apple Pure 克制风格。
- 白色与浅灰蓝作为主背景。
- 主色使用蓝色，AI 功能可少量使用紫色。
- 正确为绿色，警告/中可信为橙色，错误/低可信为红色。
- 页面信息层级控制在 3 层以内。
- 卡片圆角克制，避免过度装饰。

### 13.2 小程序适配

- 使用底部 3 Tab，不沿用桌面侧边栏。
- 页面主体单列布局。
- 重要操作固定在底部安全区以上。
- 使用骨架屏承接加载。
- 空状态提供明确下一步动作。
- 错误态提供重试。

### 13.3 可信度标识

| 可信度 | 颜色 | 展示 |
| --- | --- | --- |
| 高可信 | 绿色 | 小圆点 + `高可信` |
| 中可信 | 橙色 | 小圆点 + `中可信` |
| 低可信 | 红色 | 小圆点 + `低可信` |

### 13.4 图标

小程序端不强依赖 Lucide。可使用：

- Taro UI 图标。
- 微信小程序 icon。
- 本地轻量 SVG/PNG 图标。

要求：

- 图标只作为辅助，不单独承担含义。
- 关键操作保留文字标签。
- Tab 图标风格保持线性、简洁。

## 14. 异常与降级

| 场景 | 处理 |
| --- | --- |
| 后端不可用 | 展示错误态和重试按钮 |
| 登录失败 | 允许重新微信登录，展示失败原因 |
| token 过期 | 自动重新登录一次，失败则清理状态 |
| AI 流式中断 | 保留已输出内容，显示“继续重试” |
| AI 返回 error 事件 | 停止 streaming，展示错误提示 |
| 题目为空 | 展示空状态，引导重新生成 |
| LLM 生成慢 | 显示生成中状态，不阻塞页面切换 |
| 文件上传失败 | 保留输入内容，允许重新上传 |
| 语音识别失败 | 提示重新录音或改用文本输入 |
| 图片上传 | 仅本地预览，不承诺 AI 理解 |
| 我的数据为空 | 展示新用户引导 |

## 15. 安全与隐私

- 微信 `session_key` 不返回前端。
- JWT 存储在小程序本地缓存中。
- API 请求统一使用 HTTPS 域名。
- 文件上传限制大小和类型。
- 图片附件只做本地展示或普通附件记录，不进入 AI 理解。
- 隐私协议页需说明：
  - 收集微信登录标识用于账号识别。
  - 学习问题、答题记录、上传文件会用于提供学习辅助。
  - 语音输入转文本依赖微信能力或插件能力。
  - 用户可清除本地缓存和退出登录。

## 16. 测试方案

### 16.1 单元测试

| 模块 | 用例 |
| --- | --- |
| `sseParser` | 正常 data 解析、半包解析、多事件解析、非法 JSON 忽略 |
| `apiClient` | token 注入、401 处理、网络错误转换 |
| `quizStore` | 单选、多选、填空答案状态 |
| `markdown` | 标题、列表、代码块、表格渲染输入转换 |

### 16.2 集成测试

| 链路 | 验证 |
| --- | --- |
| 微信登录 | `Taro.login` -> `/api/auth/wechat/login` -> token 存储 |
| AI 对话 | 创建对话 -> 发送消息 -> 流式展示 -> 完成态 |
| AI 文件 | 上传文件 -> 获得 file_id -> 携带 file_ids 发送 |
| 刷题 | 生成题目 -> 作答 -> 提交 -> 解析 -> 下一题 |
| 问 AI | 刷题结果 -> 构造上下文 -> 跳转 AI |
| 我的 | 加载统计、画像、掌握度、记录、错题、收藏 |

### 16.3 端到端验收

使用微信开发者工具进行：

- iPhone 小屏。
- 常规 iPhone 屏。
- Android 常规屏。
- 网络慢速模拟。
- 后端接口失败模拟。
- AI 流式中断模拟。

## 17. 验收 Checklist

### 17.1 信息架构

- [ ] 底部导航只有 3 个 Tab。
- [ ] Tab 顺序为 `AI助学 / 刷题 / 我的`。
- [ ] 不出现首页入口。
- [ ] 不出现知识图谱入口。
- [ ] 不出现学习伙伴宠物化内容。
- [ ] 不出现 `/api/agent` 任务系统入口。

### 17.2 登录

- [ ] 首次进入可触发微信登录。
- [ ] 登录成功后本地保存 token。
- [ ] 请求自动携带 `Authorization`。
- [ ] token 失效后可重新登录。
- [ ] 设置页可退出登录。

### 17.3 AI 助学

- [ ] 可加载导师角色。
- [ ] 可选择已有角色或默认角色。
- [ ] 可加载对话列表。
- [ ] 可创建新对话。
- [ ] 可加载对话消息。
- [ ] 可发送文本问题。
- [ ] 可语音转文本后发送。
- [ ] 可选择图片并预览，但不声明 AI 已理解图片。
- [ ] 可上传文本类文件并携带 `file_ids`。
- [ ] 可开启/关闭多角色研讨。
- [ ] 可开启/关闭 MCP。
- [ ] 可真实流式展示 AI 输出。
- [ ] 可展示多智能体研讨过程。
- [ ] 可展示可信度。
- [ ] 可展示引用来源。
- [ ] 可展示 MCP 工具名称与结果摘要。
- [ ] 流式中断时保留已输出内容。

### 17.4 刷题

- [ ] 默认主题为 `Python 基础`。
- [ ] 可设置题目数量。
- [ ] 默认 `use_llm=true`。
- [ ] 可生成题目。
- [ ] 支持单选题。
- [ ] 支持多选题。
- [ ] 支持填空题。
- [ ] 每题可即时提交判题。
- [ ] 可展示正确答案。
- [ ] 可展示解析。
- [ ] 可展示知识点。
- [ ] 可收藏/取消收藏。
- [ ] 答对和答错后都可问 AI。

### 17.5 我的

- [ ] 可查看学习画像。
- [ ] 可查看答题统计。
- [ ] 可查看掌握度。
- [ ] 可进入答题记录子页面。
- [ ] 可进入错题本子页面。
- [ ] 可进入收藏题子页面。
- [ ] 可进入设置页。
- [ ] 可查看账号信息。
- [ ] 可清缓存。
- [ ] 可查看后端地址。
- [ ] 可查看隐私协议。

## 18. 开发任务拆分

### P0 基础工程

1. 初始化 Taro 小程序工程。
2. 配置 TypeScript、SCSS、路径别名。
3. 配置三 Tab 路由。
4. 实现环境配置读取。
5. 实现基础 UI 组件：加载、空状态、错误态。

### P1 登录与网络

1. 后端新增 `POST /api/auth/wechat/login`。
2. 后端新增 `wechat_accounts` 映射表。
3. 后端补齐 `WECHAT_MINI_APPID / WECHAT_MINI_SECRET` 配置。
4. 小程序实现微信登录。
5. 实现 `apiClient` 和 token 注入。

### P2 刷题闭环

1. 实现刷题页面。
2. 接入 `GET /api/quiz`。
3. 接入 `POST /api/quiz/submit`。
4. 接入收藏接口。
5. 实现问 AI 上下文构造。

### P3 AI 基础对话

1. 实现对话列表与消息加载。
2. 实现导师角色选择。
3. 实现文本输入与发送。
4. 实现真实流式 SSE 解析。
5. 实现 Markdown 渲染。
6. 实现可信度和引用展示。

### P4 AI 增强输入

1. 实现语音转文本输入。
2. 实现图片选择与预览。
3. 实现文件上传。
4. 实现多角色研讨面板。
5. 实现 MCP 开关和摘要面板。

### P5 我的与设置

1. 实现个人中心概览。
2. 实现答题记录子页面。
3. 实现错题本子页面。
4. 实现收藏题子页面。
5. 实现设置页。
6. 实现隐私协议页。

### P6 测试与验收

1. 单元测试。
2. 微信开发者工具多机型测试。
3. 后端失败与流式中断测试。
4. 根据验收 checklist 修复问题。

## 19. 风险与处理

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| 微信登录需要后端补齐 | 无法真实账号登录 | 将登录接口列为 P1 必做 |
| 现有业务接口使用 `single_user_id` | 多用户数据可能不隔离 | 登录先落地，业务多用户化作为后端后续风险项 |
| 小程序流式能力存在版本差异 | AI 输出可能无法实时展示 | 选定最低微信基础库版本并在开发者工具验证 chunk 回调 |
| 语音识别依赖插件 | 插件不可用会影响语音输入 | 文本输入始终作为可用主路径 |
| 图片不进入 AI 理解 | 用户可能误以为 AI 看图 | UI 文案明确“图片仅作附件展示” |
| LLM 生成题目较慢 | 刷题启动等待变长 | 展示生成中状态，允许取消/重试 |
| Markdown 小程序兼容性 | 表格/代码块渲染异常 | 选用小程序兼容渲染组件并做内容降级 |

## 20. 交付结论

本设计将小程序收敛为三条主线：

- `AI助学`：真实流式、多智能体、可信回答、MCP 摘要、语音转文本、文件辅助。
- `刷题`：主题生成、逐题即时判题、解析反馈、收藏、问 AI。
- `我的`：学习画像、统计、掌握度、答题记录、错题本、收藏题、设置。

除微信登录最小后端补齐外，业务能力复用当前 SparkLearn 后端接口。图片上传在本期只作为附件展示，不进入 AI 理解链路；语音输入在小程序端转文本后进入现有 AI 对话链路。
