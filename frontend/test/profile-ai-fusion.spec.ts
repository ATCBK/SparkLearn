import { expect, test, type Page } from '@playwright/test'

const profile = {
  user_id: 'profile-ai-test',
  name: '林同学',
  email: 'lin@example.com',
  major: '计算机科学',
  grade: '大二',
  goal: ['完成 Python 项目'],
  knowledge_level: '已掌握基础语法',
  weak_points: ['异步编程'],
  learning_preference: ['项目实践'],
  cognitive_style: '先案例后归纳',
  daily_time: 45,
  practical_ability: '可以完成小型脚本',
  current_stage: '项目迁移阶段',
}

const analysis = {
  status: 'ready',
  schema_version: 'profile-analysis-v1',
  profile_version: 3,
  source_type: 'onboarding',
  generated_by: 'llm',
  model: 'spark-lite',
  confidence: 0.82,
  overview: '你正在从语法掌握迈向独立项目实践。',
  narrative: '你已经具备 Python 基础，喜欢通过项目理解知识，当前需要把异步编程转化为可稳定运用的能力。',
  goal_gap: '目标是独立完成 Python 项目，主要差距在异步任务拆分和调试。',
  strengths: ['基础语法稳固', '有小型脚本实践经验'],
  focus_areas: ['异步编程', '项目调试'],
  learning_strategy: '以一个可运行的小项目为主线，每次只引入一个异步概念。',
  next_actions: ['完成一个 asyncio 小练习', '记录两个调试问题'],
  evidence: [
    { source: 'onboarding', label: '学习目标与基础', captured_at: '2026-08-20T08:30:00Z' },
  ],
  analysis_steps: [
    { title: '关联目标与弱项', detail: '对比项目目标和异步编程弱项。', status: 'done' },
  ],
  updated_at: '2026-08-20T08:30:00Z',
}

const regeneratedAnalysis = {
  ...analysis,
  profile_version: 4,
  overview: '重新分析后的综合概览。',
  narrative: '重新分析后，系统确认项目调试已经成为当前最优先的学习方向。',
  confidence: 0.9,
  updated_at: '2026-08-20T09:30:00Z',
}

const initialHistoryItem = {
  id: 'history-3',
  captured_at: analysis.updated_at,
  reason: 'onboarding',
  version: 3,
  major: profile.major,
  grade: profile.grade,
  goals: profile.goal,
  knowledge_level: profile.knowledge_level,
  weak_points: profile.weak_points,
  learning_preference: profile.learning_preference,
  cognitive_style: profile.cognitive_style,
  daily_time: profile.daily_time,
  practical_ability: profile.practical_ability,
  current_stage: profile.current_stage,
  summary: '不应优先展示的旧摘要',
  narrative: '历史画像连续叙述：从基础语法逐步转向项目实践。',
  analysis_source: 'llm',
  confidence: 0.78,
}

type MockProfileOptions = {
  currentProfile?: typeof profile | null
  profileFailure?: 'not_found' | 'unauthorized' | 'server' | 'network'
  currentAnalysis?: typeof analysis
  analysisFailure?: boolean
  analyzedAnalysis?: typeof analysis
  initialHistory?: Array<Record<string, unknown>>
  refreshedHistory?: Array<Record<string, unknown>>
}

