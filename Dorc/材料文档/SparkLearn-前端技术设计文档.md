# SparkLearn 前端技术设计文档

> **文档状态：** 整体可运行，持续迭代优化中
> **对应分支：** `develop-deeply-system`
> **最后更新：** 2026-05-29

---

## 目录

1. [技术栈](#1-技术栈) ✅
2. [项目结构](#2-项目结构) ✅
3. [API 层设计](#3-api-层设计) ✅
4. [路由与页面说明](#4-路由与页面说明) ✅
5. [组件设计](#5-组件设计) ✅
6. [多模态资源技术实现](#6-多模态资源技术实现) ✅
7. [前端状态管理](#7-前端状态管理) ✅
8. [性能优化](#8-性能优化) 🔲
9. [待实现规划](#9-待实现规划) 🔲

---

## 1. 技术栈 ✅

### 1.1 核心框架

**Next.js 16 (App Router)** — 选用 Next.js 16 作为全栈框架（基于 `frontend/package.json` 确认为 `next: 16.2.4`），核心考量如下：

- **App Router**：采用文件系统路由，支持 React Server Components 与 Client Components 混合渲染模型。通过路由组 `(shell)`、`(teacher)` 实现主应用和教师端的分组隔离，无需创建额外的物理路由层级。
- **Server Components 默认**：大部分页面数据获取在服务端完成，减少客户端 JavaScript 体积，首屏渲染性能优秀。
- **Streaming SSR**：SSE（Server-Sent Events）与 App Router 的流式响应能力天然契合，智能辅导对话和资源生成进度均受益于此。
- **Route Groups 与 Parallel Routes**：`(shell)` 包裹主用户端页面，`(teacher)` 包裹教师管理端页面，路由组不参与 URL 路径，使页面路径保持干净。

**React 19** — `react: 19.2.4`，支持最新的 React Server Components（RSC）、`use` hook 等特性。项目中大量页面为 `'use client'` 组件（如 `tutor/page.tsx`、`mcp-store/page.tsx`、`onboarding/page.tsx`），因为涉及复杂的客户端交互状态（实时对话流、文件上传、语音识别等）。

### 1.2 样式与 UI

**Tailwind CSS 4** — `tailwindcss: ^4`，在 `frontend/src/app/globals.css` 中通过 `@import "tailwindcss"` 导入。使用 CSS 自定义属性（`@theme inline`）定义完整的设计系统 Token：

- **色彩系统**：`--color-bg: #f6f8fb`（页面背景）、`--color-bg-card: #ffffff`（卡片白）、`--color-blue: #2563eb`（主蓝色）、`--color-ink: #111827`（主文字色）
- **字体大小**：从 `--text-micro: 12px` 到 `--text-display: 34px` 共 8 级
- **圆角**：`--radius-sm: 8px` 到 `--radius-xl: 14px`
- **阴影**：`--shadow-sm`、`--shadow-md`、`--shadow-lg` 三级

```css
/* frontend/src/app/globals.css 中的设计 Token */
@theme inline {
  --color-bg: #f6f8fb;
  --color-bg-card: #ffffff;
  --color-blue: #2563eb;
  --color-ink: #111827;
  --color-line: #e5e7eb;
  --color-green: #16a34a;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-purple: #8b5cf6;
}
```

**styled-components** — `styled-components: ^6.1.13`，用于需要复杂 CSS 动画的自定义组件，如 `TypewriterLoader.tsx` 中的打字机动效和全局 `AIAssistant.tsx` 的悬浮助手容器样式。仅在动画密集型组件中使用，不替代 Tailwind 作为主样式方案。

### 1.3 关键依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `lucide-react` | ^1.11.0 | 图标库，提供 1000+ SVG 图标，项目中所有页面 icon 均来自此库 |
| `react-markdown` | ^10.1.0 | Markdown 渲染引擎，将 AI 回复中的 Markdown 文本渲染为 HTML |
| `remark-gfm` | ^4.0.1 | remark 插件，扩展 Github Flavored Markdown 支持（表格/任务列表/删除线） |
| `echarts` | ^5.6.0 | 数据可视化库，用于学习画像的能力雷达图（`UserRadar` 组件） |
| `@uiw/react-codemirror` | ^4.25.9 | 代码编辑器组件，用于代码类型资源的展示 |
| `zustand` | ^5.0.12 | 轻量级状态管理库（全局资源生成状态共享） |

---

## 2. 项目结构 ✅

### 2.1 实际目录树

基于 `frontend/src/` 的完整文件结构、路由注册和实际开发情况，项目组织结构如下：

```
frontend/
├── package.json            # Next.js 16.2.4, React 19, Tailwind CSS 4
├── tsconfig.json
├── next.config.mjs
├── public/
│   ├── sparklearn-logo-official.png
│   └── gongzuotai-bg.png   # 背景纹理图
└── src/
    ├── app/
    │   ├── layout.tsx               # 根布局：字体声明、元数据
    │   ├── globals.css              # 全局样式 + Tailwind @theme Token
    │   ├── auth/
    │   │   └── page.tsx             # 登录/认证页
    │   ├── onboarding/
    │   │   └── page.tsx             # 画像建档（多步骤卡片引导）
    │   ├── plaza/                   # 学习广场（论坛）
    │   │   ├── layout.tsx           # 广场布局（PlazaSidebar）
    │   │   ├── page.tsx             # 广场首页
    │   │   ├── [postId]/page.tsx    # 帖子详情
    │   │   ├── experience-share/    # 经验分享分区
    │   │   ├── history/             # 浏览历史
    │   │   ├── my-comments/         # 我的评论
    │   │   ├── my-likes/            # 我的点赞
    │   │   ├── qa/                  # 问答分区
    │   │   ├── resource-share/      # 资源共享分区
    │   │   └── team-study/          # 组队学习分区
    │   ├── (shell)/                 # 主应用 Layout 包裹（不影响 URL）
    │   │   ├── layout.tsx           # Sidebar + Topbar + AIAssistant + 移动端适配
    │   │   ├── page.tsx             # 首页 - 学习工作台
    │   │   ├── profile/
    │   │   │   ├── page.tsx         # 学习画像（雷达图 + 四卡网格）
    │   │   │   └── settings/
    │   │   │       └── page.tsx     # 画像编辑表单
    │   │   ├── path/
    │   │   │   └── page.tsx         # 个性化学习路径（知识图谱 + 节点建议）
    │   │   ├── generate/
    │   │   │   └── page.tsx         # 资源生成中心（多智能体协同）
    │   │   ├── knowledge/
    │   │   │   └── page.tsx         # 个人知识库（资料上传/索引/检索）
    │   │   ├── practice/
    │   │   │   ├── page.tsx         # 练习评测主页
    │   │   │   ├── mistakes/        # 错题本
    │   │   │   ├── favorites/       # 收藏题目
    │   │   │   └── records/         # 练习记录
    │   │   ├── report/
    │   │   │   └── page.tsx         # 学习报告（周/日/月周期）
    │   │   ├── agent/
    │   │   │   └── page.tsx         # 学习伙伴（AI 宠物系统）
    │   │   ├── feed/                # 资源推送（已并入首页推荐区）
    │   │   ├── video/
    │   │   │   └── page.tsx         # 视频资源中心
    │   │   └── forum/               # 学习论坛
    │   │       ├── page.tsx         # 论坛首页
    │   │       └── new/
    │   │           └── page.tsx     # 发布帖子
    │   ├── (teacher)/               # 教师端 Layout（不影响 URL）
    │   │   ├── layout.tsx
    │   │   └── teacher/
    │   │       ├── layout.tsx       # 教师端二级 Layout
    │   │       ├── page.tsx         # 教师端入口
    │   │       ├── login/           # 教师登录
    │   │       ├── dashboard/       # 教师大屏
    │   │       ├── broadcast/       # 教师广播（学情通知）
    │   │       ├── students/        # 学生管理
    │   │       │   └── [id]/        # 学生详情
    │   │       ├── reports/         # 学情报表
    │   │       ├── interventions/   # 学习干预
    │   │       └── ai/              # AI 辅助教学
    │   └── tutor/                   # 智能辅导模块（独立 Layout）
    │       ├── page.tsx             # 主辅导页（三栏布局+多模态对话）
    │       ├── mcp-store/
    │       │   ├── page.tsx         # MCP 插件商店
    │       │   └── docs/
    │       │       └── page.tsx     # MCP 文档页
    │       ├── workshop/
    │       │   └── page.tsx         # 多智能体研讨工坊
    │       ├── knowledge/
    │       │   └── page.tsx         # 知识库管理（tutor 侧）
    │       ├── files/
    │       │   └── page.tsx         # 文件管理
    │       └── roles/
    │           └── page.tsx         # 角色管理（角色工坊）
    ├── components/
    │   ├── ui/                      # 基础 UI 组件
    │   │   ├── Button.tsx           # 通用按钮（primary/secondary/ghost + sm/md/lg）
    │   │   ├── Badge.tsx            # 标签/状态徽章
    │   │   ├── Card.tsx             # 通用卡片容器
    │   │   ├── Input.tsx            # 通用输入框
    │   │   ├── ProgressBar.tsx      # 进度条
    │   │   ├── ProgressRing.tsx     # 圆形进度环
    │   │   ├── Skeleton.tsx         # 骨架屏加载
    │   │   ├── EmptyState.tsx       # 空状态提示
    │   │   ├── ErrorState.tsx       # 错误状态（server/network/generic）
    │   │   ├── TypewriterLoader.tsx # 打字机加载动画
    │   │   ├── IconBlock.tsx        # 图标块组件
    │   │   ├── ThirdPartyIcons.tsx  # 第三方图标
    │   │   └── AudioRadio.tsx       # 音频播放控件
    │   ├── layout/                  # 布局组件
    │   │   ├── Sidebar.tsx          # 侧边栏导航（分组+折叠）
    │   │   ├── Topbar.tsx           # 顶部面包屑栏
    │   │   ├── AIAssistant.tsx      # 全局 AI 悬浮助手
    │   │   ├── AISprite.tsx         # AI 精灵组件
    │   │   └── navigation.tsx      # 页面元数据定义（PAGE_META / MOBILE_TABS）
    │   ├── agent/                   # AI 宠物相关组件
    │   │   ├── PetAvatar.tsx        # 宠物头像（8 种造型）
    │   │   ├── AdoptionFlow.tsx     # 领养流程
    │   │   ├── AgentChat.tsx        # 宠物对话界面
    │   │   ├── AgentHistory.tsx     # 任务历史
    │   │   └── AgentPetCard.tsx     # 宠物卡片
    │   ├── plaza/                   # 学习广场组件
    │   │   ├── PlazaSidebar.tsx     # 广场侧边栏
    │   │   └── BoardModulePage.tsx  # 广场板块模块
    │   ├── proto/                   # 原型设计系统组件
    │   │   └── index.tsx            # PageHead/Pill/ProtoButton/ProtoCard/SoftCard
    │   ├── providers/
    │   │   └── GenerationTaskProvider.tsx  # 资源生成任务全局状态管理
    │   ├── brand/
    │   │   └── BrandLogo.tsx        # 品牌 Logo 组件
    │   └── dashboard/
    │       └── UserRadar.tsx        # 用户能力雷达图（echarts）
    └── lib/
        ├── api/
        │   ├── types.ts            # 所有 TypeScript 类型定义（~560 行）
        │   ├── real.ts             # 真实 API 实现（~1270 行）
        │   └── index.ts            # 统一导出 api 对象 + 类型 re-export
        ├── utils/
        │   └── cn.ts               # className 合并工具（基于 clsx/twMerge）
        └── hooks/
            ├── useMediaQuery.ts    # 响应式断点检测
            └── useLocalStorage.ts  # 本地存储 hook
```

### 2.2 关键路径说明

**布局架构**：项目采用两级 Layout 嵌套。根 Layout (`app/layout.tsx`) 负责字体加载（DM Sans + Noto Sans SC）和 HTML 元数据（标题、图标）。主应用页面由 `(shell)/layout.tsx` 包裹，提供 Sidebar + Topbar + AIAssistant 三件套。`tutor/` 和 `onboarding/` 路径不经过 `(shell)` layout，各自拥有独立的页面布局（如 tutor 使用自建的左中右三栏布局）。

**路由组的实际行为**：`(shell)` 和 `(teacher)` 路由组不参与 URL 路径。例如文件位于 `(shell)/page.tsx`，实际路由就是 `/`；文件位于 `(teacher)/teacher/dashboard/page.tsx`，实际路由就是 `/teacher/dashboard`。这种设计使路由结构兼顾组织性和 URL 简洁性。

---

## 3. API 层设计 ✅

### 3.1 三层架构

前端 API 层采用 **类型层 → 实现层 → 导出层** 的三段式设计：

```
lib/api/
├── types.ts    # 纯类型定义，无任何运行时依赖
├── real.ts     # 运行时实现，import types + fetch/SSE 逻辑
└── index.ts    # 统一导出 api 对象 + 所有类型
```

页面/组件通过统一入口导入：

```typescript
import { api, Message, TutorRole, Resource } from '@/lib/api'
```

### 3.2 统一 API 客户端模式

`real.ts` 中封装了底层 HTTP 通信逻辑，核心是两个函数：

**`fetchJson<T>(path, init?)`** — 标准 JSON 请求/响应：
- 自动拼接 `API_BASE`（默认 `http://127.0.0.1:8000`，通过 `NEXT_PUBLIC_API_BASE_URL` 环境变量可配置）
- 强制设置 `Content-Type: application/json`
- 解析统一响应结构 `{ success, data, error }`，`!success` 或 HTTP 错误均抛出 Error
- 特殊处理 `Failed to fetch`（网络不可达），给出友好提示

**`readSSE(path, body, onEvent?)`** — SSE 流式数据处理：
- 使用 `fetch` + `ReadableStream.getReader()` 原始流读取
- `TextDecoder` 逐片解码，按 `\n\n` 分割事件帧
- 提取 `data: {...}` 行并 `JSON.parse`
- 通过 `onEvent` 回调将所有事件实时推送给调用方
- 返回完整事件数组给调用方做后续处理

```typescript
// frontend/src/lib/api/real.ts 中的 SSE 核心实现
async function readSSE(
  path: string,
  body: Record<string, unknown>,
  onEvent?: (evt: SseEvent) => void,
) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.body) throw new Error('流式响应体为空')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const events: SseEvent[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() || ''
    for (const c of chunks) {
      const line = c.split('\n').find(l => l.startsWith('data: '))
      if (!line) continue
      const evt = JSON.parse(line.slice(6)) as SseEvent
      events.push(evt)
      onEvent?.(evt)
    }
  }
  return events
}
```

### 3.3 real.ts 实现的核心接口映射

| 前端方法 (`api.xxx`) | 请求方式 | 后端路由 | 说明 |
|---|---|---|---|
| `api.getTodayTasks()` | GET | `/api/tasks/today` | 获取今日学习任务 |
| `api.getDashboardStats()` | GET | `/api/dashboard/stats` | 工作台统计（学习时长、完成率、正确率） |
| `api.getProfile()` | GET | `/api/profile` | 获取学习画像 |
| `api.updateProfile(payload)` | PUT | `/api/profile` | 更新画像（camelCase → snake_case 映射） |
| `api.getResources()` | GET | `/api/resources` | 获取资源列表 |
| `api.generateResource(type, prompt)` | POST SSE | `/api/resources/generate` | 生成资源（SSE 流式） |
| `api.sendMessage(content, options, handlers)` | POST SSE | `/api/tutor/chat` | 发送辅导消息（SSE 流式 + 多回调） |
| `api.getChatHistory(conversationId)` | GET | `/api/tutor/history` | 获取对话历史 |
| `api.getTutorRoles()` | GET | `/api/tutor/roles` | 获取辅导角色列表 |
| `api.createTutorRole(payload)` | POST | `/api/tutor/roles` | 创建辅导角色 |
| `api.updateTutorRole(id, payload)` | PUT | `/api/tutor/roles/{id}` | 更新辅导角色 |
| `api.deleteTutorRole(id)` | DELETE | `/api/tutor/roles/{id}` | 删除辅导角色 |
| `api.getTutorConversations()` | GET | `/api/tutor/conversations` | 获取会话列表 |
| `api.createTutorConversation(payload)` | POST | `/api/tutor/conversations` | 创建会话 |
| `api.uploadTutorFiles(files)` | POST (FormData) | `/api/tutor/files` | 上传辅导文件 |
| `api.getQuizQuestions(chapter, count)` | GET | `/api/quiz` | 获取练习题 |
| `api.submitQuizAnswer(quizId, answer)` | POST | `/api/quiz/submit` | 提交答案判题 |
| `api.getWrongQuizItems()` | GET | `/api/quiz/wrong` | 获取错题本 |
| `api.getReport(period)` | GET | `/api/evaluation/report` | 获取学习报告（周/日/月） |
| `api.getLearningPath()` | GET | `/api/learning-path` | 获取学习路径 |
| `api.adjustLearningPath(reason)` | POST | `/api/learning-path/adjust` | 调整学习路径 |
| `api.getLearningPathNodeAdvice(nodeId)` | POST | `/api/learning-path/node-advice` | 获取节点建议 |
| `api.generatePathPlanning(target)` | POST | `/api/path-planning/generate` | 生成路径规划 |
| `api.getVideos()` | GET | `/api/video/resources` | 获取视频资源（含 fallback `/api/videos`） |
| `api.generateVideo(prompt, onEvent)` | POST SSE | `/api/video/polish` + `/api/video/jobs` | 视频生成（润色→创建任务→流式进度） |
| `api.polishVideoPrompt(prompt, durationSec)` | POST | `/api/video/polish` | 视频脚本润色 |
| `api.getKnowledgeFiles(params?)` | GET | `/api/knowledge/files` | 知识库文件列表 |
| `api.uploadKnowledgeFiles(files)` | POST (FormData) | `/api/knowledge/files` | 上传知识库文件 |
| `api.indexKnowledgeFile(fileId)` | PUT | `/api/knowledge/files/{id}/index` | 触发文件索引 |
| `api.getKnowledgeStats()` | GET | `/api/knowledge/stats` | 知识库统计 |
| `api.getMcpServices(scope)` | GET | `/api/mcp/services` | MCP 服务列表 |
| `api.createMcpService(payload)` | POST | `/api/mcp/services` | 创建 MCP 服务 |
| `api.testMcpService(serviceId)` | POST | `/api/mcp/services/{id}/test` | 测试 MCP 服务连接 |
| `api.synthesizeSpeech(text, options)` | POST | `/api/voice/tts` | 语音合成 TTS |
| `api.getAgentPet()` | GET | `/api/agent/pet` | 获取学习宠物 |
| `api.adoptAgentPet(payload)` | POST | `/api/agent/pet` | 领养学习宠物 |
| `api.createAgentTask(payload)` | POST | `/api/agent/task` | 创建 Agent 任务 |
| `api.getForumPosts(params?)` | GET | `/api/forum/posts` | 论坛帖子列表 |
| `api.createForumPost(payload)` | POST | `/api/forum/posts` | 发布论坛帖子 |
| `api.getTeacherBroadcasts()` | GET | `/api/teacher/broadcasts` | 教师广播列表 |
| `api.createTeacherBroadcast(payload)` | POST | `/api/teacher/broadcasts` | 创建教师广播 |

### 3.4 types.ts 中的关键类型

类型文件 `frontend/src/lib/api/types.ts` 约 560 行，是前后端数据契约的核心，按业务域分组如下：

#### 资源与 PPT

```typescript
// 资源基类
interface Resource {
  id: string
  title: string
  type: 'document' | 'ppt' | 'mindmap' | 'quiz' | 'reading' | 'code' | 'video' | 'blog'
  status: 'generating' | 'completed' | 'failed'
  createdAt: string
  content?: string
  sourceUrl?: string
  pptSchema?: PptDeck         // PPT Schema 驱动渲染
  videoUrl?: string
  audioUrl?: string
  subtitleUrl?: string
  timelineUrl?: string
  sceneUrl?: string
  shareUrl?: string
  duration?: number
  provider?: string
  ttsProvider?: string
  hasMp4?: boolean
  progress?: number            // 0-100
}


// PptSlide 的 4 种布局
type PptLayout = 'cover' | 'bullets' | 'process' | 'summary'
interface PptSlide {
  id: string
  layout: PptLayout
  title: string
  subtitle?: string
  bullets?: PptBullet[]
  nodes?: PptNode[]
  summary_points?: string[]
  narration: PptNarration[]
}
```

#### 辅导对话

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  conversationId?: number
  fileNames?: string[]
  confidence?: ConfidenceInfo     // 防幻觉置信度
  citations?: CitationItem[]      // 引用来源
  trustMeta?: Record<string, unknown>
}

interface ConfidenceInfo {
  score: number                   // 0-1
  level: 'high' | 'medium' | 'low'
  color: 'green' | 'yellow' | 'red'
  label: string
  message: string
  reasonCodes?: string[]
}

interface CitationItem {
  id: string
  label: string
  sourceType: string
  snippet: string
  score?: number                  // 相关性评分
}
```

#### 工坊 SSE 事件

```typescript
interface WorkshopHubEvent {
  phase: 'profile_analysis' | 'discussion' | 'synthesis'
  round: number
  agentId: string
  agentName: string
  agentKind: 'system' | 'custom'
  content: string
  timestamp: string
  delta?: boolean                 // 增量更新标记
}
```

#### MCP 服务管理

```typescript
interface McpService {
  id: string
  name: string
  description: string
  source: 'system' | 'user'
  transport: 'stdio' | 'http'
  endpoint: string
  command: string
  args_json: string[]
  env_json: Record<string, string>
  enabled: boolean
  last_status: 'unknown' | 'online' | 'offline'
  last_error: string
  last_tested_at: string
  startup_timeout_ms: number
  tool_timeout_ms: number
  long_task_timeout_ms: number
}
```

#### 学习画像

```typescript
interface StudentProfile {
  id: string
  name: string; email: string; major: string; grade: string
  goals: string[]
  knowledgeLevel: string; weakPoints: string[]
  learningPreference: string[]; cognitiveStyle: string
  dailyTime: number; practicalAbility: string; currentStage: string
}

interface ProfileUpdatePayload {
  name?: string; email?: string; major?: string; grade?: string
  goals?: string[]; knowledgeLevel?: string
  weakPoints?: string[]; learningPreference?: string[]
  cognitiveStyle?: string; dailyTime?: number
  practicalAbility?: string; currentStage?: string
}
```

#### 学习宠物 (Agent Pet)

```typescript
interface AgentPet {
  id: string; name: string
  avatar: 'fox' | 'owl' | 'robot' | 'cat' | 'dragon' | 'penguin' | 'bunny' | 'panda'
  personality: 'concise' | 'verbose' | 'encouraging'
  level: number; xp: number; next_level_xp: number | null
  unlocked_abilities: string[]
}

interface AgentTask {
  task_id: string
  task_type: 'search' | 'summarize' | 'compare' | 'recommend'
  input_text: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result: AgentSearchResult | AgentSummaryResult | AgentCompareResult | null
  error_message: string | null
  feedback: 'useful' | 'not_useful' | null
  steps?: AgentTaskStep[]
}
```

#### 视频资源

```typescript
interface VideoInfo {
  id: string; title: string; url: string
  audioUrl?: string; subtitleUrl?: string
  timelineUrl?: string; sceneUrl?: string; shareUrl?: string
  duration: number  // seconds
  status?: 'generating' | 'completed' | 'failed'
  provider?: string; ttsProvider?: string
  hasMp4?: boolean
}

interface VideoPolishResult {
  polish_id: string; title: string; polished_prompt: string
  script_outline: VideoScriptSegment[]
  estimated_duration_sec: number; voice: string
}
```

#### 知识库

```typescript
interface KnowledgeFile {
  id: number; filename: string; mimeType: string; sizeBytes: number
  status: 'pending' | 'processing' | 'indexed' | 'failed'
  tags: string[]; summary: string
  chunkCount: number; referenceCount: number
}

interface KnowledgeStats {
  total: number; indexed: number; chunks: number; references: number
}
```

#### 辅导角色与会话

```typescript
interface TutorRole {
  id: number; name: string; persona: string
  background: string; styleGuide: string; rules: string; enabled: boolean
}

interface TutorConversation {
  id: number; roleId: number | null; title: string
  createdAt: string; updatedAt: string; messageCount: number
}

interface TutorFile {
  id: number; filename: string; mimeType: string; sizeBytes: number
}
```

### 3.5 SSE 流式数据处理

项目中有两处关键 SSE 消费场景：

**场景一：智能辅导对话 (`sendMessage`)**

`frontend/src/lib/api/real.ts` 中的 `sendMessage` 函数是项目中 SSE 事件类型最丰富的实现。调用 `/api/tutor/chat` 后，通过 `onEvent` 回调分派 8 种事件：

- `text` → 追加文本块到消息内容
- `error` → 结构化错误信息（code/message/sid）
- `hub` → 研讨会 Agent 发言（支持 delta 增量更新）
- `workshop_phase` → 研讨会阶段变化
- `confidence` → 置信度评分
- `citations` → 引用来源列表
- `trust_meta` → 可信度元数据
- `mcp_call` → MCP 工具调用记录
- `done` → 对话完成

页面层面通过回调函数实时更新 UI：

```typescript
// frontend/src/app/tutor/page.tsx 中的 SSE 消费
await api.sendMessage(
  userInput,
  { conversationId, roleId, mode, fileIds, workshopEnabled, workshopRoleIds },
  {
    onText: (chunk) => {
      setMessages((prev) => prev.map((m) =>
        (m.id === assistantId ? { ...m, content: `${m.content}${chunk}` } : m)))
    },
    onConfidence: (confidence) => { /* 更新消息置信度 */ },
    onCitations: (citations) => { /* 更新引用来源 */ },
    onHub: (evt) => { /* 追加/更新工坊事件 */ },
    onWorkshopPhase: (evt) => { /* 更新工坊阶段 */ },
  },
)
```

**场景二：视频生成进度 (`generateVideo`)**

视频生成链路分三步：润色提示词 → 创建生成任务 → 监听任务 SSE 事件流。每次 SSE 帧都通过 `onEvent` 回调向前端报告当前进度（如片段渲染、TTS 合成、MP4 封装等阶段）。

### 3.6 camelCase ↔ snake_case 转换策略

全部字段映射集中在 `real.ts` 中完成，页面代码只接触 camelCase：

- **出站（前端 → 后端）**：`createTutorRole` 中将 `styleGuide → style_guide`、`knowledgeLevel → knowledge_level`
- **入站（后端 → 前端）**：`toResource` 函数将 `created_at → createdAt`、`source_url → sourceUrl`
- **数据通路**：所有 `fetchJson` / `readSSE` 返回的数据在返回给页面前已完成转换

---

## 4. 路由与页面说明 ✅

### 4.1 完整路由表

| 路由 | 文件位置 | 功能描述 | 状态 |
|------|---------|---------|------|
| `/` | `(shell)/page.tsx` | 学习工作台（今日任务、推荐资源、薄弱点、活跃热力图） | ✅ |
| `/onboarding` | `onboarding/page.tsx` | 画像建档（7 步卡片向导：目标→水平→风格→方向→领域→时间→能力） | ✅ |
| `/plaza` | `plaza/page.tsx` | 学习广场首页（论坛帖子列表 + 分区导航） | ✅ |
| `/plaza/[postId]` | `plaza/[postId]/page.tsx` | 帖子详情（内容 + 评论 + 附件） | ✅ |
| `/plaza/experience-share` | `plaza/experience-share/page.tsx` | 经验分享分区 | ✅ |
| `/plaza/qa` | `plaza/qa/page.tsx` | 问答分区 | ✅ |
| `/plaza/resource-share` | `plaza/resource-share/page.tsx` | 资源共享分区 | ✅ |
| `/plaza/team-study` | `plaza/team-study/page.tsx` | 组队学习分区 | ✅ |
| `/plaza/my-likes` | `plaza/my-likes/page.tsx` | 我的点赞 | ✅ |
| `/plaza/my-comments` | `plaza/my-comments/page.tsx` | 我的评论 | ✅ |
| `/plaza/history` | `plaza/history/page.tsx` | 浏览历史 | ✅ |
| `/profile` | `(shell)/profile/page.tsx` | 学习画像展示（雷达图、四卡网格、能力分布） | ✅ |
| `/profile/settings` | `(shell)/profile/settings/page.tsx` | 画像编辑表单 | ✅ |
| `/path` | `(shell)/path/page.tsx` | 个性化学习路径（知识图谱 + 节点建议） | ✅ |
| `/generate` | `(shell)/generate/page.tsx` | 资源生成中心（多智能体协同生成） | ✅ |
| `/knowledge` | `(shell)/knowledge/page.tsx` | 个人知识库（文件上传/索引/检索） | ✅ |
| `/practice` | `(shell)/practice/page.tsx` | 练习评测主页 | ✅ |
| `/practice/mistakes` | `(shell)/practice/mistakes/page.tsx` | 错题本 | ✅ |
| `/practice/favorites` | `(shell)/practice/favorites/page.tsx` | 收藏题目 | ✅ |
| `/practice/records` | `(shell)/practice/records/page.tsx` | 练习记录 | ✅ |
| `/report` | `(shell)/report/page.tsx` | 学习报告（周/日/月周期切换） | ✅ |
| `/agent` | `(shell)/agent/page.tsx` | 学习伙伴（AI 宠物系统） | ✅ |
| `/video` | `(shell)/video/page.tsx` | 视频资源中心 | ✅ |
| `/forum` | `(shell)/forum/page.tsx` | 学习论坛 | ✅ |
| `/forum/new` | `(shell)/forum/new/page.tsx` | 发布帖子 | ✅ |
| `/tutor` | `tutor/page.tsx` | 智能辅导（三栏布局 + 多模态对话 + 工坊 + TTS） | ✅ |
| `/tutor/mcp-store` | `tutor/mcp-store/page.tsx` | MCP 插件商店（服务管理 + 连接测试） | ✅ |
| `/tutor/mcp-store/docs` | `tutor/mcp-store/docs/page.tsx` | MCP 文档 | ✅ |
| `/tutor/knowledge` | `tutor/knowledge/page.tsx` | 知识库管理（tutor 侧：上传/索引/切片查看） | ✅ |
| `/tutor/files` | `tutor/files/page.tsx` | 文件管理 | ✅ |
| `/tutor/roles` | `tutor/roles/page.tsx` | 角色管理（角色工坊） | ✅ |
| `/tutor/workshop` | `tutor/workshop/page.tsx` | 多智能体研讨工坊 | ✅ |
| `/teacher` | `(teacher)/teacher/page.tsx` | 教师端入口 | ✅ |
| `/teacher/login` | `(teacher)/teacher/login/page.tsx` | 教师登录 | ✅ |
| `/teacher/dashboard` | `(teacher)/teacher/dashboard/page.tsx` | 教师大屏（学情总览） | ✅ |
| `/teacher/broadcast` | `(teacher)/teacher/broadcast/page.tsx` | 教师广播（学情通知推送） | ✅ |
| `/teacher/students` | `(teacher)/teacher/students/page.tsx` | 学生列表管理 | ✅ |
| `/teacher/students/[id]` | `(teacher)/teacher/students/[id]/page.tsx` | 学生个人详情 | ✅ |
| `/teacher/reports` | `(teacher)/teacher/reports/page.tsx` | 学情报表 | ✅ |
| `/teacher/interventions` | `(teacher)/teacher/interventions/page.tsx` | 学习干预 | ✅ |
| `/teacher/ai` | `(teacher)/teacher/ai/page.tsx` | AI 辅助教学 | ✅ |
| 移动端 | `(shell)/layout.tsx` 内 `isMobile` 分支 | 手机端底部 TabBar + 顶部导航 | 🔲 规划中 |

### 4.2 关键页面简述

**`/` 学习工作台**：首页以 "英雄决策卡" 为核心展示当前优先薄弱点和推荐动作。四列指标条显示掌握度、待练题数、连续学习天数和路径进度。左侧展示最近资源回顾，右侧对接推荐系统输出今日新资源。页面使用 `PageHead`、`ProtoCard`、`SoftCard`、`Pill` 等原型组件统一视觉风格。

**`/tutor` 智能辅导**：项目中最复杂的页面（`tutor/page.tsx` 约 927 行）。采用自建三栏布局——左侧 200px 导航栏（学习空间/角色工坊/研讨会/知识库/MCP 插件商店/我的文件入口）、中间 280px 对话列表栏（搜索/角色切换/会话列表）、右侧主对话区（消息渲染/多模态内容/输入区）。支持多种模式：图片模式（`image_gen`）、可信模式（`open_mode`）、研讨会模式（多 Agent 研讨）。配备 TTS 语音播报、语音输入（Web Speech API）、MCP 工具调用追踪、置信度展示等功能。

**`/onboarding` 画像建档**：全新用户的引导式建档流程，7 个步骤依次收集：学习目标、编程基础、学习风格、发展方向、研究领域、可用时间、动手能力。每步以卡片选择 + 文本输入形式呈现。完成建档后调用后端初始化 API 并跳转至学习工作台。

**`/tutor/mcp-store` MCP 插件商店**：支持两种传输模式（HTTP 远程 + stdio 本地）。表单包含三步引导式配置：连接方式 → 基本信息 → 端点参数。提供认证、请求头、超时配置三个 Tab。服务列表可实时测试连接、启停和删除。页面通过 `StepField` 数组组件组织配置表单，使用 320px/680px/280px 三栏响应式布局。

### 4.3 导航系统

**侧边栏 (`components/layout/Sidebar.tsx`)**：支持三种状态（expanded 220px / icons 74px / collapsed 0px）。导航项分为三个分组：学习中心（工作台/画像/路径/知识库）、资源与练习（资源中心/练习评测/学习伙伴）、分析与反馈（学习报告）。底部提供退出登录按钮。

**顶部栏 (`components/layout/Topbar.tsx`)**：显示面包屑路径（从 `PAGE_META` 映射获取分组和页面标题）。右侧包含用户 chip 和必要的图标按钮。移动端使用简化版 `MobileTopbar`。

**导航元数据 (`components/layout/navigation.tsx`)**：定义 `PAGE_META` 映射表（34 个页面路径到 `{group, title, isMainTab}` 的映射）和 `MOBILE_TABS` 底部标签栏配置（6 个 Tab：工作台/画像/路径/资源/练习/论坛）。

**全局 AI 助手 (`components/layout/AIAssistant.tsx`)**：所有核心页面右下角常驻悬浮助手。根据当前路由动态切换上下文标题和快捷问题（如 `/practice` 显示"讲解这道题"、"生成变式题"等）。真实接入 `/api/tutor/chat` SSE 对话流，支持语音输入和 TTS 播报。在 `/tutor` 页面自动隐藏以避免与页面内置对话功能冲突。

---

## 5. 组件设计 ✅

### 5.1 UI 基础组件

**Button** — `frontend/src/components/ui/Button.tsx`

通用按钮组件，使用 `forwardRef` 支持 ref 转发。提供三种变体（primary 蓝色填充 / secondary 白色边框 / ghost 透明文本）和三种尺寸（sm 32px / md 40px / lg 48px）。内置 disabled 状态样式（opacity-50）、focus-visible 环形焦点、active 缩放反馈（`scale-[0.98]`）。使用 `cn` 工具函数合并 className。

```typescript
// 关键参数
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, disabled, ...props }, ref) => {
    // variant: 'primary' | 'secondary' | 'ghost'
    // size: 'sm' | 'md' | 'lg'
  }
)
```

**ErrorState** — `frontend/src/components/ui/ErrorState.tsx`

统一的错误状态展示组件。预设三种错误类型（server 服务器异常 / network 网络异常 / generic 通用错误），每种有对应的图标、标题和描述文案。支持 `onRetry` 重试回调，点击触发重新加载。

**TypewriterLoader** — `frontend/src/components/ui/TypewriterLoader.tsx`

基于 `styled-components` 实现的打字机加载动画。包含三段式元件：滑动杆（slide）、纸张（paper）、键盘（keyboard），通过 CSS `@keyframes` 驱动三元素协同动画（打字节奏）。支持 `sm`（0.6x 缩放）和 `md`（1x）两种尺寸，可附加加载文本。

**其他基础组件**：

- `Badge` — 状态/标签徽章
- `Card` — 通用白底卡片容器
- `Skeleton` — 骨架屏加载占位
- `EmptyState` — 空数据提示
- `ProgressBar` — 线性进度条
- `ProgressRing` — 圆形进度环
- `AudioRadio` — 音频播放按钮控件

### 5.2 原型设计系统组件 (proto/)

位于 `frontend/src/components/proto/index.tsx`，对标 UI 原型的高保真组件集：

- `PageHead` — 页面标题栏（标题 + 摘要 + 状态条）
- `Pill` — 圆角状态标签（支持多种颜色）
- `ProtoButton` — 主按钮/次按钮/ghost 按钮
- `ProtoCard` — 白底圆角卡片
- `SoftCard` — 浅灰内嵌卡片
- `MetricStrip` — 四列指标条
- `Timeline` — 步骤时间线

这些组件在 V2 重构期间逐页替换旧 UI 组件，目标是使所有页面视觉与原型保持一致。旧的 `components/ui/` 组件不删除，留给尚未迁移的页面继续使用。

### 5.3 布局组件

**Sidebar** — `frontend/src/components/layout/Sidebar.tsx`

固定 220px 宽侧边栏，支持三种状态（expanded/icons/collapsed），通过 `onStateChange` 回调控制。导航项分组渲染，active 状态使用 `bg-[#EFF5FF] text-[#2563EB]` 高亮。icons 模式下隐藏文字只显示图标并居中排列。collapsed 状态完全隐藏，通过左侧悬浮按钮恢复。

**Topbar** — `frontend/src/components/layout/Topbar.tsx`

固定 56px 高顶部栏，通过 `sidebarWidth` 参数动态调整 `margin-left`。左侧显示面包屑导航，右侧包含用户头像和操作区。面包屑从 `PAGE_META[pathname]` 动态获取。

**AIAssistant** — `frontend/src/components/layout/AIAssistant.tsx`

全局悬浮 AI 助手组件，核心特点包括：

- 右下角固定定位（`fixed right-6 bottom-6`），支持最小化/展开切换
- `CONTEXTS` 映射表根据 `pathname` 切换上下文标题、提示说明和快捷问题（覆盖 `/`、`/profile`、`/path`、`/generate`、`/knowledge`、`/practice`、`/report` 共 7 个核心页面）
- 真实 SSE 对话接入（调用 `api.sendMessage`），流式渲染回复
- 使用 `ReactMarkdown` + `remarkGfm` 渲染 AI 回复
- 支持 `page_context` 传递（包含当前路由、页面标题等信息），使 AI 能理解用户所处页面
- 监听全局 `sparklearn:open-ai-assistant` 自定义事件，支持外部组件唤醒助手

### 5.4 Tutor 页核心组件

Tutor 页面 (`tutor/page.tsx`) 未将逻辑抽为独立组件文件，而是在单文件中以内联方式组织以下核心功能块：

**对话面板**：三栏布局的核心区域，使用 `messages` 状态数组做累积渲染。每条 AI 消息渲染为 Markdown（`ReactMarkdown`），支持图片 Base64 内联（`data:image/...` 正则匹配）、研讨会摘要结构化展示（解析"核心结论/分步行动清单/可追问问题"结构）、MCP 调用追踪标签、置信度和引用来源折叠面板。

**角色设置面板**：通过弹窗（Modal）形式提供角色创建/编辑功能。表单包含 5 个字段——名称、Persona（个性定位）、背景设定、风格指南、规则约束。保存后通过 `api.createTutorRole` / `api.updateTutorRole` 持久化。

**工坊事件面板**：研讨会模式下，中间对话列表区上方显示 Agent 发言流。`hubMessages` 数组记录每个 Agent 的阶段发言，支持 delta 增量更新（同一 Agent 同一轮次的连续片段合并）。

**文件上传区**：输入框下方提供 `fileInputRef` 控制的隐藏文件上传 input。支持多文件选择，上传通过 `api.uploadTutorFiles` 的 `FormData` 提交。已上传文件显示横排标签，可逐个移除。

**模式切换按钮**：输入区工具栏提供两个模式切换——图片模式（`imageMode` → mode 切换为 `image_gen`）和可信模式（`openMode` → 切换防幻觉严格程度）。

### 5.5 移动端适配组件

在 `(shell)/layout.tsx` 中通过 `useBreakpoint()` hook 区分移动端/桌面端：

- `MobileTopbar` — 简化版顶部导航（返回按钮 + 分组/标题 + 退出按钮）
- `BottomTabBar` — 5 个 Tab 的底部导航栏（工作台/画像/路径/资源/练习/论坛），active 状态蓝色高亮
- 移动端主内容宽度限制 `max-w-[560px]`，底部留白 `pb-28` 为 TabBar 预留空间

---

## 6. 多模态资源技术实现 ✅

### 6.1 Markdown 渲染

前端所有 AI 回复内容的渲染统一使用 `react-markdown` + `remark-gfm`。

**技术链路**：
```
AI 返回 Markdown 文本 → SSE text 事件累积 → Message.content 字符串
→ ReactMarkdown 组件渲染 → 浏览器显示富文本
```

**实现细节**（`frontend/src/app/tutor/page.tsx` 第 735-758 行）：
- 使用 `prose` 类设置排版样式（`prose-base max-w-none`）
- `remarkPlugins={[remarkGfm]}` 启用 GFM 扩展（表格、任务列表、删除线、自动链接）
- `urlTransform` 保留 `data:image/` Base64 图片 URL
- `components.img` 自定义渲染图片，限制 `max-w-full` 防止溢出
- 通过 `prose-p:leading-[1.8]`、`prose-code:bg-[#f5f5f5]` 等样式微调排版细节
- 代码块使用深色主题：`prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4]`

**全局 AI 助手** (`components/layout/AIAssistant.tsx`) 同样使用 `ReactMarkdown` 渲染对话回复，保持多模态渲染一致性。

### 6.2 PPT 预览

PPT 采用 **Schema 驱动渲染** 模式。生成阶段由多重智能体协同产出结构化的 `PptDeck` JSON Schema，前端根据 Schema 渲染为幻灯片预览。

**PPT Schema 数据结构**（`frontend/src/lib/api/types.ts` 第 133-169 行）：

```typescript
type PptLayout = 'cover' | 'bullets' | 'process' | 'summary'

interface PptDeck {
  deck_id: string
  theme: string
  title: string
  slides: PptSlide[]
}

interface PptSlide {
  id: string
  layout: PptLayout      // 四种布局：封面/要点/流程/总结
  title: string
  subtitle?: string
  bullets?: PptBullet[]   // 要点列表（带 step 序号）
  nodes?: PptNode[]       // 流程节点（带 label + step）
  summary_points?: string[] // 总结要点
  narration: PptNarration[] // 旁白文本（绑定到特定元素）
}
```

**四种布局说明**：
- `cover` — 封面页：标题 + 副标题 + 主题背景
- `bullets` — 要点页：标题 + 多条要点（每条有 step 序号，支持渐进式展示）
- `process` — 流程图页：标题 + 多节点流程（节点有 label 和 step）
- `summary` — 总结页：标题 + 多条总结要点 + 旁白

**渲染方式**：PPT Schema 存储在 `Resource.pptSchema` 字段中。资源列表 (`(shell)/generate/page.tsx`) 加载后按 `layout` 类型切换渲染模板。前端目前以静态 Schema 渲染为主，`Resource.content` 中包含的 Markdown/HTML 作为辅助内容展示。`PptNarration` 旁白数据用于与 TTS 语音合成集成。

### 6.3 视频资源（已修复生成 Bug） ✅

视频资源的完整技术链路涵盖生成和播放两个阶段。

**生成链路**（`frontend/src/lib/api/real.ts` 第 1079-1142 行）：

```
用户输入 prompt
→ api.polishVideoPrompt(prompt, durationSec)   # 第一步：脚本润色
  → POST /api/video/polish  → 返回 VideoPolishResult（标题、润色后提示词、分镜大纲）
→ api.generateVideo(prompt, onEvent)            # 第二步：发起生成
  → POST /api/video/jobs     → 返回 jobId + resourceId
  → GET /api/video/jobs/{id}/events (SSE)       # 第三步：流式进度监听
  → GET /api/video/resources/{id}               # 第四步：获取最终资源
```

生成过程中，`VideoPolishResult` 包含分镜脚本大纲（`script_outline`），每个片段标注 `narration`（旁白）、`visual_hint`（视觉提示）、`duration_ms`（预估时长）。后端根据这些信息使用 HTML-PPT 模板生成视频帧画面，通过讯飞 TTS 将旁白合成为音频，再组装为 MP4 文件。

**播放链路**：
- 前端使用原生 HTML5 `<video>` 标签播放 MP4 视频
- WebVTT 字幕轨道 (`subtitleUrl`) 提供同步字幕
- 场景时间线 (`timelineUrl`) 支持按场景跳转

**已沉淀的多套模板**：告别了早期单一 PPT 模板方案，后端已沉淀多套固定优质 HTML-PPT 模板，覆盖不同教学场景（概念讲解、案例分析、操作演示等），视频生成质量和一致性显著提升。

**音色选择**：TTS 配音目前使用讯飞 TTS 默认音色，音色选择 UI 和配置仍在开发中（🔲 待修复）。

### 6.4 AI 图片生成（多模态对话） ✅

图片生成功能整合在智能辅导对话中，作为 SSE 流的一种附加模态。

**技术链路**：
```
用户在对话中发送图片生成请求
→ 前端设置 imageMode=true（mode 切换为 'image_gen'）
→ POST /api/tutor/chat (SSE)
→ 后端 xfyun_tti.py 调用讯飞星火图片生成引擎
→ 返回 Base64 编码的 PNG 图像数据
→ SSE text 事件中包含 data:image/png;base64,... 字符串
→ 前端正则匹配提取 Base64 数据
→ <img src="data:image/png;base64,..." /> 内联渲染
```

**前端处理逻辑**（`tutor/page.tsx` 第 711-760 行）：
- 在消息渲染循环中，通过正则 `/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/` 匹配 AI 回复中的 Base64 图片数据
- 匹配到图片数据时，使用原生 `<img>` 标签渲染（绕过 `ReactMarkdown`），设置 `max-w-full h-auto rounded-lg border`
- 匹配不到时，走标准 `ReactMarkdown` 渲染流程
- `ReactMarkdown` 的 `urlTransform` 保留 `data:image/` URL 不被过滤
- `components.img` 自定义渲染也设置 `max-w-full` 防溢出

### 6.5 PDF/HTML 资源链接预览

当 AI 资源生成返回网页链接时，前端提供内嵌预览或新窗口打开两种方式。

**预览判断逻辑**：
- 资源类型为 `document`、`mindmap`、`quiz`、`reading`、`code`、`ppt` 时，优先使用 `sourceUrl` 字段
- `sourceUrl` 为空时，前端不渲染内嵌预览，改用 `content` 文本展示
- `content` 中出现的 URL 不作为预览依据（防止误解析非预期链接）

**代理预览**：`GET /api/resources/{id}/preview/html` 由后端拉取远端 HTML 内容，返回可安全嵌入的 HTML 片段。前端通过 `<iframe>` 内嵌预览。

**下载导出**：默认走 PDF 下载(`GET /api/resources/{id}/download/pdf`)。后端使用 Playwright 打开 `sourceUrl`，注入打印样式后通过 `page.pdf()` 生成 PDF 文件流。前端下载逻辑通过创建临时 `<a>` 标签触发浏览器下载。

### 6.6 TTS 语音播报

辅导对话中每条 AI 回复均支持语音播报。

**技术链路**（`tutor/page.tsx` 第 159-175 行）：
```
用户点击"播放"按钮
→ api.synthesizeSpeech(text, { voice, speed, volume, pitch })
  → POST /api/voice/tts   → 后端调用讯飞 TTS 合成语音
→ 返回 audio/mpeg Blob
→ URL.createObjectURL(blob) → 创建临时音频 URL
→ new Audio(url).play() → 播放音频
```

每条约 2000 字符的文本传入 TTS。播放前对文本做预处理：正则移除 Markdown 标记字符 `[#*>\-|[\]()]`，防止 TTS 引擎读出格式符号。同一时刻只允许一条消息播放，新播放会自动停止旧播放。

### 6.7 语音输入

使用浏览器原生 Web Speech API 实现中文语音识别。

**实现方式**（`tutor/page.tsx` 第 177-196 行）：
- 点击录音按钮启动 `SpeechRecognition`（或 `webkitSpeechRecognition` 兼容写法）
- 设置 `lang='zh-CN'`、`continuous=false`、`interimResults=true`（中间结果实时显示）
- `onresult` 回调将识别文本追加到输入框
- 录音中按钮变为红色脉冲动画（`bg-red-500 animate-pulse`）
- 不支持语音识别的浏览器给出提示

---

## 7. 前端状态管理 ✅

### 7.1 页面级状态：React useState + useEffect

项目未引入 Redux/MobX 等全局状态管理方案（zustand 仅用于 `GenerationTaskProvider` 的全局资源生成任务状态），绝大多数页面的状态管理采用 React 内置的 `useState` + `useEffect` + `useCallback` 模式。

**状态类型**：

- **数据状态**：页面渲染所需的所有后端数据，如 `messages`、`conversations`、`roles`、`services`、`tasks`
- **加载状态**：`loading`（初始加载）、`streaming`（流式中）、`busyId`（某项操作的加载状态，精细到单项级别）
- **错误状态**：`error`（全局加载错误）、`actionError`（操作错误，如发送消息失败、创建角色失败）
- **交互状态**：`input`（输入框内容）、`imageMode`（图片模式开关）、`openMode`（可信模式开关）、`workshopEnabled`（研讨会开关）、`recording`（录音状态）、`panelCollapsed`（面板折叠）

**典型状态管理示例**（tutor 页面）：

```typescript
// 13 个数据/业务状态
const [messages, setMessages] = useState<Message[]>([])
const [conversations, setConversations] = useState<TutorConversation[]>([])
const [roles, setRoles] = useState<TutorRole[]>([])
const [currentConversationId, setCurrentConversationId] = useState<number | null>(null)
const [currentRoleId, setCurrentRoleId] = useState<number | null>(null)

// 10 个 UI/交互状态
const [input, setInput] = useState('')
const [loading, setLoading] = useState(true)
const [streaming, setStreaming] = useState(false)
const [error, setError] = useState<string | null>(null)
const [actionError, setActionError] = useState<string | null>(null)
const [panelCollapsed, setPanelCollapsed] = useState(false)
const [workshopEnabled, setWorkshopEnabled] = useState(false)
const [openMode, setOpenMode] = useState(true)
const [imageMode, setImageMode] = useState(false)
const [hubMessages, setHubMessages] = useState<WorkshopHubEvent[]>([])
```

### 7.2 对话消息累积模式

Tutor 对话的消息处理是项目中最典型的状态操作模式。

**消息发送流程**：
1. 用户发送消息时，立即将 `userMsg` 和空 `assistantMsg`（占位）追加到 `messages` 数组
2. 调用 `api.sendMessage` 发起 SSE 请求，传入多个回调
3. 收到 `onText` 回调时，通过 `setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m))` 渐进式拼接内容
4. 收到 `onConfidence` / `onCitations` / `onTrustMeta` 回调时，将对应字段更新到目标消息对象
5. SSE 完成后，设置 `streaming = false`

**空消息过滤**：流式中 assistant 消息 `content` 为空时，跳过渲染。通过 `if (streaming && msg.role === 'assistant' && !msg.content.trim()) return null` 实现。

**研讨会事件累积**：`hubMessages` 数组接收 `onHub` 回调事件，支持 delta 增量更新（同一 Agent 同一轮次的 content 追加而非新建条目）。

### 7.3 跨组件状态共享

**GenerationTaskProvider**（`components/providers/GenerationTaskProvider.tsx`）：使用 zustand 创建的全局状态，管理资源生成任务的生命周期。在 `(shell)/layout.tsx` 中包裹所有主应用页面，使 `generate`、`resources` 等页面可共享生成任务队列状态。

**URL 驱动的数据加载**：会话切换等场景通过 URL 参数 / state 传递上下文，目标组件通过 `useParams` / `useSearchParams` 获取，触发 `useEffect` 重新加载。

---

## 8. 性能优化 🔲

以下为当前已识别并规划的性能优化方向，尚未全面实施：

### 8.1 已实现的优化

- **Server Components 默认**：App Router 默认即为 Server Components，不涉及客户端交互的页面部分在服务端渲染，减少客户端 JS 体积
- **路由级代码分割**：Next.js App Router 按路由自动分割代码，每个 `page.tsx` 独立打包，访问时才加载
- **单文件组件模式**：Tutor 页面的复杂 UI 未拆为数十个小文件，避免了过度组件化带来的渲染开销
- **增量状态更新**：使用 `setState(prev => prev.map(...))` 模式精细更新数组中的单条消息，避免全量替换
- **useMemo 缓存派生状态**：`currentConversation`、`currentRole`、`focusTitle` 等派生数据通过 `useMemo` 缓存

### 8.2 待实现的优化

- 🔲 **图片懒加载**：资源列表中大量资源卡片图片使用原生 `<img>` 标签，需添加 `loading="lazy"` 属性
- 🔲 **消息列表虚拟化**：对话历史超过 200 条时，DOM 节点过多导致滚动卡顿，需引入虚拟滚动（如 `react-virtuoso`）
- 🔲 **ReactMarkdown 渲染缓存**：AI 回复的 Markdown 内容在消息完成后不再变化，可使用 `useMemo` 缓存渲染结果
- 🔲 **API 请求去重/合并**：多个组件同时请求相同数据时，暂无去重机制
- 🔲 **图片 Base64 内联优化**：当前 AI 生成图片直接内联 Base64 数据于消息中，大图会导致消息体积过大，应考虑转为 Blob URL
- 🔲 **CSS-in-JS 优化**：`styled-components` 运行时注入的样式增加 JS bundle 大小，可评估迁移到 Tailwind 原生动画

---

## 9. 待实现规划 🔲

### 9.1 手机端响应式适配

当前移动端通过 `(shell)/layout.tsx` 中的 `isMobile` 分支提供基础适配（`MobileTopbar` + `BottomTabBar`），但仅在主应用 shell 页面生效。以下场景尚未完成适配：

- `tutor/` 独立布局的智能辅导页未提供移动端三栏改造方案
- `onboarding/` 建档步骤卡在狭窄屏幕上的排版需重新设计
- `tutor/mcp-store/` 的三栏配置表单在移动端需改为纵向堆叠
- 教师端大屏页面面向桌面用户设计，暂不需要移动端适配

### 9.2 外部资源展示组件

🔲 当前 `Resource.type === 'blog'` 或第三方平台链接资源缺少统一的展示组件。规划中的能力包括：

- B 站视频嵌入组件（解析 BV 号 → iframe 播放器）
- GitHub Gist 代码嵌入
- 外部文章摘要卡片（OGP 元数据拉取 + 摘要展示）

### 9.3 Admin 端页面

🔲 当前只有教师端 (`teacher`)，尚缺系统管理员端：

- 用户管理（学生/教师账号 CRUD）
- 系统配置（模型参数、API Key 管理、TTS 音色配置）
- 运营数据大盘（DAU、资源生成量、学习时长统计）
- 内容审核（论坛帖子审核、生成资源审核）

### 9.4 细节 UI 优化

🔲 以下 UI 细节已在开发过程中标记，待统一优化：

- 字体大小自适应（不同屏幕密度下的可读性调整）
- 暗色模式支持（当前仅支持浅色主题，`globals.css` 中无 `prefers-color-scheme` 适配）
- 长文本截断与展开（资源描述、论坛帖子摘要等场景的统一处理）
- Toast 通知系统（当前错误提示多以内联 `actionError` 展示，缺少全局 Toast）
- 键盘快捷键支持（如 `Ctrl+K` 唤起全局 AI 助手、`Ctrl+Enter` 发送消息）

---

## 附录 A：设计 Token 速查

| Token | 值 | 用途 |
|-------|-----|------|
| `--color-bg` | `#f6f8fb` | 页面背景 |
| `--color-bg-card` | `#ffffff` | 卡片/面板背景 |
| `--color-blue` | `#2563eb` | 主蓝色（按钮、链接、高亮） |
| `--color-ink` | `#111827` | 主文字色 |
| `--color-muted` | `#6b7280` | 次级文字 |
| `--color-line` | `#e5e7eb` | 分割线/边框 |
| `--color-green` | `#16a34a` | 成功/完成状态 |
| `--color-warning` | `#f59e0b` | 警告/中等状态 |
| `--color-danger` | `#ef4444` | 错误/危险操作 |
| `--text-body` | `14px` | 正文标准字号 |
| `--text-small` | `13px` | 辅助文本书号 |
| `--radius-lg` | `12px` | 卡片圆角 |
| `--radius-md` | `10px` | 按钮圆角 |
| `--shadow-md` | `0 4px 16px rgba(15,23,42,.04)` | 标准卡片阴影 |

## 附录 B：关键文件索引

| 文件路径 | 用途 | 行数（约） |
|---------|------|-----------|
| `frontend/src/lib/api/types.ts` | TypeScript 类型定义 | 560 |
| `frontend/src/lib/api/real.ts` | 真实 API 实现层 | 1270 |
| `frontend/src/lib/api/index.ts` | 统一导出 + api 对象 | 130 |
| `frontend/src/app/layout.tsx` | 根布局（字体 + HTML 元数据） | 38 |
| `frontend/src/app/(shell)/layout.tsx` | 主应用 Layout | 150 |
| `frontend/src/app/tutor/page.tsx` | 智能辅导主页（最复杂页面） | 927 |
| `frontend/src/app/tutor/mcp-store/page.tsx` | MCP 插件商店 | 475 |
| `frontend/src/app/onboarding/page.tsx` | 画像建档向导 | 650+ |
| `frontend/src/app/(shell)/page.tsx` | 学习工作台 | 250+ |
| `frontend/src/app/globals.css` | 设计 Token + 全局样式 | 205 |
| `frontend/src/components/layout/Sidebar.tsx` | 侧边栏导航 | 130+ |
| `frontend/src/components/layout/Topbar.tsx` | 顶部栏 | 80+ |
| `frontend/src/components/layout/AIAssistant.tsx` | 全局 AI 助手 | 300+ |
| `frontend/src/components/layout/navigation.tsx` | 页面元数据 + 移动端 Tab | 44 |
| `frontend/src/components/ui/Button.tsx` | 通用按钮组件 | 49 |
| `frontend/package.json` | 依赖声明 | 36 |

---

*本文档基于 `develop-deeply-system` 分支代码库撰写，文件路径和行数均为 `frontend/src/` 相对路径。*
