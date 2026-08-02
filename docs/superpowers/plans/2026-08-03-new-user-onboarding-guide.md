# New User Onboarding Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 SparkLearn 学习工作台实现首次登录/首次注册用户的一次性任务式新手引导，展示完整学习闭环并把用户带到真实页面。

**Architecture:** 使用一个独立的 `NewUserGuidePanel` 客户端组件承载全部引导 UI 和本地进度逻辑，首页只负责引入组件和提供重看入口。用 localStorage 记录每个用户的 `seen` 与进度，不新增后端接口，不改动现有画像采集流程。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Tailwind CSS、lucide-react、Playwright。

## Global Constraints

- 所有交互、文案、代码注释和提交信息使用简体中文。
- 新增文本文件使用 UTF-8 编码。
- 新手判定采用首次登录或首次注册，本期由前端 localStorage 判定。
- 完成或明确跳过后不再自动展示，稍后再看只临时收起。
- 不改后端接口，不改变已有 `/onboarding` 画像采集流程，不改 `/tutor` 业务逻辑。
- 桌面端和移动端都不能出现文字溢出、按钮遮挡或底部导航遮挡。

---

## File Structure

- Create: `frontend/src/components/onboarding/newUserGuideStorage.ts`
  - 负责生成用户级 localStorage key、读取/写入已看标记、读取/写入任务进度。
- Create: `frontend/src/components/onboarding/NewUserGuidePanel.tsx`
  - 负责渲染任务式引导面板、处理“稍后再看 / 跳过引导 / 全部标记已了解 / 任务跳转 / 重看”。
- Modify: `frontend/src/app/(shell)/page.tsx`
  - 在首页 hero 下方接入引导面板，新增“新手引导”重看按钮。
- Modify: `frontend/test/pages.spec.ts` 或 Create: `frontend/test/new-user-guide.spec.ts`
  - 覆盖首次展示、跳过后不自动展示、重看入口可用。

---

### Task 1: 新手引导本地状态工具

**Files:**
- Create: `frontend/src/components/onboarding/newUserGuideStorage.ts`

**Interfaces:**
- Consumes: 浏览器 `window.localStorage`。
- Produces:
  - `NEW_USER_GUIDE_STEP_IDS: string[]`
  - `getGuideUserId(): string`
  - `hasSeenNewUserGuide(userId?: string): boolean`
  - `markNewUserGuideSeen(userId?: string): void`
  - `readNewUserGuideProgress(userId?: string): string[]`
  - `writeNewUserGuideProgress(stepIds: string[], userId?: string): void`
  - `clearNewUserGuideSession(userId?: string): void`

- [ ] **Step 1: 创建状态工具文件**

```ts
const GUIDE_SEEN_PREFIX = 'sparklearn_new_user_guide_seen:'
const GUIDE_PROGRESS_PREFIX = 'sparklearn_new_user_guide_progress:'

export const NEW_USER_GUIDE_STEP_IDS = [
  'profile',
  'path',
  'resource',
  'tutor',
  'practice',
  'report',
  'profile-update',
]

function safeLocalStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getGuideUserId() {
  const storage = safeLocalStorage()
  if (!storage) return 'anonymous'
  try {
    const raw = storage.getItem('sparklearn_user')
    if (!raw) return 'anonymous'
    const user = JSON.parse(raw) as { user_id?: string; id?: string; email?: string; name?: string }
    return String(user.user_id || user.id || user.email || user.name || 'anonymous')
  } catch {
    return 'anonymous'
  }
}

function seenKey(userId = getGuideUserId()) {
  return `${GUIDE_SEEN_PREFIX}${userId || 'anonymous'}`
}

function progressKey(userId = getGuideUserId()) {
  return `${GUIDE_PROGRESS_PREFIX}${userId || 'anonymous'}`
}

export function hasSeenNewUserGuide(userId = getGuideUserId()) {
  const storage = safeLocalStorage()
  return storage?.getItem(seenKey(userId)) === 'true'
}

export function markNewUserGuideSeen(userId = getGuideUserId()) {
  safeLocalStorage()?.setItem(seenKey(userId), 'true')
}

export function readNewUserGuideProgress(userId = getGuideUserId()) {
  const storage = safeLocalStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(progressKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && NEW_USER_GUIDE_STEP_IDS.includes(id))
  } catch {
    return []
  }
}

export function writeNewUserGuideProgress(stepIds: string[], userId = getGuideUserId()) {
  const unique = Array.from(new Set(stepIds)).filter((id) => NEW_USER_GUIDE_STEP_IDS.includes(id))
  safeLocalStorage()?.setItem(progressKey(userId), JSON.stringify(unique))
}

export function clearNewUserGuideSession(userId = getGuideUserId()) {
  const storage = safeLocalStorage()
  storage?.removeItem(seenKey(userId))
  storage?.removeItem(progressKey(userId))
}
```

