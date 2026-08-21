import { expect, test, type Page } from '@playwright/test'

const USER_ID = 'profile-reset-test'
const COLLECTED_KEY = `sparklearn_profile_collected_at:${USER_ID}`
const RECAPTURE_KEY = 'sparklearn_profile_needs_recapture'

const profile = {
  user_id: USER_ID,
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

type Failure = 'not_found' | 'unauthorized' | 'server' | 'network'
type SubmitOutcome = 'success' | 'success_false' | 'http_error' | 'network'

type MockOptions = {
  currentProfile?: typeof profile
  profileFailure?: Failure
  resetFailure?: Exclude<Failure, 'not_found'>
  resetDelayMs?: number
  resetSemanticFalse?: boolean
  submitOutcomes?: SubmitOutcome[]
}

const unknownRequestsByPage = new WeakMap<Page, string[]>()

async function mockProfileFlowApis(page: Page, options: MockOptions = {}) {
  let resetRequestCount = 0
  let submitRequestCount = 0
  const submitOutcomes = [...(options.submitOutcomes || ['success'])]
  const unknownRequests: string[] = []
  unknownRequestsByPage.set(page, unknownRequests)

  await page.route('**/api/**', async route => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (pathname === '/api/profile/onboarding' && request.method() === 'POST') {
      submitRequestCount += 1
      const outcome = submitOutcomes.shift() || 'success'
      if (outcome === 'network') {
        await route.abort('failed')
        return
      }
      if (outcome === 'http_error') {
        await route.fulfill({ status: 500, json: { success: false, error: '画像生成服务不可用' } })
        return
      }
      if (outcome === 'success_false') {
        await route.fulfill({ status: 200, json: { success: false, error: '画像分析未完成' } })
        return
      }
      await route.fulfill({
        json: { success: true, data: { user_id: USER_ID, name: '林同学' } },
      })
      return
    }

    if (pathname === '/api/profile' && request.method() === 'DELETE') {
      resetRequestCount += 1
      if (options.resetDelayMs) {
        await new Promise(resolve => setTimeout(resolve, options.resetDelayMs))
      }
      if (options.resetFailure === 'network') {
        await route.abort('failed')
        return
      }
      if (options.resetFailure === 'unauthorized') {
        await route.fulfill({ status: 401, json: { success: false, error: 'unauthorized' } })
        return
      }
      if (options.resetFailure === 'server') {
        await route.fulfill({ status: 500, json: { success: false, error: 'reset unavailable' } })
        return
      }
      await route.fulfill({
        json: {
          success: true,
          data: { reset: !options.resetSemanticFalse, redirect: '/onboarding', reset_at: '2026-08-20T10:00:00Z' },
        },
      })
      return
    }

    if (pathname === '/api/profile' && request.method() === 'GET') {
      if (options.profileFailure === 'network') {
        await route.abort('failed')
        return
      }
      if (options.profileFailure === 'not_found') {
        await route.fulfill({ status: 404, json: { success: false, error: 'profile not found' } })
        return
      }
      if (options.profileFailure === 'unauthorized') {
        await route.fulfill({ status: 401, json: { success: false, error: 'unauthorized' } })
        return
      }
      if (options.profileFailure === 'server') {
        await route.fulfill({ status: 500, json: { success: false, error: 'profile unavailable' } })
        return
      }
      await route.fulfill({ json: { success: true, data: options.currentProfile || profile } })
      return
    }

    if (pathname === '/api/classes/my' || pathname === '/api/classes/broadcasts') {
      await route.fulfill({ json: { success: true, data: [] } })
      return
    }

    if (pathname === '/api/teacher/subjects') {
      await route.fulfill({ json: { success: true, data: [] } })
      return
    }

    if (
      pathname === '/api/tasks/today'
      || pathname === '/api/resources'
      || pathname === '/api/resources/recommendations/list'
      || pathname === '/api/mastery'
    ) {
      await route.fulfill({ json: { success: true, data: [] } })
      return
    }

    if (pathname === '/api/dashboard/stats') {
      await route.fulfill({
        json: {
          success: true,
          data: { total_hours: 0, task_completion_rate: 0, quiz_accuracy: 0, streak_days: 0 },
        },
      })
      return
    }

    unknownRequests.push(`${request.method()} ${pathname}`)
    await route.fulfill({ status: 500, json: { success: false, error: `unmocked api: ${pathname}` } })
  })

  return {
    getResetRequestCount: () => resetRequestCount,
    getSubmitRequestCount: () => submitRequestCount,
  }
}

