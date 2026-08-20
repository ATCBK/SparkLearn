import { expect, test, type Page } from '@playwright/test'

const AGENT_USER_ID = 'agent-action-test'
const AGENT_COLLECTED_KEY = `sparklearn_profile_collected_at:${AGENT_USER_ID}`
const AGENT_RECAPTURE_KEY = 'sparklearn_profile_needs_recapture'

function defaultSearchIntent() {
  return {
    schema_version: 'agent-search-intent-v1',
    decision: 'search',
    goal: '找到适合初学者的 Python 装饰器入门资料',
    normalized_query: 'Python 装饰器教程',
    constraints: ['中文优先'],
    output_focus: '按学习顺序说明先看哪一项',
    clarification_question: '',
    confidence: 0.82,
    generated_by: 'llm',
  }
}

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
    taskResult?: Record<string, unknown>
  } = {},
) {
  let pollCount = 0
  const defaultTaskResult = {
    items: [
      {
        title: 'Python 装饰器入门',
        summary: '从函数闭包过渡到装饰器语法，适合初学者。',
        url: 'https://example.com/python-decorator',
        source: 'example.com',
      },
    ],
    query_used: 'Python 装饰器 零基础 中文教程 示例',
    intent: {
      schema_version: 'agent-search-intent-v1',
      decision: 'search',
      goal: '找到适合初学者的 Python 装饰器入门资料',
      normalized_query: 'Python 装饰器 零基础 中文教程 示例',
      constraints: ['中文优先', '包含示例'],
      output_focus: '按学习顺序说明先看哪一项',
      clarification_question: '',
      confidence: 0.86,
      generated_by: 'llm',
    },
    tool_status: 'success',
    message: '浏览器检索工具已返回结果。',
  }

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
          result: completed ? options.taskResult || defaultTaskResult : null,
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
    const intentRegion = page.getByRole('region', { name: '搜索意图规划' })
    await expect(intentRegion.getByText('理解目标')).toBeVisible()
    await expect(intentRegion.getByText('找到适合初学者的 Python 装饰器入门资料')).toBeVisible()
    await expect(intentRegion.getByText('实际检索词')).toBeVisible()
    await expect(intentRegion.getByText('Python 装饰器 零基础 中文教程 示例')).toBeVisible()
    await expect(intentRegion.getByText('中文优先')).toBeVisible()
    const resultTitle = page.getByText('Python 装饰器入门', { exact: true })
    await expect(resultTitle).toBeVisible()
    const intentBox = await intentRegion.boundingBox()
    const resultBox = await resultTitle.boundingBox()
    expect(intentBox?.y).toBeLessThan(resultBox?.y || 0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

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

  for (const decision of ['clarify', 'respond'] as const) {
    test(`${decision} 结果作为普通伙伴消息展示且不渲染结果卡`, async ({ page }) => {
      const answer = decision === 'clarify'
        ? '你希望查找哪个具体主题？也可以补充语言或难度。'
        : '闭包会保留其定义环境中的变量。'
      await mockAgentApis(page, {
        taskResult: {
          answer,
          query_used: '',
          intent: {
            schema_version: 'agent-search-intent-v1',
            decision,
            goal: decision === 'clarify' ? '确认具体主题' : '解释 Python 闭包',
            normalized_query: '',
            constraints: [],
            output_focus: '直接回答',
            clarification_question: decision === 'clarify' ? answer : '',
            confidence: 0.65,
            generated_by: 'rule_fallback',
          },
          tool_status: 'not_called',
        },
      })
      await page.goto('/agent')
      await page.getByRole('button', { name: '任务模式' }).click()
      await page.getByPlaceholder(/Python 装饰器/).fill('请解释 Python 闭包是什么')
      await page.getByRole('button', { name: '发送任务' }).click()

      await expect(page.getByText(answer, { exact: true })).toBeVisible()
      await expect(page.getByRole('region', { name: '搜索意图规划' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: '收藏结果' })).toHaveCount(0)
      await expect(page.getByText('结果是否有帮助')).toHaveCount(0)
    })
  }

  for (const state of [
    { status: 'no_results', message: '浏览器检索工具未找到结果，请补充条件或更换关键词。' },
    { status: 'timeout', message: '浏览器检索工具调用超时，请稍后重试。' },
    { status: 'error', message: '浏览器检索工具调用失败，请稍后重试。' },
  ]) {
    test(`工具状态 ${state.status} 明确展示后端 message 且不生成虚构条目`, async ({ page }) => {
      await mockAgentApis(page, {
        taskResult: {
          items: [],
          query_used: 'Python 装饰器教程',
          intent: defaultSearchIntent(),
          tool_status: state.status,
          message: state.message,
        },
      })
      await page.goto('/agent')
      await page.getByRole('button', { name: '任务模式' }).click()
      await page.getByPlaceholder(/Python 装饰器/).fill('Python 装饰器学习资料')
      await page.getByRole('button', { name: '发送任务' }).click()

      await expect(page.getByText(state.message, { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '收藏结果' })).toHaveCount(0)
      await expect(page.getByText('Python 装饰器入门', { exact: true })).toHaveCount(0)
    })
  }

  test('旧搜索任务缺少意图字段时仍按原样展示结果', async ({ page }) => {
    await mockAgentApis(page, {
      taskResult: {
        items: [{
          title: '旧版 Python 教程',
          summary: '旧任务保存的搜索结果。',
          url: 'https://example.com/legacy',
          source: 'example.com',
        }],
      },
    })
    await page.goto('/agent')
    await page.getByRole('button', { name: '任务模式' }).click()
    await page.getByPlaceholder(/Python 装饰器/).fill('Python 旧版教程资料')
    await page.getByRole('button', { name: '发送任务' }).click()

    await expect(page.getByText('旧版 Python 教程')).toBeVisible()
    await expect(page.getByRole('region', { name: '搜索意图规划' })).toHaveCount(0)
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