- [ ] **Step 2: 运行 TypeScript 静态检查**

Run: `cd frontend; npx tsc --noEmit`

Expected: PASS，或者只暴露仓库既有无关类型错误；如果有本文件新增错误，立即修复。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/onboarding/newUserGuideStorage.ts
git commit -m "新增新手引导本地状态工具"
```

---

### Task 2: 新手学习链路面板组件

**Files:**
- Create: `frontend/src/components/onboarding/NewUserGuidePanel.tsx`
- Modify: `frontend/src/components/onboarding/newUserGuideStorage.ts` if Task 2 discovers a missing exported helper.

**Interfaces:**
- Consumes:
  - `hasSeenNewUserGuide(userId?: string): boolean`
  - `markNewUserGuideSeen(userId?: string): void`
  - `readNewUserGuideProgress(userId?: string): string[]`
  - `writeNewUserGuideProgress(stepIds: string[], userId?: string): void`
- Produces:
  - `export type NewUserGuidePanelHandle = { open: () => void }`
  - `export const NewUserGuidePanel = forwardRef<NewUserGuidePanelHandle>(...)`

- [ ] **Step 1: 创建组件骨架和链路数据**

```tsx
'use client'

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  FileText,
  Flag,
  Map,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  getGuideUserId,
  hasSeenNewUserGuide,
  markNewUserGuideSeen,
  NEW_USER_GUIDE_STEP_IDS,
  readNewUserGuideProgress,
  writeNewUserGuideProgress,
} from './newUserGuideStorage'

export type NewUserGuidePanelHandle = {
  open: () => void
}