async function seedCompletionMarkers(page: Page) {
  await page.evaluate(({ collectedKey, recaptureKey }) => {
    localStorage.setItem(collectedKey, 'existing-marker')
    localStorage.setItem(recaptureKey, 'true')
  }, { collectedKey: COLLECTED_KEY, recaptureKey: RECAPTURE_KEY })
}

async function readCompletionMarkers(page: Page) {
  return page.evaluate(({ collectedKey, recaptureKey }) => ({
    collected: localStorage.getItem(collectedKey),
    recapture: localStorage.getItem(recaptureKey),
  }), { collectedKey: COLLECTED_KEY, recaptureKey: RECAPTURE_KEY })
}

async function speedUpOnboardingTimers(page: Page) {
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = ((handler: TimerHandler, timeout?: number) => (
      nativeSetTimeout(handler, Math.min(timeout || 0, 25))
    )) as typeof window.setTimeout
  })
}

async function completeOnboarding(page: Page) {
  const firstInput = page.getByPlaceholder('输入你的名字，例如：林同学')
  await expect(firstInput).toBeVisible()
  await firstInput.fill('林同学')
  await firstInput.press('Enter')

  const input = page.getByPlaceholder('你可以直接输入你的想法...')
  for (const value of ['大二', '计算机科学', '完成项目', '基础语法', '异步编程', '项目实践', '每天 45 分钟']) {
    await expect(input).toBeVisible()
    await input.fill(value)
    await input.press('Enter')
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ userId }) => {
    localStorage.setItem('sparklearn_token', 'profile-reset-token')
    localStorage.setItem('sparklearn_user', JSON.stringify({ user_id: userId, name: '林同学' }))
    localStorage.setItem(`sparklearn_new_user_guide_seen:${userId}`, 'true')
  }, { userId: USER_ID })
})

test.afterEach(async ({ page }) => {
  expect(unknownRequestsByPage.get(page) || []).toEqual([])
})

test('设置页重置需要卡片内二次确认，成功后清理标记并替换到建档页', async ({ page }) => {
  const requests = await mockProfileFlowApis(page)
  await page.goto('/profile/settings')
  await seedCompletionMarkers(page)

  await page.getByRole('button', { name: '重置学习画像' }).click()
  expect(requests.getResetRequestCount()).toBe(0)
  await expect(page.getByText('重置后，现有画像与分析记录将被清除。', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '确认重置并重新建档' }).click()
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect.poll(() => requests.getResetRequestCount()).toBe(1)
  await expect.poll(() => readCompletionMarkers(page)).toEqual({ collected: null, recapture: null })
})

test('设置页重置失败保留本地标记、显示警报且防止重复请求', async ({ page }) => {
  const requests = await mockProfileFlowApis(page, { resetFailure: 'server', resetDelayMs: 150 })
  await page.goto('/profile/settings')
  await seedCompletionMarkers(page)

  await page.getByRole('button', { name: '重置学习画像' }).click()
  const confirm = page.getByRole('button', { name: '确认重置并重新建档' })
  await confirm.dblclick()

  await expect(page.getByRole('alert').filter({ hasText: '重置失败' })).toBeVisible()
  await expect(page).toHaveURL(/\/profile\/settings$/)
  expect(requests.getResetRequestCount()).toBe(1)
  expect(await readCompletionMarkers(page)).toEqual({ collected: 'existing-marker', recapture: 'true' })
})

