import { expect, test } from '@playwright/test'

function sseEvent(type: string, payload: Record<string, unknown>) {
  return `data: ${JSON.stringify({ type, payload })}\n\n`
}

test.describe('多智能体研讨会时间线工作台', () => {
  test('默认保留研讨会视图，切换后展示 AgentVerse 风格赛博小镇', async ({ page }) => {
    await page.route('**/api/tutor/roles', async route => {
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: 1,
              name: 'Python 导师',
              persona: '负责专业解释',
              background: '',
              style_guide: '',
              rules: '',
              enabled: true,
            },
          ],
        },
      })
    })

    await page.goto('/tutor/workshop')

    await expect(page.getByTestId('workshop-timeline')).not.toBeVisible()
    await expect(page.getByTestId('cyber-town-verse')).not.toBeVisible()

    await page.getByTestId('view-mode-town').click()

    await expect(page.getByTestId('cyber-town-verse')).toBeVisible()
    await expect(page.getByTestId('cyber-town-verse')).toContainText('AgentVerse')
    await expect(page.getByTestId('town-building-profile-agent')).toContainText('画像塔')

    await page.getByTestId('view-mode-classic').click()
    await expect(page.getByTestId('cyber-town-verse')).not.toBeVisible()
  })

  test('赛博小镇模式根据 hub 事件点亮建筑并保留证据链', async ({ page }) => {
    const finalContent = '学科导师：先用小项目验证作用域、返回值和参数传递。'

    await page.route('**/api/tutor/roles', async route => {
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: 1,
              name: 'Python 导师',
              persona: '负责专业解释',
              background: '',
              style_guide: '',
              rules: '',
              enabled: true,
            },
          ],
        },
      })
    })

    await page.route('**/api/tutor/conversations', async route => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            id: 90,
            role_id: 1,
            title: '函数学习研讨',
            created_at: '2026-08-10T00:00:00Z',
            updated_at: '2026-08-10T00:00:00Z',
            message_count: 0,
          },
        },
      })
    })

    await page.route('**/api/tutor/chat', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: [
          sseEvent('workshop_phase', { phase: 'discussion', round: 1, status: 'running' }),
          sseEvent('hub', {
            phase: 'discussion',
            round: 1,
            agent_id: 'subject-tutor',
            agent_name: '学科导师',
            agent_kind: 'system',
            content: '学科导师：先用小项目验证作用域。',
            timestamp: '2026-08-10T00:00:12Z',
            delta: true,
          }),
          sseEvent('hub', {
            phase: 'discussion',
            round: 1,
            agent_id: 'subject-tutor',
            agent_name: '学科导师',
            agent_kind: 'system',
            content: finalContent,
            timestamp: '2026-08-10T00:00:15Z',
            delta: false,
          }),
          sseEvent('text', { content: '最终建议：用小项目完成函数迁移练习。' }),
          sseEvent('done', {
            message: {
              id: 101,
              conversation_id: 90,
              role: 'assistant',
              content: '',
              timestamp: '2026-08-10T00:00:20Z',
            },
          }),
        ].join(''),
      })
    })

    await page.goto('/tutor/workshop')
    await page.getByTestId('view-mode-town').click()
    await page.getByTestId('workshop-input').fill('帮我 7 天补齐 Python 函数薄弱点')
    await page.getByTestId('workshop-submit').click()

    await expect(page.getByTestId('town-building-subject-tutor')).toContainText('已完成')
    await page.getByTestId('town-building-subject-tutor').click()
    await expect(page.getByTestId('town-inspector')).toContainText('学科导师')
    await expect(page.getByTestId('town-inspector')).toContainText('参数传递')
    await expect(page.getByTestId('workshop-timeline')).toBeVisible()
    await expect(page.getByTestId('timeline-card-subject-tutor-1')).toHaveCount(1)
  })

  test('时间线默认显示摘要，点击后展开完整发言', async ({ page }) => {
    const fullContent = '资料研究员查证后发现：函数返回值、作用域、参数传递是当前学习路径里最容易混淆的三个前置点。建议先做 10 分钟诊断题，再进入主题练习，否则直接刷综合题会掩盖基础缺口。'

    await page.route('**/api/tutor/roles', async route => {
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: 1,
              name: 'Python 导师',
              persona: '负责专业解释',
              background: '',
              style_guide: '',
              rules: '',
              enabled: true,
            },
            {
              id: 2,
              name: '行动教练',
              persona: '负责学习计划',
              background: '',
              style_guide: '',
              rules: '',
              enabled: true,
            },
          ],
        },
      })
    })

    await page.route('**/api/tutor/conversations', async route => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            id: 88,
            role_id: 1,
            title: '函数学习研讨',
            created_at: '2026-08-10T00:00:00Z',
            updated_at: '2026-08-10T00:00:00Z',
            message_count: 0,
          },
        },
      })
    })

    await page.route('**/api/tutor/chat', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: [
          sseEvent('workshop_phase', { phase: 'discussion', round: 1, status: 'running' }),
          sseEvent('hub', {
            phase: 'discussion',
            round: 1,
            agent_id: 'researcher',
            agent_name: '资料研究员',
            agent_kind: 'system',
            content: fullContent,
            timestamp: '2026-08-10T00:00:12Z',
          }),
          sseEvent('text', { content: '最终建议：先诊断，再练习。' }),
          sseEvent('done', {
            message: {
              id: 99,
              conversation_id: 88,
              role: 'assistant',
              content: '最终建议：先诊断，再练习。',
              timestamp: '2026-08-10T00:00:20Z',
            },
          }),
        ].join(''),
      })
    })

    await page.goto('/tutor/workshop')
    await page.getByTestId('workshop-input').fill('帮我 7 天补齐 Python 函数薄弱点')
    await page.getByTestId('workshop-submit').click()

    const card = page.getByTestId('timeline-card-researcher-1')

    await expect(page.getByTestId('workshop-timeline')).toBeVisible()
    await expect(card.getByText('资料研究员查证后发现')).toBeVisible()
    await expect(card.getByText('否则直接刷综合题会掩盖基础缺口')).not.toBeVisible()

    await card.click()
    await expect(card.getByText('否则直接刷综合题会掩盖基础缺口')).toBeVisible()
  })

  test('同一智能体同一轮的流式增量和最终定稿只显示一张卡片', async ({ page }) => {
    const partialContent = '学科导师：先按函数基础拆成三个阶段。'
    const finalContent = '学科导师：先按函数基础拆成三个阶段，再用小项目验证作用域、返回值和参数传递。'

    await page.route('**/api/tutor/roles', async route => {
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: 1,
              name: 'Python 导师',
              persona: '负责专业解释',
              background: '',
              style_guide: '',
              rules: '',
              enabled: true,
            },
          ],
        },
      })
    })

    await page.route('**/api/tutor/conversations', async route => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            id: 89,
            role_id: 1,
            title: '函数学习研讨',
            created_at: '2026-08-10T00:00:00Z',
            updated_at: '2026-08-10T00:00:00Z',
            message_count: 0,
          },
        },
      })
    })

    await page.route('**/api/tutor/chat', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: [
          sseEvent('hub', {
            phase: 'discussion',
            round: 1,
            agent_id: 'subject-tutor',
            agent_name: '学科导师',
            agent_kind: 'system',
            content: partialContent,
            timestamp: '2026-08-10T00:00:12Z',
            delta: true,
          }),
          sseEvent('hub', {
            phase: 'discussion',
            round: 1,
            agent_id: 'subject-tutor',
            agent_name: '学科导师',
            agent_kind: 'system',
            content: finalContent,
            timestamp: '2026-08-10T00:00:15Z',
            delta: false,
          }),
          sseEvent('done', {
            message: {
              id: 100,
              conversation_id: 89,
              role: 'assistant',
              content: '',
              timestamp: '2026-08-10T00:00:20Z',
            },
          }),
        ].join(''),
      })
    })

    await page.goto('/tutor/workshop')
    await page.getByTestId('workshop-input').fill('帮我 7 天补齐 Python 函数薄弱点')
    await page.getByTestId('workshop-submit').click()

    await expect(page.getByTestId('timeline-card-subject-tutor-1')).toHaveCount(1)
    await expect(page.getByTestId('timeline-card-subject-tutor-1')).toContainText('小项目验证作用域')
  })
})
