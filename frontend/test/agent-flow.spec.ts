import { expect, test } from '@playwright/test'

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

async function mockAgentApis(page: import('@playwright/test').Page) {
  let pollCount = 0

  await page.route('**/api/agent/pet', async route => {
    await route.fulfill({ json: { success: true, data: pet } })
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

test.describe('AI 学伴任务流程', () => {
  test('正常流程：输入学习任务，等待任务完成，收藏结果并反馈', async ({ page }) => {
    await mockAgentApis(page)
    await page.goto('/agent')

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
    await page.getByPlaceholder(/Python 装饰器/).fill('闭包')
    await page.getByRole('button', { name: '发送任务' }).click()

    await expect(page.getByText('任务描述太短')).toBeVisible()
    expect(createCalled).toBe(false)
  })
})