test('设置页收到 reset false 时按失败处理并保留本地状态', async ({ page }) => {
  const requests = await mockProfileFlowApis(page, { resetSemanticFalse: true })
  await page.goto('/profile/settings')
  await seedCompletionMarkers(page)

  await page.getByRole('button', { name: '重置学习画像' }).click()
  await page.getByRole('button', { name: '确认重置并重新建档' }).click()

  await expect(page.getByRole('alert').filter({ hasText: '重置失败' })).toBeVisible()
  await expect(page).toHaveURL(/\/profile\/settings$/)
  expect(requests.getResetRequestCount()).toBe(1)
  expect(await readCompletionMarkers(page)).toEqual({ collected: 'existing-marker', recapture: 'true' })
})

test('已有画像重新采集必须先重置成功，不能只在本地绕过', async ({ page }) => {
  const requests = await mockProfileFlowApis(page)
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', { name: /画像已经建立/ })).toBeVisible()
  await seedCompletionMarkers(page)

  await page.getByRole('button', { name: '重新采集' }).click()
  expect(requests.getResetRequestCount()).toBe(0)
  await expect(page.getByText('确认清除现有画像后重新采集吗？', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '确认重置并重新采集' }).click()
  await expect.poll(() => requests.getResetRequestCount()).toBe(1)
  await expect(page.getByPlaceholder('输入你的名字，例如：林同学')).toBeVisible()
  expect(await readCompletionMarkers(page)).toEqual({ collected: null, recapture: null })
})

test('画像接口成功返回不完整画像时仍进入首次采集，不显示已完成画像', async ({ page }) => {
  const requests = await mockProfileFlowApis(page, {
    currentProfile: {
      ...profile,
      grade: '',
      major: '',
      goal: [],
      knowledge_level: '',
      weak_points: [],
      learning_preference: [],
      cognitive_style: '',
      daily_time: 0,
      practical_ability: '',
      current_stage: '',
    },
  })
  await page.goto('/onboarding')

  await expect(page.getByPlaceholder('输入你的名字，例如：林同学')).toBeVisible()
  await expect(page.getByRole('heading', { name: /画像已经建立/ })).toHaveCount(0)
  expect(requests.getResetRequestCount()).toBe(0)
})

test('已有画像重置失败时保留画像卡片和完成标记', async ({ page }) => {
  const requests = await mockProfileFlowApis(page, { resetFailure: 'network' })
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', { name: /画像已经建立/ })).toBeVisible()
  await seedCompletionMarkers(page)

  await page.getByRole('button', { name: '重新采集' }).click()
  await page.getByRole('button', { name: '确认重置并重新采集' }).click()

  await expect(page.getByRole('alert').filter({ hasText: '重置失败' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /画像已经建立/ })).toBeVisible()
  expect(requests.getResetRequestCount()).toBe(1)
  expect(await readCompletionMarkers(page)).toEqual({ collected: 'existing-marker', recapture: 'true' })
})

test('已有画像收到 reset false 时保留旧画像且不进入采集', async ({ page }) => {
  const requests = await mockProfileFlowApis(page, { resetSemanticFalse: true })
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', { name: /画像已经建立/ })).toBeVisible()
  await seedCompletionMarkers(page)

  await page.getByRole('button', { name: '重新采集' }).click()
  await page.getByRole('button', { name: '确认重置并重新采集' }).click()

  await expect(page.getByRole('alert').filter({ hasText: '重置失败' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /画像已经建立/ })).toBeVisible()
  await expect(page.getByPlaceholder('输入你的名字，例如：林同学')).toHaveCount(0)
  expect(requests.getResetRequestCount()).toBe(1)
  expect(await readCompletionMarkers(page)).toEqual({ collected: 'existing-marker', recapture: 'true' })
})