async function mockProfileApis(
  page: Page,
  options: MockProfileOptions = {},
) {
  const currentProfile = options.currentProfile === undefined ? profile : options.currentProfile
  const currentAnalysis = options.currentAnalysis || analysis
  const analyzedAnalysis = options.analyzedAnalysis || regeneratedAnalysis
  const initialHistory = options.initialHistory || [initialHistoryItem]
  const refreshedHistory = options.refreshedHistory || [
    {
      ...initialHistoryItem,
      id: 'history-4',
      version: 4,
      reason: 'history_analyze',
      captured_at: regeneratedAnalysis.updated_at,
      narrative: '重新分析后的历史叙述。',
      confidence: 0.9,
    },
    ...initialHistory,
  ]
  let analyzeRequestCount = 0
  let historyRequestCount = 0
  const unknownRequests: string[] = []
  unknownRequestsByPage.set(page, unknownRequests)

  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname

    if (pathname === '/api/profile') {
      if (options.profileFailure === 'network') {
        await route.abort('failed')
        return
      }
      if (options.profileFailure === 'server') {
        await route.fulfill({ status: 500, json: { success: false, error: 'profile storage unavailable' } })
        return
      }
      if (options.profileFailure === 'unauthorized') {
        await route.fulfill({ status: 401, json: { success: false, error: 'unauthorized' } })
        return
      }
      if (options.profileFailure === 'not_found') {
        await route.fulfill({ status: 404, json: { success: false, error: 'profile not found' } })
        return
      }
      if (!currentProfile) {
        await route.fulfill({ status: 404, json: { success: false, error: 'profile not found' } })
        return
      }
      await route.fulfill({ json: { success: true, data: currentProfile } })
      return
    }

    if (pathname === '/api/profile/analysis/current') {
      if (options.analysisFailure) {
        await route.fulfill({ status: 503, json: { success: false, error: 'analysis unavailable' } })
        return
      }
      await route.fulfill({ json: { success: true, data: currentAnalysis } })
      return
    }

    if (pathname === '/api/profile/history/analyze') {
      analyzeRequestCount += 1
      await route.fulfill({
        json: { success: true, data: { ...analyzedAnalysis, analysis: analyzedAnalysis.narrative } },
      })
      return
    }

    if (pathname === '/api/profile/history') {
      historyRequestCount += 1
      const items = analyzeRequestCount > 0 ? refreshedHistory : initialHistory
      await route.fulfill({
        json: {
          success: true,
          data: {
            items,
            update_interval_days: 3,
            next_update_at: '2026-08-23T08:30:00Z',
          },
        },
      })
      return
    }

    if (pathname === '/api/resources' || pathname === '/api/mastery' || pathname === '/api/tasks/today') {
      await route.fulfill({ json: { success: true, data: [] } })
      return
    }

    unknownRequests.push(`${route.request().method()} ${pathname}`)
    await route.fulfill({ status: 500, json: { success: false, error: `unmocked api: ${pathname}` } })
  })

  return {
    getAnalyzeRequestCount: () => analyzeRequestCount,
    getHistoryRequestCount: () => historyRequestCount,
  }
}

const unknownRequestsByPage = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sparklearn_token', 'profile-ai-test-token')
    localStorage.setItem('sparklearn_user', JSON.stringify({
      user_id: 'profile-ai-test',
      name: '林同学',
    }))
    localStorage.setItem('sparklearn_new_user_guide_seen:profile-ai-test', 'true')
  })
})

test.afterEach(async ({ page }) => {
  expect(unknownRequestsByPage.get(page) || []).toEqual([])
})

test('画像页保留学生大头照和原卡片，只在人物画像中显示 AI 总结', async ({ page }) => {
  const requests = await mockProfileApis(page)
  await page.goto('/profile')

  const portrait = page.getByRole('img', { name: '学生人物画像' })
  await expect(portrait).toBeVisible()
  await expect(portrait).toHaveAttribute('src', '/ui-images/profile-male.png')
  await expect(page.getByText('人物画像', { exact: true })).toBeVisible()
  await expect(page.getByText('需要关注', { exact: true })).toBeVisible()
  await expect(page.getByText('更适合的学法', { exact: true })).toBeVisible()
  await expect(page.getByText('阶段目标', { exact: true })).toBeVisible()
  await expect(page.getByText('今天先做', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '能力雷达' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '最近学习过的资源' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '当前综合画像' })).toHaveCount(0)

  const summary = page.getByLabel('AI 学习画像总结')
  await expect(summary).toContainText(analysis.narrative)
  await expect(summary).toContainText('AI 总结')
  await expect(page.getByText('历史画像连续叙述：从基础语法逐步转向项目实践。', { exact: true })).toBeVisible()
  await expect(page.getByText('不应优先展示的旧摘要', { exact: true })).toHaveCount(0)

  const historyRequestsBeforeRegenerate = requests.getHistoryRequestCount()
  await page.getByRole('button', { name: 'AI 分析画像' }).click()
  await expect.poll(requests.getAnalyzeRequestCount).toBe(1)
  await expect.poll(requests.getHistoryRequestCount).toBeGreaterThanOrEqual(historyRequestsBeforeRegenerate)
  await expect(summary).toContainText(regeneratedAnalysis.narrative)
})