type GuideStep = {
  id: string
  title: string
  detail: string
  highlight: string
  action: string
  href: string
  icon: React.ReactNode
  tone: string
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'profile',
    title: '先建立学习画像',
    detail: '系统会用目标、基础、薄弱点和偏好，决定后续路径、资源和练习难度。',
    highlight: '让 AI 先认识你，而不是直接给通用答案。',
    action: '完善画像',
    href: '/onboarding',
    icon: <UserRound className="h-4 w-4" />,
    tone: 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]',
  },
  {
    id: 'path',
    title: '生成你的个性化学习路径',
    detail: '把大目标拆成阶段、知识点和可执行任务，降低新手不知道从哪开始的问题。',
    highlight: '从目标到步骤，形成可跟进的学习路线。',
    action: '查看路径',
    href: '/path',
    icon: <Map className="h-4 w-4" />,
    tone: 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]',
  },
  {
    id: 'resource',
    title: '按当前卡点生成学习资源',
    detail: '围绕路径节点生成文档、课件、视频、测验或网页资料，让资料围着你当前问题转。',
    highlight: '不是堆资料，而是按学习阶段生产材料。',
    action: '生成资源',
    href: '/generate',
    icon: <FileText className="h-4 w-4" />,
    tone: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]',
  },
  {
    id: 'tutor',
    title: '让 AI 导师带你拆问题',
    detail: '在学习主工作台里提问、上传材料、选择技能或角色，系统会结合画像和上下文回答。',
    highlight: '支持可信模式、联网搜索、多模态和 MCP 工具扩展。',
    action: '进入导师',
    href: '/tutor',
    icon: <Bot className="h-4 w-4" />,
    tone: 'bg-[#f5f3ff] text-[#7c3aed] border-[#ddd6fe]',
  },
  {
    id: 'practice',
    title: '用练习验证是不是真懂了',
    detail: '通过练习、错题和评测结果，把“看过了”变成“掌握了”。',
    highlight: '把学习结果变成可评估数据。',
    action: '开始练习',
    href: '/practice',
    icon: <BookOpen className="h-4 w-4" />,
    tone: 'bg-[#ecfeff] text-[#0e7490] border-[#a5f3fc]',
  },
  {
    id: 'report',
    title: '查看学习报告和薄弱点',
    detail: '系统汇总任务、资源、练习和画像变化，告诉你下一轮该补哪里。',
    highlight: '从结果反推下一步，而不是只记录学习时长。',
    action: '查看报告',
    href: '/report',
    icon: <BarChart3 className="h-4 w-4" />,
    tone: 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]',
  },
  {
    id: 'profile-update',
    title: '让画像随学习结果更新',
    detail: '你的练习表现、学习记录和阶段变化会反哺画像，让后续推荐越来越贴合。',
    highlight: '形成持续迭代的个性化学习系统。',
    action: '查看画像',
    href: '/profile',
    icon: <Flag className="h-4 w-4" />,
    tone: 'bg-[#f8fafc] text-[#475569] border-[#cbd5e1]',
  },
]
```

- [ ] **Step 2: 实现显示、进度和跳转逻辑**

```tsx
export const NewUserGuidePanel = forwardRef<NewUserGuidePanelHandle>(function NewUserGuidePanel(_, ref) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [userId, setUserId] = useState('anonymous')

  useEffect(() => {
    const nextUserId = getGuideUserId()
    setUserId(nextUserId)
    setCompletedIds(readNewUserGuideProgress(nextUserId))
    setVisible(!hasSeenNewUserGuide(nextUserId))
  }, [])

  useImperativeHandle(ref, () => ({
    open: () => {
      const nextUserId = getGuideUserId()
      setUserId(nextUserId)
      setCompletedIds(readNewUserGuideProgress(nextUserId))
      setVisible(true)
    },
  }))

  const completedCount = completedIds.length
  const progress = Math.round((completedCount / GUIDE_STEPS.length) * 100)

  const nextStep = useMemo(
    () => GUIDE_STEPS.find((step) => !completedIds.includes(step.id)) || GUIDE_STEPS[0],
    [completedIds],
  )

  function persistProgress(nextIds: string[]) {
    setCompletedIds(nextIds)
    writeNewUserGuideProgress(nextIds, userId)
    if (nextIds.length >= NEW_USER_GUIDE_STEP_IDS.length) {
      markNewUserGuideSeen(userId)
    }
  }

  function openStep(step: GuideStep) {
    const nextIds = Array.from(new Set([...completedIds, step.id]))
    persistProgress(nextIds)
    router.push(step.href)
  }

  function skipGuide() {
    markNewUserGuideSeen(userId)
    setVisible(false)
  }

  function completeGuide() {
    persistProgress(NEW_USER_GUIDE_STEP_IDS)
    markNewUserGuideSeen(userId)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <section
      data-testid="new-user-guide-panel"
      className="mb-5 overflow-hidden rounded-[12px] border border-[#dbeafe] bg-white shadow-md"
      aria-label="新手学习链路引导"
    >
      {/* Step 3 will fill render markup here. */}
    </section>
  )
})
```

- [ ] **Step 3: 补全组件 UI**

```tsx
return (
  <section
    data-testid="new-user-guide-panel"
    className="mb-5 overflow-hidden rounded-[12px] border border-[#dbeafe] bg-white shadow-md"
    aria-label="新手学习链路引导"
  >
    <div className="grid grid-cols-[minmax(0,.78fr)_minmax(320px,1fr)] gap-0 max-[980px]:grid-cols-1">
      <div className="border-r border-[#e5edf8] bg-[#f8fbff] p-5 max-[980px]:border-r-0 max-[980px]:border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white px-3 py-1 text-xs font-bold text-[#2563eb]">
            <Sparkles className="h-3.5 w-3.5" />
            首次学习引导
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#64748b] hover:bg-white hover:text-[#1f2937]"
            aria-label="稍后再看"
            title="稍后再看"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="mt-4 text-[22px] font-extrabold leading-8 text-[#111827]">
          从一次画像开始，跑完你的个性化学习闭环
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#52627b]">
          SparkLearn 会根据你的目标、基础和薄弱点，规划路径、生成资源、陪你互动练习，并把结果回写到学习画像里。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {['多智能体协作', '个性化路径', '资源自动生成', '练习与报告闭环'].map((tag) => (
            <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#475569] ring-1 ring-[#e2e8f0]">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#64748b]">
            <span>引导进度</span>
            <span>{completedCount}/{GUIDE_STEPS.length}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
            <div className="h-full rounded-full bg-[#2563eb] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openStep(nextStep)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 text-sm font-bold text-white hover:bg-[#1d4ed8]"
          >
            开始下一步
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={completeGuide}
            className="inline-flex h-10 items-center rounded-lg border border-[#cbd5e1] bg-white px-4 text-sm font-bold text-[#334155] hover:bg-[#f8fafc]"
          >
            全部标记已了解
          </button>
          <button
            type="button"
            onClick={skipGuide}
            className="inline-flex h-10 items-center rounded-lg px-2 text-sm font-bold text-[#64748b] hover:text-[#1f2937]"
          >
            跳过引导
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 max-[760px]:grid-cols-1">
        {GUIDE_STEPS.map((step, index) => {
          const done = completedIds.includes(step.id)
          return (
            <article
              key={step.id}
              className={cn(
                'flex min-w-0 flex-col rounded-[10px] border p-3 transition-colors',
                done ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[#e2e8f0] bg-white hover:border-[#bfdbfe]',
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg border', step.tone)}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-[#94a3b8]">第 {index + 1} 步</div>
                  <h3 className="mt-0.5 text-sm font-extrabold leading-5 text-[#111827]">{step.title}</h3>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#52627b]">{step.detail}</p>
              <p className="mt-2 rounded-lg bg-[#f8fafc] px-2.5 py-2 text-[12px] leading-5 text-[#334155]">
                {step.highlight}
              </p>
              <button
                type="button"
                onClick={() => openStep(step)}
                className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 text-sm font-bold text-[#2563eb] hover:bg-[#dbeafe]"
              >
                {step.action}
                <ChevronRight className="h-4 w-4" />
              </button>
            </article>
          )
        })}
      </div>
    </div>
  </section>
)
```

- [ ] **Step 4: 运行 lint**

Run: `cd frontend; npm run lint`

Expected: PASS，或者只出现仓库既有无关问题；组件新增代码不能有 lint 报错。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/onboarding/NewUserGuidePanel.tsx frontend/src/components/onboarding/newUserGuideStorage.ts
git commit -m "新增任务式新手引导面板"
```

---

### Task 3: 首页接入和重看入口

**Files:**
- Modify: `frontend/src/app/(shell)/page.tsx`

**Interfaces:**
- Consumes:
  - `NewUserGuidePanel`
  - `NewUserGuidePanelHandle`
- Produces: 首页 hero 下方展示自动引导，hero 操作区提供“新手引导”按钮。

- [ ] **Step 1: 添加 import 和 ref**

Add imports:

```tsx
import { useRef } from 'react'
import { NewUserGuidePanel, type NewUserGuidePanelHandle } from '@/components/onboarding/NewUserGuidePanel'
```

If the file already imports React hooks from `react`, merge `useRef` into the existing import:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
```

Inside `HomePage`:

```tsx
const guidePanelRef = useRef<NewUserGuidePanelHandle>(null)
```

- [ ] **Step 2: 在 hero 下方渲染面板**

Place immediately after the hero `ProtoCard`:

```tsx
<NewUserGuidePanel ref={guidePanelRef} />
```

- [ ] **Step 3: 增加重看入口按钮**

In the hero action button group, add:

```tsx
<button
  type="button"
  onClick={() => guidePanelRef.current?.open()}
  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[#bfdbfe] bg-white px-4 py-2 text-small font-bold text-[#2563eb] shadow-sm transition-colors hover:bg-[#eff6ff]"
>
  新手引导
</button>
```

- [ ] **Step 4: 检查移动端按钮换行**

Run dev server:

```bash
cd frontend
npm run dev
```

Open `/` at desktop width and mobile width. Confirm the hero action buttons wrap into multiple lines and the “新手引导” text is not clipped.

- [ ] **Step 5: 提交**

```bash
git add frontend/src/app/(shell)/page.tsx
git commit -m "接入首页新手引导入口"
```

---

### Task 4: Playwright 验证

**Files:**
- Create: `frontend/test/new-user-guide.spec.ts`

**Interfaces:**
- Consumes: 首页中的 `data-testid="new-user-guide-panel"` 和按钮文本。
- Produces: 自动验证首次展示、跳过持久化、重看入口。

- [ ] **Step 1: 添加测试文件**

```ts
import { expect, test } from '@playwright/test'

test.describe('新手任务式引导', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sparklearn_token', 'test-token')
      window.localStorage.setItem('sparklearn_user', JSON.stringify({ user_id: 'new_user_guide_test', name: '新手用户' }))
      window.localStorage.removeItem('sparklearn_new_user_guide_seen:new_user_guide_test')
      window.localStorage.removeItem('sparklearn_new_user_guide_progress:new_user_guide_test')
    })
  })

  test('首次进入工作台自动展示新手学习链路', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('new-user-guide-panel')).toBeVisible()
    await expect(page.getByText('从一次画像开始，跑完你的个性化学习闭环')).toBeVisible()
    await expect(page.getByText('先建立学习画像')).toBeVisible()
    await expect(page.getByText('让 AI 导师带你拆问题')).toBeVisible()
    await expect(page.getByRole('button', { name: /开始下一步/ })).toBeVisible()
  })

  test('跳过引导后刷新不再自动展示，重看入口仍可打开', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '跳过引导' }).click()
    await expect(page.getByTestId('new-user-guide-panel')).toBeHidden()
    await page.reload()
    await expect(page.getByTestId('new-user-guide-panel')).toHaveCount(0)
    await page.getByRole('button', { name: '新手引导' }).click()
    await expect(page.getByTestId('new-user-guide-panel')).toBeVisible()
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `cd frontend; npx playwright test test/new-user-guide.spec.ts`

Expected: PASS。

- [ ] **Step 3: 如测试环境被后端请求阻塞，补充路由拦截**

If the page cannot load because API calls fail slowly, add this before `page.goto('/')` in each test or inside `beforeEach`:

```ts
await page.route('**/api/**', async (route) => {
  const url = route.request().url()
  if (url.includes('/tasks')) return route.fulfill({ json: [] })
  if (url.includes('/resources')) return route.fulfill({ json: [] })
  if (url.includes('/recommendations')) return route.fulfill({ json: [] })
  return route.fulfill({ json: {} })
})
```

- [ ] **Step 4: 提交**

```bash
git add frontend/test/new-user-guide.spec.ts
git commit -m "补充新手引导前端验证"
```

---

### Task 5: 最终验证和整理

**Files:**
- Modify only files touched by previous tasks if verification finds issues.

**Interfaces:**
- Consumes: All outputs from Tasks 1-4.
- Produces: 可交付的新手引导功能和验证结果。

- [ ] **Step 1: 运行 lint**

Run: `cd frontend; npm run lint`

Expected: PASS。

- [ ] **Step 2: 运行新手引导测试**

Run: `cd frontend; npx playwright test test/new-user-guide.spec.ts`

Expected: PASS。

- [ ] **Step 3: 启动本地开发服务检查页面**

Run:

```bash
cd frontend
npm run dev
```

Expected: dev server starts and prints a local URL such as `http://localhost:3000` or another available port.

- [ ] **Step 4: 手动检查关键体验**

At `/`:

- 清空 `sparklearn_new_user_guide_seen:<userId>` 后刷新，面板自动展示。
- 点击 `稍后再看` 图标，仅临时收起；刷新后再次展示。
- 点击 `跳过引导` 后刷新，面板不自动展示。
- 点击 `新手引导` 后面板重新展示。
- 点击 `进入导师` 后跳转 `/tutor`。

- [ ] **Step 5: 检查 git 状态**

Run: `git status --short --branch`

Expected: only intentional changes remain; no unrelated generated artifacts are staged.

- [ ] **Step 6: 最终提交**

If previous task commits already cover all changes, do not create an empty commit. If verification fixes were made:

```bash
git add frontend/src/components/onboarding frontend/src/app/(shell)/page.tsx frontend/test/new-user-guide.spec.ts
git commit -m "完善新手引导验证细节"
```

---

## Self-Review

- Spec coverage: 计划覆盖首次登录判定、任务式面板、7 步闭环文案、稍后再看/跳过/已了解/重看入口、首页集成、移动端布局和 Playwright 验证。
- Placeholder scan: 本计划没有 `TBD`、`TODO` 或未定义接口；每个代码步骤提供了具体代码或命令。
- Type consistency: `NewUserGuidePanelHandle.open()`、storage helpers 和首页 ref 使用的名称一致。
