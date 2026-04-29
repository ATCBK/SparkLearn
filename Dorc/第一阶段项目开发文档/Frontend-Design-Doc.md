# SparkLearn 前端设计文档

> **版本**: v1.0 · 2026-04-16
> **定位**: 前端开发的唯一执行依据
> **技术栈**: React 18 + Next.js 14 (App Router) + Tailwind CSS + Lucide React + TypeScript
> **设计语言**: Apple Pure

---

## 目录

1. [技术架构总览](#1-技术架构总览)
2. [目录结构与文件组织](#2-目录结构与文件组织)
3. [设计系统（Design Tokens）](#3-设计系统design-tokens)
4. [布局系统](#4-布局系统)
5. [路由与页面结构](#5-路由与页面结构)
6. [组件清单与分层](#6-组件清单与分层)
7. [状态管理策略](#7-状态管理策略)
8. [API 层设计（Mock ↔ Real 切换）](#8-api-层设计mock--real-切换)
9. [流式输出与等待动画](#9-流式输出与等待动画)
10. [资源渲染策略](#10-资源渲染策略)
11. [错误处理与空状态](#11-错误处理与空状态)
12. [侧栏折叠行为](#12-侧栏折叠行为)
13. [实现顺序与里程碑](#13-实现顺序与里程碑)
14. [各页面详细设计](#14-各页面详细设计)

---

## 1. 技术架构总览

### 1.1 技术选型

| 层级 | 选型 | 说明 |
|------|------|------|
| 框架 | Next.js 14 (App Router) | 文件系统路由、SSR、API Routes |
| UI 库 | React 18 | 组件化、Hooks、并发特性 |
| 样式 | Tailwind CSS | Utility-first、Design Tokens 通过 theme 配置 |
| 图标 | Lucide React | SVG 图标、风格统一、支持 stroke-width 自定义 |
| 语言 | TypeScript | 类型安全、IDE 自动补全 |
| 字体 | DM Sans + Noto Sans SC | Google Fonts，英文几何感 + 中文清晰度 |

### 1.2 核心设计原则

- **内容优先**：界面退居幕后，学习内容是主角
- **渐进披露**：信息按需呈现，折叠面板 + 卡片摘要
- **认知减负**：智能推荐 + 默认排序 + 预设筛选
- **一致性**：统一的卡片、标签、按钮系统

### 1.3 不使用的技术

- **不使用** Redux / Zustand / Jotai 等全局状态库 — 用页面级 useState + useReducer
- **不使用** CSS Modules / Styled Components — 用 Tailwind CSS
- **不使用** Material UI / Ant Design — 自定义组件保持 Apple Pure 风格
- **不使用** axios — 用原生 fetch + 封装层

---

## 2. 目录结构与文件组织

### 2.1 前端根目录

```
frontend/
├── public/
│   ├── fonts/                    # DM Sans 字体文件（备用本地加载）
│   ├── images/
│   │   └── xueersi-logo.png      # 学而思 Logo
│   └── illustrations/            # SVG 插画（错误页、空状态等）
│       ├── error-server.svg      # 服务器错误插画
│       ├── error-network.svg     # 网络错误插画
│       ├── empty-resources.svg   # 资源空状态
│       └── empty-tasks.svg       # 任务空状态
├── src/
│   ├── app/                      # Next.js App Router 页面
│   │   ├── layout.tsx            # 根 layout（字体、全局样式）
│   │   ├── page.tsx              # 01 首页学习总览
│   │   ├── globals.css           # 全局 CSS（Tailwind base + 自定义动画）
│   │   ├── (shell)/              # Route Group：带侧栏的页面
│   │   │   ├── layout.tsx        # Shell layout（Sidebar + Main Content）
│   │   │   ├── path/
│   │   │   │   └── page.tsx      # 02 学习路径
│   │   │   ├── resources/
│   │   │   │   └── page.tsx      # 03 资源中心
│   │   │   ├── practice/
│   │   │   │   └── page.tsx      # 04 练习与错题
│   │   │   ├── feed/
│   │   │   │   └── page.tsx      # 05 资源推送
│   │   │   ├── generate/
│   │   │   │   └── page.tsx      # 06 资源生成与详情
│   │   │   ├── tutor/
│   │   │   │   └── page.tsx      # 07 智能辅导
│   │   │   ├── report/
│   │   │   │   └── page.tsx      # 08 学习报告
│   │   │   ├── video/
│   │   │   │   └── page.tsx      # 09 视频播放
│   │   │   └── profile/
│   │   │       └── page.tsx      # 10 个人信息
│   │   ├── onboarding/
│   │   │   └── page.tsx          # 11 学习画像建档（无侧栏）
│   │   └── auth/
│   │       └── page.tsx          # 12 登录/注册（无侧栏）
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx       # 侧栏组件（三态折叠）
│   │   │   ├── NavItem.tsx       # 导航项
│   │   │   └── AppShell.tsx      # Shell 布局容器
│   │   ├── ui/
│   │   │   ├── Button.tsx        # 按钮（primary / secondary / ghost）
│   │   │   ├── Card.tsx          # 通用卡片
│   │   │   ├── Badge.tsx         # 标签/徽标
│   │   │   ├── Input.tsx         # 输入框
│   │   │   ├── ProgressBar.tsx   # 水平进度条
│   │   │   ├── ProgressRing.tsx  # SVG 圆环进度
│   │   │   ├── Skeleton.tsx      # 骨架屏
│   │   │   ├── TypewriterLoader.tsx  # 打字机等待动画
│   │   │   ├── ErrorState.tsx    # 错误状态（SVG 插画 + 文案 + 重试）
│   │   │   ├── EmptyState.tsx    # 空状态（SVG 插画 + 文案）
│   │   │   ├── Modal.tsx         # 模态弹窗
│   │   │   ├── Tabs.tsx          # 标签切换
│   │   │   └── Tooltip.tsx       # 工具提示
│   │   ├── charts/
│   │   │   ├── MasteryBar.tsx    # 掌握度条（渐变色）
│   │   │   ├── Heatmap.tsx       # 学习热力图
│   │   │   └── StatCard.tsx      # 统计数据卡片
│   │   ├── tutor/
│   │   │   ├── ChatBubble.tsx    # 对话气泡
│   │   │   ├── ChatInput.tsx     # 对话输入栏
│   │   │   └── CodeBlock.tsx     # 代码块（高亮 + 复制）
│   │   ├── quiz/
│   │   │   ├── SingleChoice.tsx  # 单选题组件
│   │   │   ├── MultiChoice.tsx   # 多选题组件
│   │   │   ├── FillBlank.tsx     # 填空题组件
│   │   │   └── QuizResult.tsx    # 答题结果
│   │   ├── resource/
│   │   │   ├── ResourceTypeGrid.tsx   # 六宫格资源类型选择
│   │   │   ├── ResourceCard.tsx       # 资源卡片
│   │   │   ├── ResourceListItem.tsx   # 资源列表项
│   │   │   └── PreviewPanel.tsx       # 资源预览面板
│   │   └── onboarding/
│   │       ├── StepIndicator.tsx      # 步骤指示器
│   │       └── ChatOnboarding.tsx     # 对话式建档
│   ├── lib/
│   │   ├── api/
│   │   │   ├── types.ts          # API 类型定义（唯一真相源）
│   │   │   ├── mock.ts           # Mock 数据实现
│   │   │   ├── real.ts           # 真实 API 实现
│   │   │   └── index.ts          # USE_MOCK 开关 + 统一导出
│   │   ├── hooks/
│   │   │   ├── useStreaming.ts   # 流式输出 Hook
│   │   │   ├── useDebounce.ts    # 防抖 Hook
│   │   │   └── useMediaQuery.ts  # 响应式断点 Hook
│   │   └── utils/
│   │       ├── cn.ts             # Tailwind classnames 合并
│   │       ├── format.ts         # 日期、时长格式化
│   │       └── constants.ts      # 常量定义
│   └── styles/
│       └── animations.css        # 自定义关键帧动画
├── tailwind.config.ts            # Tailwind 主题配置（Design Tokens）
├── next.config.js
├── tsconfig.json
└── package.json
```

### 2.2 文件组织原则

- **按功能分目录**，不按类型分（components/tutor/ 而非 components/chat/）
- **单文件 ≤ 200 行**，超过则拆分子组件
- **每个页面一个 page.tsx**，复杂页面拆出 page-client.tsx（客户端组件）
- **类型定义集中管理**：lib/api/types.ts 是所有 API 类型的唯一来源

---

## 3. 设计系统（Design Tokens）

### 3.1 Tailwind 主题配置

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1d1d1f',
          secondary: '#6e6e73',
          tertiary: '#86868b',
          disabled: '#aeaeb2',
        },
        blue: {
          DEFAULT: '#0071e3',
          dark: '#0077ed',
          light: 'rgba(0, 113, 227, 0.08)',
          glow: 'rgba(0, 113, 227, 0.15)',
        },
        teal: '#5ac8fa',
        bg: {
          DEFAULT: '#fbfbfd',
          card: '#ffffff',
          hover: '#f5f5f7',
          sidebar: 'rgba(251, 251, 253, 0.72)',
        },
        success: '#34c759',
        warning: '#ff9500',
        danger: '#ff3b30',
        purple: '#af52de',
      },
      fontFamily: {
        sans: ['"DM Sans"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['48px', { lineHeight: '1.1', fontWeight: '700' }],
        h1: ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['21px', { lineHeight: '1.4', fontWeight: '400' }],
        h3: ['17px', { lineHeight: '1.4', fontWeight: '700' }],
        body: ['15px', { lineHeight: '1.5', fontWeight: '500' }],
        small: ['14px', { lineHeight: '1.5', fontWeight: '500' }],
        caption: ['13px', { lineHeight: '1.5' }],
        micro: ['11px', { lineHeight: '1.5' }],
      },
      borderRadius: {
        sm: '12px',
        md: '16px',
        lg: '20px',
        xl: '28px',
        pill: '100px',
      },
      boxShadow: {
        sm: '0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)',
        md: '0 4px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)',
        lg: '0 8px 40px rgba(0,0,0,0.08)',
        xl: '0 20px 60px rgba(0,0,0,0.1)',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
        '5xl': '48px',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-left': 'slideInLeft 0.3s ease forwards',
        pulse: 'pulse 2s infinite',
        'bounce-subtle': 'bounceSubtle 3s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
```

### 3.2 动画系统

| 场景 | 动画 | 时长 | 缓动函数 |
|------|------|------|----------|
| 页面加载（交错） | fadeInUp + scaleIn | 500ms | cubic-bezier(0.16, 1, 0.3, 1) |
| 卡片悬浮 | translateY(-3px) + shadow-md | 250ms | ease |
| 进度条填充 | width transition | 800ms | ease |
| 导航项切换 | background + color | 200ms | ease |
| 侧栏折叠 | width transition | 300ms | ease |
| 等待动画 | 打字机 CSS 动画 | 3s 循环 | linear |
| 脉冲指示器 | scale + opacity | 2000ms | infinite |

**交错延迟类**（在 globals.css 中定义）：

```css
.delay-1 { animation-delay: 50ms; }
.delay-2 { animation-delay: 100ms; }
.delay-3 { animation-delay: 150ms; }
.delay-4 { animation-delay: 200ms; }
.delay-5 { animation-delay: 250ms; }
.delay-6 { animation-delay: 300ms; }
.delay-7 { animation-delay: 350ms; }
.delay-8 { animation-delay: 400ms; }
```

---

## 4. 布局系统

### 4.1 路由分组与布局嵌套

```
根 layout (src/app/layout.tsx)
├── 字体加载（DM Sans + Noto Sans SC）
├── 全局 CSS（Tailwind base + animations）
└── {children}

  ├── (shell)/layout.tsx          ← App Shell 布局
  │   ├── Sidebar（固定左侧）
  │   └── <main>（主内容区）
  │       └── {children}
  │
  ├── page.tsx                    ← 首页（在 shell 内）
  ├── (shell)/path/page.tsx       ← 学习路径（在 shell 内）
  ├── ...其他 (shell) 页面
  │
  ├── onboarding/page.tsx         ← 独立布局（无侧栏）
  └── auth/page.tsx               ← 独立布局（无侧栏）
```

### 4.2 App Shell 布局

```
┌──────────────────────────────────────────────────────────────┐
│ ┌────────────┐ ┌─────────────────────────────────────────────┐ │
│ │            │ │  Main Content                                │ │
│ │  Sidebar   │ │  padding: 40px 52px                          │ │
│ │  260px     │ │  max-width: 1200px                           │ │
│ │  fixed     │ │  margin-left: 260px（随侧栏状态变化）         │ │
│ │  left:0    │ │                                              │ │
│ │  top:0     │ │  ← 页面内容在这里渲染                        │ │
│ │  h-screen  │ │                                              │ │
│ │  z-40      │ │                                              │ │
│ └────────────┘ └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**关键 CSS 属性**：

```css
/* Sidebar */
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  z-index: 40;
  width: 260px;            /* 展开 */
  /* width: 64px;          图标栏 */
  /* width: 0;             完全收起 */
  background: rgba(251, 251, 253, 0.72);
  backdrop-filter: blur(60px) saturate(200%);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  transition: width 300ms ease;
}

/* Main Content */
.main-content {
  margin-left: 260px;      /* 跟随侧栏宽度变化 */
  padding: 40px 52px;
  max-width: 1200px;
  transition: margin-left 300ms ease;
}
```

### 4.3 双列布局

页面内部使用 CSS Grid 实现双列布局：

```css
.content-grid {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 24px;
}
```

| 左列 | 右列 |
|------|------|
| 弹性宽度 | 固定 360px |
| 主要操作内容（任务、资源、对话） | 辅助信息（阶段、画像、掌握度） |
| 信息密度较高 | 阅读优先 |

**响应式降级**：< 1200px 时变为单列，右列堆叠到左列下方。

---

## 5. 路由与页面结构

### 5.1 路由表

| 编号 | 页面 | 路由 | 布局 | 说明 |
|------|------|------|------|------|
| 01 | 首页学习总览 | `/` | shell | Hero + 特色卡片 + 统计 + 任务列表 |
| 02 | 学习路径 | `/path` | shell | 知识图谱 + 阶段规划 |
| 03 | 资源中心 | `/resources` | shell | 搜索 + 分类浏览 |
| 04 | 练习与错题 | `/practice` | shell | 刷题 + 错题本 |
| 05 | 资源推送 | `/feed` | shell | AI 个性化推荐 |
| 06 | 资源生成与详情 | `/generate` | shell | AI 生成 + 在线预览 + 保存 |
| 07 | 智能辅导 | `/tutor` | shell | AI 对话式辅导 |
| 08 | 学习报告 | `/report` | shell | 数据可视化 + 薄弱点分析 |
| 09 | 视频播放 | `/video` | shell | 视频播放器 |
| 10 | 个人信息 | `/profile` | shell | 账户设置 |
| 11 | 学习画像建档 | `/onboarding` | standalone | 对话式建档流程 |
| 12 | 登录/注册 | `/auth` | standalone | 用户认证 |

### 5.2 页面间导航流

```
/auth → /onboarding → /
                         ├── /path
                         ├── /resources
                         ├── /practice
                         ├── /feed
                         ├── /generate
                         ├── /tutor
                         ├── /report
                         ├── /video
                         └── /profile
```

首次使用：/auth → /onboarding（必须完成，不可跳过）→ /

非首次：/auth → /

---

## 6. 组件清单与分层

### 6.1 组件分层架构

```
Layer 3: 页面组件（Page Components）
  └── 每个 page.tsx，负责数据获取 + 组合布局

Layer 2: 业务组件（Feature Components）
  └── ChatBubble, QuizCard, ResourceCard, TypewriterLoader, etc.

Layer 1: 基础 UI 组件（UI Primitives）
  └── Button, Card, Badge, Input, Skeleton, ErrorState, etc.

Layer 0: 工具层（Utilities）
  └── cn(), format(), hooks, API layer
```

### 6.2 基础 UI 组件规范

#### Button

```tsx
// 三种变体
<Button variant="primary">生成资源</Button>     // 蓝色实心
<Button variant="secondary">取消</Button>       // 浅灰边框
<Button variant="ghost">跳过</Button>           // 无边框，文字色

// 尺寸
<Button size="sm">小按钮</Button>               // h-8 px-3 text-small
<Button size="md">中按钮</Button>               // h-10 px-4 text-body
<Button size="lg">大按钮</Button>               // h-12 px-6 text-h3
```

#### Card

```tsx
// 默认卡片：白色背景 + shadow-sm + rounded-lg
<Card className="p-5">内容</Card>

// 可悬浮卡片：hover 时 translateY(-3px) + shadow-md
<Card hoverable>内容</Card>

// 深色特色卡片：用于 Featured Card
<Card variant="dark">内容</Card>
```

#### ErrorState

```tsx
// 错误状态：SVG 插画 + 友好文案 + 重试按钮
// 绝不使用红色，用插画传达情感
<ErrorState
  type="server"              // server | network | generic
  title="出了点小问题"
  description="服务器暂时无法响应，请稍后再试"
  onRetry={() => refetch()}
/>
```

#### EmptyState

```tsx
// 空状态：SVG 插画 + 引导文案
<EmptyState
  type="resources"           // resources | tasks | quiz
  title="还没有生成过资源"
  description="前往资源生成页面，让 AI 为你创建学习资料吧"
  action={{ label: '去生成', href: '/generate' }}
/>
```

#### Skeleton

```tsx
// 骨架屏：用于页面加载态
<Skeleton className="h-12 w-full rounded-lg" />
<Skeleton className="h-48 w-full rounded-lg" />
```

#### TypewriterLoader

```tsx
// 打字机等待动画：CSS 纯实现，3s 循环
// 颜色使用 Apple Blue (#0071e3 / #0077ed)
<TypewriterLoader />
<TypewriterLoader text="AI 正在为你生成资源..." />
```

### 6.3 业务组件清单

| 组件 | 文件 | 说明 | 使用页面 |
|------|------|------|----------|
| Sidebar | `components/layout/Sidebar.tsx` | 三态折叠侧栏 | 全局 |
| NavItem | `components/layout/NavItem.tsx` | 导航项（高亮 + 徽标） | 侧栏 |
| HeroHeader | 首页内联 | 大标题 + 日期 + 副标题 | 首页 |
| FeaturedCard | 首页内联 | 深色特色卡片 | 首页 |
| StatCard | `components/charts/StatCard.tsx` | 统计数据卡片 | 首页、报告 |
| TaskItem | 首页内联 | 任务列表项（可勾选） | 首页 |
| ProgressRing | `components/ui/ProgressRing.tsx` | SVG 圆环进度 | 首页、报告 |
| MasteryBar | `components/charts/MasteryBar.tsx` | 掌握度条 | 首页、报告 |
| Heatmap | `components/charts/Heatmap.tsx` | 学习热力图 | 首页 |
| ChatBubble | `components/tutor/ChatBubble.tsx` | 对话气泡 | 辅导 |
| ChatInput | `components/tutor/ChatInput.tsx` | 对话输入栏 | 辅导 |
| CodeBlock | `components/tutor/CodeBlock.tsx` | 代码高亮块 | 辅导 |
| SingleChoice | `components/quiz/SingleChoice.tsx` | 单选题 | 练习 |
| MultiChoice | `components/quiz/MultiChoice.tsx` | 多选题 | 练习 |
| FillBlank | `components/quiz/FillBlank.tsx` | 填空题 | 练习 |
| ResourceTypeGrid | `components/resource/ResourceTypeGrid.tsx` | 六宫格选择器 | 生成 |
| ResourceCard | `components/resource/ResourceCard.tsx` | 资源卡片 | 推送、资源中心 |
| PreviewPanel | `components/resource/PreviewPanel.tsx` | 资源预览面板 | 生成 |
| StepIndicator | `components/onboarding/StepIndicator.tsx` | 步骤指示器 | 建档 |
| ChatOnboarding | `components/onboarding/ChatOnboarding.tsx` | 对话式建档 | 建档 |
| VideoPlayer | 页面内联 | 视频播放器 | 视频 |

---

## 7. 状态管理策略

### 7.1 原则

- **页面级状态**：每个页面自己管理自己的状态，不跨页面共享
- **useState**：简单状态（当前选中项、输入值、开关状态）
- **useReducer**：复杂状态（题目列表、资源列表、对话消息列表）
- **不使用**全局状态库（Redux / Zustand / Jotai）

### 7.2 典型状态管理模式

#### 简单页面（如首页）

```tsx
'use client'

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getTodayTasks()
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardSkeleton />
  if (error) return <ErrorState type="server" onRetry={refetch} />
  return <DashboardContent tasks={tasks} />
}
```

#### 复杂页面（如练习页）

```tsx
'use client'

type QuizState = {
  questions: Question[]
  currentIndex: number
  answers: Record<number, string[]>
  submitted: Record<number, boolean>
  results: Record<number, boolean>
}

type QuizAction =
  | { type: 'SELECT_ANSWER'; questionId: number; answer: string }
  | { type: 'SUBMIT_ANSWER'; questionId: number }
  | { type: 'NEXT_QUESTION' }
  | { type: 'LOAD_QUESTIONS'; questions: Question[] }

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'SELECT_ANSWER':
      // 不可变更新
      return { ...state, answers: { ...state.answers, [action.questionId]: [action.answer] } }
    // ...
  }
}
```

#### 流式对话页面（如辅导页）

```tsx
'use client'

type ChatState = {
  messages: Message[]
  streaming: boolean
  currentStreamedText: string
}

// 流式消息追加模式
function appendMessage(state: ChatState, chunk: string): ChatState {
  return { ...state, currentStreamedText: state.currentStreamedText + chunk }
}

function finalizeMessage(state: ChatState): ChatState {
  return {
    ...state,
    messages: [...state.messages, { role: 'assistant', content: state.currentStreamedText }],
    streaming: false,
    currentStreamedText: '',
  }
}
```

---

## 8. API 层设计（Mock ↔ Real 切换）

### 8.1 架构

```
src/lib/api/
├── types.ts     ← 所有 API 类型定义（唯一真相源）
├── mock.ts      ← Mock 数据实现（返回 Promise，模拟延迟）
├── real.ts      ← 真实 API 实现（fetch 调用后端）
└── index.ts     ← USE_MOCK 开关 + 统一导出函数
```

### 8.2 切换机制

```typescript
// src/lib/api/index.ts
import * as mock from './mock'
import * as real from './real'

const USE_MOCK = true  // ← 全局开关，切换时只改这一个值

export const api = {
  getTodayTasks: USE_MOCK ? mock.getTodayTasks : real.getTodayTasks,
  getResources: USE_MOCK ? mock.getResources : real.getResources,
  generateResource: USE_MOCK ? mock.generateResource : real.generateResource,
  // ... 所有 API 方法
}
```

### 8.3 类型约束

所有 Mock 和 Real 实现必须遵循 types.ts 中定义的类型签名：

```typescript
// src/lib/api/types.ts

export interface Task {
  id: string
  title: string
  type: 'video' | 'reading' | 'quiz' | 'practice'
  status: 'pending' | 'in_progress' | 'completed'
  duration: number  // 分钟
}

export interface Resource {
  id: string
  title: string
  type: 'document' | 'ppt' | 'mindmap' | 'quiz' | 'reading' | 'code'
  status: 'generating' | 'completed' | 'failed'
  createdAt: string
  content?: string
  videoUrl?: string
}

export interface StudentProfile {
  id: string
  name: string
  major: string
  grade: string
  goals: string[]
  knowledgeLevel: string
  weakPoints: string[]
  learningPreference: string[]
  cognitiveStyle: string
  dailyTime: number
  practicalAbility: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface QuizQuestion {
  id: string
  type: 'single' | 'multiple' | 'fill_blank'
  content: string
  options?: string[]
  correctAnswer: string | string[]
  explanation: string
}

// API 函数签名
export interface ApiFunctions {
  getTodayTasks(): Promise<Task[]>
  getResources(): Promise<Resource[]>
  generateResource(type: Resource['type'], prompt: string): Promise<Resource>
  getProfile(): Promise<StudentProfile>
  sendMessage(content: string): Promise<ReadableStream>  // 流式
  getQuizQuestions(chapter: string): Promise<QuizQuestion[]>
  getReport(): Promise<ReportData>
}
```

### 8.4 Mock 实现模式

```typescript
// src/lib/api/mock.ts
import type { Task, Resource } from './types'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function getTodayTasks(): Promise<Task[]> {
  await delay(300)  // 模拟网络延迟
  return [
    { id: '1', title: 'Python 变量与数据类型', type: 'video', status: 'pending', duration: 25 },
    { id: '2', title: '函数定义与调用练习', type: 'quiz', status: 'in_progress', duration: 15 },
    // ...
  ]
}
```

### 8.5 Real 实现模式

```typescript
// src/lib/api/real.ts
import type { Task } from './types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function getTodayTasks(): Promise<Task[]> {
  const res = await fetch(`${BASE_URL}/api/tasks/today`)
  if (!res.ok) throw new Error(`获取任务失败: ${res.status}`)
  return res.json()
}
```

### 8.6 Mock 到 Real 的切换流程

1. 后端接口开发完成
2. 在 `real.ts` 中实现对应方法
3. 运行类型检查：`tsc --noEmit`（确保类型签名一致）
4. 将 `index.ts` 中 `USE_MOCK` 改为 `false`
5. 测试每个页面是否正常工作
6. 如果某个接口还没完成，`USE_MOCK` 保持 `true`，`real.ts` 中未实现的方法会报错，提示开发者

---

## 9. 流式输出与等待动画

### 9.1 两种流式模式

| 模式 | 使用场景 | 效果 |
|------|----------|------|
| **打字机模式** | 智能辅导对话 | 文字逐字出现，模拟打字效果 |
| **进度模式** | 资源生成 | 进度条 + 等待动画 + 状态文字 |

### 9.2 打字机模式（辅导对话）

```typescript
// src/lib/hooks/useStreaming.ts
export function useStreaming(url: string) {
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const startStream = useCallback(async (body: object) => {
    setIsStreaming(true)
    setText('')

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()

    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      setText(prev => prev + chunk)
    }

    setIsStreaming(false)
  }, [url])

  return { text, isStreaming, startStream }
}
```

**视觉效果**：AI 气泡中文字逐字出现，光标闪烁指示正在输入。

### 9.3 进度模式（资源生成）

生成资源时的等待体验：

1. 用户点击"生成" → 按钮变为 loading 态
2. 页面显示 `TypewriterLoader` + 状态文字（"AI 正在为你生成资源..."）
3. 后端返回进度 → 进度条填充（0% → 100%）
4. 生成完成 → 自动切换到预览面板

```tsx
{resource.status === 'generating' && (
  <div className="flex flex-col items-center justify-center py-16 gap-6">
    <TypewriterLoader />
    <p className="text-ink-secondary text-body">AI 正在为你生成资源...</p>
    <ProgressBar value={resource.progress} className="w-64" />
  </div>
)}
```

### 9.4 打字机等待动画（TypewriterLoader）

从 StyleDemo/打字机.html 移植的纯 CSS 动画，颜色适配为 Apple Blue：

```tsx
// src/components/ui/TypewriterLoader.tsx
export function TypewriterLoader({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="typewriter">
        <div className="slide"><i></i></div>
        <div className="paper"></div>
        <div className="keyboard"></div>
      </div>
      {text && <p className="text-ink-secondary text-small">{text}</p>}
    </div>
  )
}
```

颜色映射：
- 原 `#5C86FF` → `#0071e3`
- 原 `#275EFE` → `#0077ed`
- 其他颜色（tool 黄、paper 灰）保持不变

---

## 10. 资源渲染策略

### 10.1 六种资源类型的渲染方式

| 资源类型 | 后端输出格式 | 前端渲染方式 | 组件/库 |
|----------|-------------|-------------|---------|
| 课程讲解文档 | Markdown 文本 | react-markdown + remark-gfm | react-markdown |
| PPT | Docmee iframe URL | 全屏面板嵌入 iframe | Docmee UI SDK |
| 思维导图 | Markdown 大纲 | markmap 渲染为交互式脑图 | markmap-autoloader |
| 练习题 | JSON 结构化数据 | 自定义 Quiz 组件 | SingleChoice / MultiChoice / FillBlank |
| 拓展阅读 | Markdown 文本 | react-markdown 渲染 | react-markdown |
| 代码实操案例 | Markdown（含代码块） | react-markdown + CodeBlock 高亮 | react-markdown + prism |

### 10.2 渲染组件映射

```typescript
// src/lib/utils/resourceRenderer.ts
import type { Resource } from '@/lib/api/types'

export function getResourceRenderer(type: Resource['type']) {
  switch (type) {
    case 'document':
    case 'reading':
      return 'markdown'        // react-markdown 渲染
    case 'ppt':
      return 'docmee'          // Docmee iframe
    case 'mindmap':
      return 'markmap'         // markmap 渲染
    case 'quiz':
      return 'quiz'            // 自定义 Quiz 组件
    case 'code':
      return 'markdown'        // react-markdown（含代码块高亮）
  }
}
```

### 10.3 Docmee PPT 预览

PPT 资源点击后展开为全屏/大面板，嵌入 Docmee iframe：

```tsx
// 资源预览面板中的 PPT 渲染
{resource.type === 'ppt' && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
    <div className="bg-bg-card rounded-xl w-[90vw] h-[85vh] overflow-hidden shadow-xl">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-h3 text-ink">{resource.title}</h3>
        <button onClick={onClose}><X className="w-5 h-5" /></button>
      </div>
      <iframe
        src={`https://docmee.cn/ui/ppt?id=${resource.docmeeId}`}
        className="w-full h-[calc(100%-56px)]"
        allowFullScreen
      />
    </div>
  </div>
)}
```

### 10.4 视频播放

视频由后端代码生成（python-pptx + moviepy + 讯飞 TTS），返回结构化数据 + .mp4 URL。前端只需 `<video>` 标签播放：

```tsx
<video
  src={resource.videoUrl}
  controls
  className="w-full rounded-lg aspect-video"
/>
```

---

## 11. 错误处理与空状态

### 11.1 错误处理原则

- **不使用红色**，用 SVG 插画传达友好情感
- **所有错误都提供重试按钮**
- **错误文案友好**，不暴露技术细节

### 11.2 错误分类与处理

| 错误类型 | 触发场景 | 插画 | 标题 | 处理方式 |
|----------|----------|------|------|----------|
| 服务器错误 | API 返回 5xx | error-server.svg | "出了点小问题" | 重试按钮 |
| 网络错误 | 请求超时/断网 | error-network.svg | "网络不太给力" | 重试按钮 |
| 生成失败 | 资源生成超时 | error-server.svg | "生成遇到了问题" | 重试按钮 |
| 通用错误 | 其他异常 | error-server.svg | "好像出了点状况" | 重试 + 返回首页 |

### 11.3 ErrorState 组件

```tsx
// src/components/ui/ErrorState.tsx
interface ErrorStateProps {
  type: 'server' | 'network' | 'generic'
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({ type, title, description, onRetry }: ErrorStateProps) {
  const illustrations = {
    server: '/illustrations/error-server.svg',
    network: '/illustrations/error-network.svg',
    generic: '/illustrations/error-server.svg',
  }

  const defaults = {
    server: { title: '出了点小问题', desc: '服务器暂时无法响应，请稍后再试' },
    network: { title: '网络不太给力', desc: '请检查网络连接后重试' },
    generic: { title: '好像出了点状况', desc: '遇到了意外错误，请重试' },
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <img src={illustrations[type]} alt="" className="w-48 h-48" />
      <h3 className="text-h3 text-ink">{title || defaults[type].title}</h3>
      <p className="text-body text-ink-secondary">
        {description || defaults[type].desc}
      </p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry} className="mt-2">
          重试
        </Button>
      )}
    </div>
  )
}
```

### 11.4 空状态处理

| 场景 | 插画 | 标题 | 引导操作 |
|------|------|------|----------|
| 无资源 | empty-resources.svg | "还没有生成过资源" | "去生成" → /generate |
| 无任务 | empty-tasks.svg | "今天还没有任务" | "去看看学习路径" → /path |
| 无错题 | - | "还没有错题记录" | "去做练习" → /practice |
| 无推送 | empty-resources.svg | "暂无推荐" | "完善学习画像" → /profile |

### 11.5 资源生成失败处理

资源生成失败时：
1. 资源状态标记为 `failed`
2. 列表项显示友好提示（非红色）+ "重试" 按钮
3. 点击重试 → 重新发起生成请求 → 状态变回 `generating`

```tsx
{resource.status === 'failed' && (
  <div className="flex items-center gap-3 p-3 bg-bg-hover rounded-lg">
    <AlertCircle className="w-5 h-5 text-ink-secondary" />
    <span className="text-small text-ink-secondary">生成失败</span>
    <Button variant="ghost" size="sm" onClick={() => retryGenerate(resource.id)}>
      重试
    </Button>
  </div>
)}
```

### 11.6 加载状态

- **页面级加载**：骨架屏（Skeleton），不使用 Spinner
- **组件级加载**：骨架屏或 TypewriterLoader（等待动画）
- **按钮级加载**：按钮内部 spinner + 禁用态

---

## 12. 侧栏折叠行为

### 12.1 三种状态

| 状态 | 宽度 | 内容 | 触发 |
|------|------|------|------|
| **展开** | 260px | Logo + 导航文字 + 底部名言 + 用户信息 | 默认 / 点击箭头 |
| **图标栏** | 64px | Logo 小图标 + 导航图标（无文字） | 点击收起按钮 |
| **完全收起** | 0px + 箭头 | 仅一个 `>` 箭头贴左边缘 | 图标栏再次收起 |

### 12.2 状态切换流程

```
展开(260px) ──点击 PanelLeftClose──→ 图标栏(64px)
图标栏(64px) ──点击收起──→ 完全收起(箭头)
完全收起(箭头) ──点击箭头──→ 展开(260px)
```

### 12.3 Logo 在各状态下的表现

| 状态 | Logo 显示 |
|------|-----------|
| 展开 | 学而思 Logo 图片 + "SparkLearn" 文字 |
| 图标栏 | 学而思 Logo 小图标（居中，32×32） |
| 完全收起 | 不显示 |

### 12.4 折叠切换按钮

- **展开 → 图标栏**：侧栏底部的 `PanelLeftClose` Lucide 图标
- **图标栏 → 完全收起**：侧栏底部的 `ChevronLeft` Lucide 图标
- **完全收起 → 展开**：左边缘的 `ChevronRight` 图标按钮（固定定位，始终可见）

### 12.5 侧栏内容分层

```
展开状态 (260px):
┌────────────────────┐
│ [Logo] SparkLearn  │  ← Logo 区域
│                    │
│ ● 首页总览         │  ← 导航组 1（学习模块）
│   学习路径         │
│   资源中心         │
│   练习与错题       │
│   资源推送         │
│   资源生成         │
│                    │
│   智能辅导         │  ← 导航组 2（工具模块）
│   学习报告         │
│   视频播放         │
│                    │
│ ──────────────     │
│ "每日名言..."      │  ← 底部名言区
│ [头像] 用户名      │  ← 用户信息
│        [收起按钮]  │  ← PanelLeftClose
└────────────────────┘

图标栏状态 (64px):
┌──────┐
│ Logo │
│      │
│  ◻   │
│  ◻   │
│  ◻   │
│  ◻   │
│  ◻   │
│      │
│  ◻   │
│  ◻   │
│  ◻   │
│      │
│ ───  │
│  ◻   │  ← 收起按钮
└──────┘
```

### 12.6 响应式联动

| 断点 | 侧栏行为 |
|------|----------|
| ≥ 1200px | 默认展开，用户可手动折叠 |
| 768px - 1199px | 默认图标栏（64px） |
| < 768px | 默认完全收起，汉堡菜单触发展开（覆盖层） |

---

## 13. 实现顺序与里程碑

### 阶段 1：基础骨架（Day 1-2）

搭建项目脚手架、设计系统、布局系统。

- [ ] `npx create-next-app` 初始化项目（TypeScript + Tailwind）
- [ ] 配置 tailwind.config.ts（Design Tokens）
- [ ] 实现 globals.css（字体、动画、基础样式）
- [ ] 创建基础 UI 组件：Button、Card、Badge、Input、Skeleton、ErrorState、EmptyState
- [ ] 实现 Sidebar 组件（三态折叠）
- [ ] 实现 (shell)/layout.tsx（App Shell 布局）
- [ ] 实现 API 层：types.ts + mock.ts + index.ts（USE_MOCK 开关）
- [ ] 首页 page.tsx 骨架（数据获取 + 骨架屏 + 错误态）

### 阶段 2：核心组件（Day 3-4）

构建各页面需要的业务组件。

- [ ] HeroHeader、FeaturedCard、StatCard
- [ ] ProgressRing、MasteryBar、Heatmap
- [ ] TaskItem、ResourceItem
- [ ] ChatBubble、ChatInput、CodeBlock
- [ ] SingleChoice、MultiChoice、FillBlank
- [ ] ResourceTypeGrid、PreviewPanel
- [ ] TypewriterLoader（从 StyleDemo 移植 CSS）
- [ ] StepIndicator

### 阶段 3：核心页面（Day 5-8）

实现赛题必须的核心页面。

- [ ] **01 首页学习总览**：Hero + 特色卡片 + 统计 + 任务列表 + 右侧信息栏
- [ ] **11 学习画像建档**：对话式建档流程（3 轮对话）
- [ ] **06 资源生成与详情**：六宫格选择 + 需求输入 + 资源列表 + 预览面板
- [ ] **02 学习路径**：阶段步骤 + 知识树 + 章节详情

### 阶段 4：工具页面（Day 9-11）

实现辅助功能页面。

- [ ] **07 智能辅导**：对话式辅导 + 流式输出 + 代码高亮
- [ ] **04 练习与错题**：题目作答 + 结果展示 + 错题本
- [ ] **03 资源中心**：搜索 + 分类筛选 + 资源列表
- [ ] **05 资源推送**：AI 推荐卡片 + 推荐理由

### 阶段 5：完善页面（Day 12-14）

实现报告、视频、个人等页面。

- [ ] **08 学习报告**：统计卡片 + 图表 + 薄弱点 + AI 分析
- [ ] **09 视频播放**：视频播放器
- [ ] **10 个人信息**：表单 + 统计摘要
- [ ] **12 登录/注册**：表单 + 左右分割布局

### 阶段 6：联调与打磨（Day 15-17）

- [ ] API 层 real.ts 实现（对接后端）
- [ ] Mock → Real 切换测试
- [ ] 响应式适配（桌面/平板/移动端）
- [ ] 动画打磨、过渡效果
- [ ] 错误边界、兜底处理
- [ ] 性能优化（懒加载、代码分割）

---

## 14. 各页面详细设计

### 14.1 首页学习总览（/）

#### 布局

```
┌─ Hero Header ──────────────────────────────────────┐
│ 2026年4月16日 · 星期三                               │
│ 继续你的<span class="gradient">学习之旅</span>        │
│ 你已经连续学习 12 天了                              │
└────────────────────────────────────────────────────┘

┌─ Featured Card (深色背景) ─────────────────────────┐
│ [进度环 75%]   Python 程序设计                      │
│                基础语法 → 函数 → [面向对象] → 模块   │
└────────────────────────────────────────────────────┘

┌─ Stats Row (4列) ──────────────────────────────────┐
│ 学习时长 12.5h │ 任务完成率 78% │ 正确率 85% │ 12天 │
└────────────────────────────────────────────────────┘

┌─ Content Grid (1fr + 360px) ───────────────────────┐
│ ┌─ 今日任务 ──────┐ ┌─ 信息栏 ────────────────┐   │
│ │ ☐ 视频 25min   │ │ 学习阶段: 基础语法       │   │
│ │ ☑ 练习 15min   │ │ 画像标签: [视觉型] [实践] │   │
│ │ ☐ 阅读 20min   │ │ 知识掌握度:              │   │
│ │                │ │ ██░░░░░░ 62%             │   │
│ │ 最近学习       │ │                          │   │
│ │ · 变量与类型   │ │ [热力图]                 │   │
│ │ · 条件语句     │ │                          │   │
│ └────────────────┘ └──────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

#### 数据获取

```typescript
// 页面加载时并行请求
const [tasks, resources, profile, stats, mastery] = await Promise.all([
  api.getTodayTasks(),
  api.getRecentResources(),
  api.getProfile(),
  api.getDashboardStats(),
  api.getMasteryData(),
])
```

#### 状态管理

```typescript
const [tasks, setTasks] = useState<Task[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

// 任务勾选完成
function toggleTask(taskId: string) {
  setTasks(prev => prev.map(t =>
    t.id === taskId ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
  ))
  api.completeTask(taskId)  // 异步同步到后端
}
```

---

### 14.2 学习画像建档（/onboarding）

#### 流程

```
Step 1: 课程与目标
  "你想学习什么课程？你的学习目标是什么？"
  → 收集：课程、目标

Step 2: 基础与薄弱点
  "你的编程基础如何？哪些方面需要加强？"
  → 收集：knowledgeLevel、weakPoints

Step 3: 学习偏好
  "你喜欢怎样的学习方式？"
  → 收集：learningPreference、cognitiveStyle

Step 4: 时间与实操
  "每天能学多久？动手能力怎么样？"
  → 收集：dailyTime、practicalAbility

Step 5: 确认画像
  展示收集到的画像摘要，确认后跳转首页
```

#### 设计要点

- **不可跳过**：必须完成所有步骤才能进入首页
- **对话式**：每个步骤是对话气泡风格，不是传统表单
- **步骤指示器**：页面顶部显示 5 步进度
- **支持语音输入**：每个步骤的输入框旁有麦克风按钮
- **AI 提问是流式输出**：问题以打字机效果逐字出现

---

### 14.3 资源生成与详情（/generate）

#### 布局

```
┌─ 资源类型选择器（六宫格）──────────────────────┐
│ [文档] [PPT] [思维导图] [练习] [阅读] [代码]    │
└────────────────────────────────────────────────┘

┌─ 需求描述区 ───────────────────────────────────┐
│ 请描述你需要的学习资源...                       │
│ [Python] [基础巩固] [函数] ← 快捷标签           │
│                                     [生成]     │
└────────────────────────────────────────────────┘

┌─ Content Grid ─────────────────────────────────┐
│ ┌─ 资源列表 ──────┐ ┌─ 预览面板 ────────────┐ │
│ │ ● 变量详解      │ │                       │ │
│ │   类型: 文档    │ │  [Markdown 渲染预览]   │ │
│ │   状态: 完成 ✓  │ │                       │ │
│ │                 │ │  [下载] [保存到资源中心]│ │
│ │ ○ 函数思维导图  │ │                       │ │
│ │   类型: 思维导图│ │                       │ │
│ │   状态: 生成中  │ │                       │ │
│ │   [打字机动画]  │ │                       │ │
│ │                 │ │                       │ │
│ │ ○ 练习题集      │ │                       │ │
│ │   类型: 练习    │ │                       │ │
│ │   状态: 失败 ✗  │ │                       │ │
│ │   [重试]        │ │                       │ │
│ └─────────────────┘ └───────────────────────┘ │
└────────────────────────────────────────────────┘
```

#### 核心交互

1. **选择资源类型** → 六宫格高亮
2. **输入需求** → 支持自然语言 + 快捷标签
3. **点击生成** → 资源列表新增一项，状态为 `generating`，显示 TypewriterLoader
4. **生成中** → 用户可点击其他已完成的资源查看（不锁定）
5. **生成完成** → 状态变更为 `completed`，自动切换到预览
6. **生成失败** → 状态变更为 `failed`，显示重试按钮，点击重新生成
7. **保存** → 预览面板底部"保存到资源中心"按钮

#### 状态管理

```typescript
type GenerateState = {
  resources: Resource[]           // 已生成和正在生成的资源列表
  selectedType: Resource['type']  // 当前选中的资源类型
  selectedId: string | null       // 当前选中查看的资源 ID
  prompt: string                  // 用户输入的需求描述
}

type GenerateAction =
  | { type: 'ADD_RESOURCE'; resource: Resource }
  | { type: 'UPDATE_RESOURCE'; id: string; updates: Partial<Resource> }
  | { type: 'SELECT_TYPE'; resourceType: Resource['type'] }
  | { type: 'SELECT_RESOURCE'; id: string }
  | { type: 'SET_PROMPT'; prompt: string }
```

---

### 14.4 智能辅导（/tutor）

#### 布局

```
┌─ 对话区域（滚动）──────────────────────────────┐
│                                                │
│  ┌─ AI 气泡（左）──────────────┐               │
│ │ 你好！有什么 Python 问题？    │               │
│ └──────────────────────────────┘               │
│                                                │
│                     ┌─ 用户气泡（右）─────────┐│
│                     │ 什么是闭包？             ││
│                     └────────────────────────┘│
│                                                │
│  ┌─ AI 气泡（左）──────────────────────────┐   │
│ │ 闭包是一个函数，它记住了创建时的环境...    │   │
│ │                                          │   │
│ │ ```python                                │   │
│ │ def outer(x):                            │   │
│ │     def inner(y):                        │   │
│ │         return x + y                     │   │
│ │     return inner                         │   │
│ │ ```                                      │   │
│ │                                          │   │
│ │ 你看这个例子中，inner 函数"捕获"了变量 x │   │
│ └──────────────────────────────────────────┘   │
│                                                │
└────────────────────────────────────────────────┘

┌─ 输入栏（固定底部）───────────────────────────┐
│ [  请输入你的问题...         ] [ ] [发送]      │
│                                   ↑ 语音按钮   │
└────────────────────────────────────────────────┘
```

#### 流式输出实现

AI 回复以流式方式逐字显示：

```typescript
const { text, isStreaming, startStream } = useStreaming('/api/tutor/chat')

// 用户发送消息后
await startStream({ message: userQuestion })

// text 变量实时更新，驱动 ChatBubble 渲染
// isStreaming 为 true 时，气泡底部显示光标闪烁
```

#### 代码块处理

AI 回复中的 ``` 代码块使用 CodeBlock 组件渲染：
- 等宽字体
- 浅灰背景
- 语法高亮（Prism.js）
- 右上角"复制"按钮

---

### 14.5 练习与错题（/practice）

#### 布局

```
┌─ Tab 切换 ─────────────────────────────────────┐
│ [练习]  [错题本]  [收藏]                        │
└────────────────────────────────────────────────┘

┌─ Content Grid (1fr + 280px) ───────────────────┐
│ ┌─ 题目区域 ──────────┐ ┌─ 辅助信息 ──────────┐│
│ │                     │ │ 正确率 [环形图 85%]  ││
│ │ 第 3 题 / 10        │ │                     ││
│ │                     │ │ 题号导航:           ││
│ │ 以下哪个是 Python   │ │ [1✓][2✓][3●][4 ][5] ││
│ │ 的可变数据类型？    │ │ [6 ][7 ][8 ][9 ][10]││
│ │                     │ │                     ││
│ │ ○ A. tuple          │ │  ✓ = 正确           ││
│ │ ○ B. list           │ │  ✗ = 错误           ││
│ │ ○ C. string         │ │  ● = 当前           ││
│ │ ○ D. int            │ │  空 = 未做          ││
│ │                     │ │                     ││
│ │ [提交答案]          │ │                     ││
│ └─────────────────────┘ └─────────────────────┘│
└────────────────────────────────────────────────┘
```

#### 答题交互规则

| 题型 | 交互方式 | 反馈时机 |
|------|----------|----------|
| 单选题 | 点击选项即时提交 | 立即显示对错 + 解释 |
| 多选题 | 勾选多个 → 点击"提交" | 提交后显示对错 + 解释 |
| 填空题 | 输入框 + 点击"提交" | 提交后显示对错 + 解释 |

#### 答题反馈

```tsx
// 选择后的反馈区域
{submitted && (
  <div className={`p-4 rounded-lg ${isCorrect ? 'bg-success/10' : 'bg-warning/10'}`}>
    <p className="text-body">
      {isCorrect ? '回答正确！' : '不太对哦，再想想？'}
    </p>
    <p className="text-small text-ink-secondary mt-2">
      {question.explanation}
    </p>
  </div>
)}
```

---

### 14.6 学习路径（/path）

#### 布局

```
┌─ 页面标题 ─────────────────────────────────────┐
│ 学习路径                                       │
│ 为你规划的 Python 学习路线                      │
└────────────────────────────────────────────────┘

┌─ Content Grid (280px + 1fr) ───────────────────┐
│ ┌─ 阶段步骤 ─────┐ ┌─ 知识图谱 ──────────────┐│
│ │                │ │                         ││
│ │ ✓ 基础语法     │ │  [树形结构/知识图谱]     ││
│ │ ● 函数与模块   │ │                         ││
│ │ ○ 面向对象     │ │  Python                 ││
│ │ ○ 文件处理     │ │  ├── 基础语法 ✓         ││
│ │ ○ 高级特性     │ │  │   ├── 变量 ✓         ││
│ │                │ │  │   ├── 数据类型 ✓     ││
│ │ 当前: 函数     │ │  │   └── 控制流 ✓       ││
│ │                │ │  ├── 函数 ●             ││
│ │                │ │  │   ├── 定义 ●         ││
│ │                │ │  │   ├── 参数 ●         ││
│ │                │ │  │   └── 闭包 ○         ││
│ │                │ │  └── 面向对象 ○         ││
│ └────────────────┘ └─────────────────────────┘│
└────────────────────────────────────────────────┘
```

---

### 14.7 资源中心（/resources）

#### 布局

```
┌─ 搜索栏 ───────────────────────────────────────┐
│ [  搜索学习资源...              ] ⌘K           │
└────────────────────────────────────────────────┘

┌─ 筛选标签 ─────────────────────────────────────┐
│ [全部] [讲义] [视频] [练习] [PPT] [代码]        │
└────────────────────────────────────────────────┘

┌─ 资源列表（表格视图）──────────────────────────┐
│ 名称              │ 类型  │ 创建时间    │ 操作  │
│ ─────────────────────────────────────────────── │
│ 变量与数据类型     │ 讲义  │ 2026-04-15 │ [查看] │
│ 函数定义练习       │ 练习  │ 2026-04-14 │ [查看] │
│ Python 基础 PPT    │ PPT   │ 2026-04-13 │ [查看] │
└────────────────────────────────────────────────┘
```

---

### 14.8 资源推送（/feed）

#### 布局

```
┌─ AI 推荐横幅 ──────────────────────────────────┐
│ ✨ 基于你的学习画像，AI 为你精选以下资源        │
└────────────────────────────────────────────────┘

┌─ 推荐卡片网格（3列）───────────────────────────┐
│ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ [缩略图]  │ │ [缩略图]  │ │ [缩略图]  │        │
│ │ 闭包详解  │ │ 装饰器    │ │ 生成器    │        │
│ │ 讲义      │ │ 代码案例  │ │ 视频      │        │
│ │           │ │           │ │           │        │
│ │ 因为你函数 │ │ 因为你想  │ │ 因为你进  │        │
│ │ 掌握度较低 │ │ 提升实践  │ │ 阶学习    │        │
│ └──────────┘ └──────────┘ └──────────┘        │
└────────────────────────────────────────────────┘
```

---

### 14.9 学习报告（/report）

#### 布局

```
┌─ 时间筛选 ─────────────────────────────────────┐
│ [本周] [本月] [自定义]                          │
└────────────────────────────────────────────────┘

┌─ 统计卡片（4列）───────────────────────────────┐
│ 总时长 12.5h │ 完成率 78% │ 正确率 85% │ 12天 │
└────────────────────────────────────────────────┘

┌─ Content Grid ─────────────────────────────────┐
│ ┌─ 图表区 ───────────┐ ┌─ 薄弱点 ────────────┐│
│ │ [柱状图: 每日时长]  │ │ ⚠ 函数 — 掌握度 45% ││
│ │                     │ │ ⚠ 面向对象 — 30%    ││
│ │ [环形图: 时间分配]  │ │                     ││
│ │                     │ │ 下一步建议:         ││
│ │                     │ │ 建议先复习函数基础   ││
│ └─────────────────────┘ └─────────────────────┘│
└────────────────────────────────────────────────┘

┌─ AI 分析总结 ──────────────────────────────────┐
│ [AI 卡片] 本周你在基础语法上进步明显，但函数    │
│ 章节的练习正确率较低，建议重点复习闭包和装饰器。│
│                                      [语音播报] │
└────────────────────────────────────────────────┘
```

---

### 14.10 视频播放（/video）

#### 布局

```
┌─ 视频播放器（16:9）────────────────────────────┐
│ ┌────────────────────────────────────────────┐ │
│ │                                            │ │
│ │            [视频画面]                       │ │
│ │                                            │ │
│ │  [◄◄] [►/❚❚] [►►] ────●─────── [🔊] [⛶]  │ │
│ └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘

┌─ 视频信息 ─────────────────────────────────────┐
│ Python 函数详解                                 │
│ 时长: 12:35 · 生成日期: 2026-04-15             │
└────────────────────────────────────────────────┘
```

使用原生 `<video>` 标签，后端返回 .mp4 URL。

---

### 14.11 个人信息（/profile）

#### 布局

```
┌─ Content Grid (1fr + 1fr) ─────────────────────┐
│ ┌─ 基本信息 ─────────┐ ┌─ 学习概况 ───────────┐│
│ │ [头像]              │ │ 总学习时长: 12.5h    ││
│ │ 姓名: [____]       │ │ 完成任务: 24 个      ││
│ │ 专业: [____]       │ │ 练习正确率: 85%      ││
│ │ 年级: [____]       │ │                      ││
│ │                    │ │ 安全设置              ││
│ │ [保存修改]         │ │ [修改密码]            ││
│ └────────────────────┘ └──────────────────────┘│
└────────────────────────────────────────────────┘
```

---

### 14.12 登录/注册（/auth）

#### 布局

```
┌──────────────┬───────────────────────────────┐
│              │                               │
│  品牌区       │  [登录] [注册] ← Tab 切换    │
│  (深色背景)   │                               │
│              │  邮箱: [________________]     │
│  学而思       │  密码: [________________]     │
│  SparkLearn  │                               │
│              │  [        登录        ]       │
│  AI 驱动的    │                               │
│  个性化学习   │  ─── 或 ───                  │
│              │  [  微信登录  ]               │
│              │                               │
└──────────────┴───────────────────────────────┘
```

- 左右分割布局
- 左侧深色品牌区（40%宽度）
- 右侧表单区（60%宽度）
- 登录/注册通过 Tab 切换，共用布局

---

## 附录 A: 依赖清单

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "next": "^14",
    "lucide-react": "latest",
    "react-markdown": "^9",
    "remark-gfm": "^4",
    "prismjs": "^1.29",
    "@types/prismjs": "^1.26"
  },
  "devDependencies": {
    "typescript": "^5",
    "tailwindcss": "^3.4",
    "postcss": "^8",
    "autoprefixer": "^10",
    "@types/react": "^18",
    "@types/node": "^20"
  }
}
```

## 附录 B: 环境变量

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_USE_MOCK=true
```

## 附录 C: 决策记录

| 编号 | 决策 | 原因 |
|------|------|------|
| DR-001 | 不用全局状态库 | 页面独立性强，useState + useReducer 足够 |
| DR-002 | 错误不用红色 | SVG 插画更友好，符合 Apple Pure 温暖克制理念 |
| DR-003 | 骨架屏替代 Spinner | 保持内容连续性，减少感知等待时间 |
| DR-004 | 资源生成不锁定 | 用户可切换查看其他资源，提升体验 |
| DR-005 | Onboarding 不可跳过 | 画像是 AI 推荐的基础，缺失则系统无法工作 |
| DR-006 | Mock/Real 统一类型 | types.ts 作为唯一类型源，确保切换无摩擦 |
| DR-007 | Route Group 分 shell/standalone | 带侧栏和不带侧栏的页面需要不同布局 |
| DR-008 | Tailwind 保留 CSS 变量语义 | 通过 extend.colors 映射设计 Token，兼顾开发效率和可读性 |

---

*本文档是前端开发的唯一执行依据。最后更新：2026-04-16*
