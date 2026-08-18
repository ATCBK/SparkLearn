import { expect, test } from '@playwright/test'

test('答题记录页兼容缺少 question 的历史记录', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const url = route.request().url()
    if (url.includes('/api/quiz/records')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              quiz_id: 'q1',
              answer: 'list',
              correct: true,
              correct_answer: 'list',
              knowledge_point_id: '1.2',
              at: '2026-04-20',
            },
          ],
        }),
      })
      return
    }

    if (url.includes('/api/profile')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user_id: 'legacy-record-user',
            name: '历史记录用户',
            major: 'Python',
            grade: '大一',
            goal: ['掌握核心技能'],
            knowledge_level: '入门',
            weak_points: [],
            learning_preference: [],
          },
        }),
      })
      return
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })

  await page.addInitScript(() => {
    localStorage.setItem('sparklearn_token', 'legacy-record-token')
    localStorage.setItem('sparklearn_user', JSON.stringify({
      id: 'legacy-record-user',
      user_id: 'legacy-record-user',
      name: '历史记录用户',
    }))
  })

  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))

  await page.goto('/practice/records')

  await expect(page.getByRole('heading', { name: '答题记录' })).toBeVisible()
  await expect(page.getByText('题目 q1')).toBeVisible()
  expect(errors).not.toContain(expect.stringContaining("Cannot read properties of undefined"))
})