for (const failure of ['unauthorized', 'server', 'network'] as const) {
  test(`画像检查${failure}失败时显示可重试错误，不误入采集`, async ({ page }) => {
    await mockProfileFlowApis(page, { profileFailure: failure })
    await page.goto('/onboarding')

    await expect(page.getByRole('heading', { name: '无法确认学习画像状态' })).toBeVisible()
    await expect(page.getByRole('button', { name: '重新检查' })).toBeVisible()
    await expect(page.getByPlaceholder('输入你的名字，例如：林同学')).toHaveCount(0)
  })
}

test('只有画像接口明确返回 404 才进入采集流程', async ({ page }) => {
  await mockProfileFlowApis(page, { profileFailure: 'not_found' })
  await page.goto('/onboarding')

  await expect(page.getByPlaceholder('输入你的名字，例如：林同学')).toBeVisible()
  await expect(page.getByRole('heading', { name: '无法确认学习画像状态' })).toHaveCount(0)
})

for (const outcome of ['success_false', 'http_error', 'network'] as const) {
  test(`建档提交${outcome}失败时不跳转、不写完成标记并可重试`, async ({ page }) => {
    await speedUpOnboardingTimers(page)
    const requests = await mockProfileFlowApis(page, {
      profileFailure: 'not_found',
      submitOutcomes: [outcome, 'success'],
    })
    await page.goto('/onboarding')
    await seedCompletionMarkers(page)

    await completeOnboarding(page)

    await expect(page.getByRole('alert').filter({ hasText: '建档失败' })).toBeVisible()
    await expect(page).toHaveURL(/\/onboarding$/)
    expect(requests.getSubmitRequestCount()).toBe(1)
    expect(await readCompletionMarkers(page)).toEqual({ collected: 'existing-marker', recapture: 'true' })
    await expect(page.getByText('每天 45 分钟', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: '重试提交' }).click()
    await expect.poll(() => requests.getSubmitRequestCount()).toBe(2)
    await expect(page).toHaveURL(/\/$/)
    await expect.poll(async () => (await readCompletionMarkers(page)).recapture).toBeNull()
    await expect.poll(async () => (await readCompletionMarkers(page)).collected).not.toBe('existing-marker')
  })
}

test('建档提交失败后锁定普通输入和完成确认，只允许重试提交', async ({ page }) => {
  await speedUpOnboardingTimers(page)
  const requests = await mockProfileFlowApis(page, {
    profileFailure: 'not_found',
    submitOutcomes: ['success_false', 'success'],
  })
  await page.goto('/onboarding')
  await completeOnboarding(page)

  await expect(page.getByRole('alert').filter({ hasText: '建档失败' })).toBeVisible()
  const ordinaryInput = page.getByPlaceholder('你可以直接输入你的想法...')
  const completeButton = page.getByRole('button', { name: '完成建档' })
  const backButton = page.getByRole('button', { name: '上一步' })
  await expect(ordinaryInput).toBeDisabled()
  await expect(completeButton).toBeDisabled()
  await expect(backButton).toBeDisabled()
  await expect(page.getByRole('button', { name: '重试提交' })).toBeEnabled()

  const messageLog = page.getByRole('log', { name: '对话建档消息' })
  const messageNodesBefore = await messageLog.locator(':scope > div').count()
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('input[placeholder="你可以直接输入你的想法..."]')
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    const complete = Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent?.includes('完成建档'))
    const back = Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent?.includes('上一步'))
    back?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    complete?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(100)

  expect(requests.getSubmitRequestCount()).toBe(1)
  expect(await messageLog.locator(':scope > div').count()).toBe(messageNodesBefore)
  await expect(page.getByText('视频教程，直观看懂', { exact: true })).toHaveCount(0)
})

test('重置与建档页面在当前视口不产生横向溢出', async ({ page }) => {
  await mockProfileFlowApis(page)
  await page.goto('/profile/settings')
  await expect(page.getByRole('button', { name: '重置学习画像' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('对话建档采集流程在当前视口不产生页面级横向溢出', async ({ page }) => {
  await mockProfileFlowApis(page, { profileFailure: 'not_found' })
  await page.goto('/onboarding')
  await expect(page.getByPlaceholder('输入你的名字，例如：林同学')).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