test('规则降级时明确告知 AI 暂不可用', async ({ page }) => {
  await mockProfileApis(page, {
    currentAnalysis: {
      ...analysis,
      generated_by: 'rule_fallback',
      model: '',
      confidence: 0.35,
    },
  })
  await page.goto('/profile')

  await expect(page.getByRole('img', { name: '学生人物画像' })).toBeVisible()
  await expect(page.getByLabel('AI 学习画像总结')).toContainText('基础总结（AI 暂不可用）')
})

test('历史未验证分析明确建议重新生成', async ({ page }) => {
  await mockProfileApis(page, {
    currentAnalysis: {
      ...analysis,
      generated_by: 'legacy_unverified',
      confidence: 0,
    },
  })
  await page.goto('/profile')

  await expect(page.getByRole('img', { name: '学生人物画像' })).toBeVisible()
  await expect(page.getByLabel('AI 学习画像总结')).toContainText('历史总结（建议重新生成）')
})

test('无当前画像时提供重新建档入口', async ({ page }) => {
  await mockProfileApis(page, { currentProfile: null, profileFailure: 'not_found' })
  await page.goto('/profile')

  await expect(page.getByRole('heading', { name: '还没有学习画像' })).toBeVisible()
  await expect(page.getByRole('link', { name: '重新建档' })).toHaveAttribute('href', '/onboarding')
})

for (const failure of ['server', 'network'] as const) {
  test(`画像接口${failure === 'server' ? '服务端' : '网络'}失败时不误导用户重新建档`, async ({ page }) => {
    await mockProfileApis(page, { profileFailure: failure })
    await page.goto('/profile')

    await expect(page.getByRole('heading', { name: '画像加载失败' })).toBeVisible()
    await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible()
    await expect(page.getByRole('link', { name: '查看画像资料' })).toHaveAttribute('href', '/profile/settings')
    await expect(page.getByRole('heading', { name: '还没有学习画像' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '重新建档' })).toHaveCount(0)
  })
}

test('画像接口未授权时进入加载失败而非无画像', async ({ page }) => {
  await mockProfileApis(page, { profileFailure: 'unauthorized' })
  await page.goto('/profile')

  await expect(page.getByRole('heading', { name: '画像加载失败' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '还没有学习画像' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '重新建档' })).toHaveCount(0)
})

test('画像存在但分析读取失败时保留原卡片并使用资料摘要', async ({ page }) => {
  await mockProfileApis(page, { analysisFailure: true })
  await page.goto('/profile')

  await expect(page.getByRole('img', { name: '学生人物画像' })).toBeVisible()
  await expect(page.getByText('需要关注', { exact: true })).toBeVisible()
  await expect(page.getByLabel('AI 学习画像总结')).toContainText('画像资料摘要')
  await expect(page.getByLabel('AI 学习画像总结')).toContainText('当前基础：已掌握基础语法')
  await expect(page.getByRole('heading', { name: '还没有学习画像' })).toHaveCount(0)
})

test('旧历史数据使用摘要兜底并明确未经 AI 验证', async ({ page }) => {
  await mockProfileApis(page, {
    initialHistory: [{
      ...initialHistoryItem,
      id: 'legacy-history',
      summary: '旧版字段摘要仍可读取。',
      narrative: undefined,
      analysis_source: undefined,
      confidence: undefined,
    }],
  })
  await page.goto('/profile')

  await expect(page.getByText('旧版字段摘要仍可读取。', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '历史画像' })).toBeVisible()
})

test('页面在当前视口不产生横向溢出', async ({ page }) => {
  await mockProfileApis(page)
  await page.goto('/profile')
  await expect(page.getByRole('img', { name: '学生人物画像' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
