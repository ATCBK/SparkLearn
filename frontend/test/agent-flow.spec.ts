import { expect, test, type Page } from '@playwright/test'

const AGENT_USER_ID = 'agent-action-test'
const AGENT_COLLECTED_KEY = `sparklearn_profile_collected_at:${AGENT_USER_ID}`
const AGENT_RECAPTURE_KEY = 'sparklearn_profile_needs_recapture'

const pet = {
  id: 'pet-1',
  name: '小星',
  avatar: 'fox',
  personality: 'encouraging',
  level: 3,
  xp: 260,
  next_level_xp: 300,
  unlocked_abilities: ['search', 'summarize', 'compare'],
  created_at: '2026-05-30T00:00:00Z',
  updated_at: '2026-05-30T00:00:00Z',
}

type AgentAction =
  | { type: 'confirm_profile_reset' }
  | { type: 'navigate'; label: string; href: string }

async function mockAgentApis(
  page: Page,
  options: {
    chatResponse?: { answer: string; created_at: string; action?: AgentAction }
  } = {},
) {
  let pollCount = 0

  await page.route('**/api/agent/pet', async route => {
    await route.fulfill({ json: { success: true, data: pet } })
  })

  await page.route('**/api/agent/chat', async route => {
    await route.fulfill({
      json: {
        success: true,
        data: options.chatResponse || {
          answer: '先从一个 20 分钟的小练习开始。',
          created_at: '2026-08-20T10:00:00Z',
        },
      },
    })
  })

  await page.route('**/api/agent/tasks?**', async route => {
    await route.fulfill({
      json: { success: true, data: { items: [], total: 0, page: 1, page_size: 10 } },
    })
  })

  await page.route('**/api/agent/task', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { task_type: string; input_text: string }
      expect(body.input_text).toContain('Python')
      await route.fulfill({
        json: { success: true, data: { task_id: 'task-1', task_type: body.task_type, status: 'pending', created_at: new Date().toISOString() } },
      })
      return
    }
    await route.fallback()
  })

  await page.route('**/api/agent/task/task-1', async route => {
    pollCount += 1
    const completed = pollCount >= 2
    await route.fulfill({
      json: {
        success: true,
        data: {
          task_id: 'task-1',
          task_type: 'search',
          input_text: 'Python 装饰器学习资料',
          status: completed ? 'completed' : 'running',
          result: completed
            ? {
                items: [
                  {
                    title: 'Python 装饰器入门',
                    summary: '从函数闭包过渡到装饰器语法，适合初学者。',
                    url: 'https://example.com/python-decorator',
                    source: 'example.com',
                  },
                ],
              }
            : null,
          error_message: null,
          feedback: null,
          steps: [
            { step: 0, action: 'start', description: '开始处理任务...', time: new Date().toISOString() },
            { step: 1, action: 'search', description: '正在检索和筛选资料。', time: new Date().toISOString() },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    })
  })

  await page.route('**/api/agent/task/task-1/feedback', async route => {
    await route.fulfill({ json: { success: true, data: { task_id: 'task-1', feedback: 'useful' } } })
  })

  await page.route('**/api/agent/bookmark', async route => {
    await route.fulfill({ json: { success: true, data: { title: 'Python 装饰器入门', tags: ['Python'], url: 'https://example.com/python-decorator' } } })
  })

  await page.route('**/api/voice/tts', async route => {
    await route.fulfill({ status: 200, body: Buffer.from(''), contentType: 'audio/mpeg' })
  })
}

async function readProfileMarkers(page: Page) {
  return page.evaluate(({ collectedKey, recaptureKey }) => ({
    collected: localStorage.getItem(collectedKey),
    recapture: localStorage.getItem(recaptureKey),
  }), { collectedKey: AGENT_COLLECTED_KEY, recaptureKey: AGENT_RECAPTURE_KEY })
}

test.describe('AI 学伴任务流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ userId, collectedKey, recaptureKey }) => {
      localStorage.setItem('sparklearn_token', 'agent-action-token')
      localStorage.setItem('sparklearn_user', JSON.stringify({ user_id: userId, name: '林同学' }))
      localStorage.setItem(`sparklearn_new_user_guide_seen:${userId}`, 'true')
      localStorage.setItem(collectedKey, 'existing-marker')
      localStorage.setItem(recaptureKey, 'true')
    }, {
      userId: AGENT_USER_ID,
      collectedKey: AGENT_COLLECTED_KEY,
      recaptureKey: AGENT_RECAPTURE_KEY,
    })
  })

  test('正常流程：输入学习任务，等待任务完成，收藏结果并反馈', async ({ page }) => {
    await mockAgentApis(page)
    await page.goto('/agent')

    await page.getByRole('button', { name: '任务模式' }).click()
    await page.getByPlaceholder(/Python 装饰器/).fill('Python 装饰器学习资料：请按初学者路径推荐，并说明阅读顺序')
    await page.getByRole('button', { name: '发送任务' }).click()

    await expect(page.getByText('正在处理任务')).toBeVisible()
    await expect(page.getByText('找到 1 条可用学习资料。')).toBeVisible()
    await expect(page.getByText('Python 装饰器入门')).toBeVisible()

    await page.getByRole('button', { name: '收藏结果' }).click()
    await expect(page.getByText('已收藏')).toBeVisible()
    await page.getByRole('button', { name: '结果有帮助' }).click()
    await expect(page.getByText('反馈已记录')).toBeVisible()
  })

  test('边界情况：任务过短时前端拦截，不创建后端任务', async ({ page }) => {
    let createCalled = false
    await mockAgentApis(page)
    await page.route('**/api/agent/task', async route => {
      if (route.request().method() === 'POST') createCalled = true
      await route.fallback()
    })

    await page.goto('/agent')
    await page.getByRole('button', { name: '任务模式' }).click()
    await page.getByPlaceholder(/Python 装饰器/).fill('闭包')
    await page.getByRole('button', { name: '发送任务' }).click()

    await expect(page.getByText('任务描述太短')).toBeVisible()
    expect(createCalled).toBe(false)
  })

  test('安全的重新建档导航 action 立即清理完成标记并展示真实链接', async ({ page }) => {
    await mockAgentApis(page, {
      chatResponse: {
        answer: '画像已重置，请重新开始建档。',
        created_at: '2026-08-20T10:00:00Z',
        action: { type: 'navigate', label: '重新开始建档', href: '/onboarding' },
      },
    })
    await page.goto('/agent')

    const messageLog = page.getByRole('log', { name: '学习伙伴对话消息' })
    await expect(messageLog).toHaveAttribute('aria-live', 'polite')
    await page.getByPlaceholder(/直接提问/).fill('确认重置我的学习画像')
    await page.getByRole('button', { name: '发送任务' }).click()

    const actionLink = page.getByRole('link', { name: '重新开始建档' })
    await expect(actionLink).toHaveAttribute('href', '/onboarding')
    await expect.poll(() => readProfileMarkers(page)).toEqual({ collected: null, recapture: null })
  })

  test('确认重置 action 只展示确认回复，不伪造导航也不清理标记', async ({ page }) => {
    await mockAgentApis(page, {
      chatResponse: {
        answer: '这会删除现有画像。请回复确认后再继续。',
        created_at: '2026-08-20T10:00:00Z',
        action: { type: 'confirm_profile_reset' },
      },
    })
    await page.goto('/agent')

    await page.getByPlaceholder(/直接提问/).fill('帮我重置学习画像')
    await page.getByRole('button', { name: '发送任务' }).click()

    await expect(page.getByText('这会删除现有画像。请回复确认后再继续。', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '重新开始建档' })).toHaveCount(0)
    expect(await readProfileMarkers(page)).toEqual({ collected: 'existing-marker', recapture: 'true' })
  })

  for (const href of ['/profile', 'javascript:alert(1)']) {
    test(`非白名单导航 ${href} 不渲染链接、不清理画像标记`, async ({ page }) => {
      await mockAgentApis(page, {
        chatResponse: {
          answer: '请点击下一步。',
          created_at: '2026-08-20T10:00:00Z',
          action: { type: 'navigate', label: '继续', href },
        },
      })
      await page.goto('/agent')

      await page.getByPlaceholder(/直接提问/).fill('继续下一步')
      await page.getByRole('button', { name: '发送任务' }).click()

      await expect(page.getByRole('link', { name: '继续' })).toHaveCount(0)
      expect(await readProfileMarkers(page)).toEqual({ collected: 'existing-marker', recapture: 'true' })
    })
  }
})
