import { expect, test, type Page } from '@playwright/test'

const question = {
  id: 'favorite-control-q1',
  type: 'single',
  content: 'break 语句的作用是什么？',
  options: ['跳过当前迭代', '退出循环', '暂停循环', '重新开始循环'],
  correct_answer: '退出循环',
  explanation: 'break 用于立即退出当前循环。',
}

async function mockPracticeApis(page: Page, favoriteUpdates: boolean[]) {
  let favorited = false

  await page.route('**/api/quiz?**', async (route) => {
    await route.fulfill({ json: { success: true, data: [question] } })
  })

  await page.route('**/api/quiz/favorites', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          success: true,
          data: favorited
            ? [{ quiz_id: question.id, question, created_at: '2026-08-21' }]
            : [],
        },
      })
      return
    }

    const payload = route.request().postDataJSON() as { favorite: boolean }
    favorited = payload.favorite
    favoriteUpdates.push(payload.favorite)
    await route.fulfill({
      json: { success: true, data: { quiz_id: question.id, favorite: favorited } },
    })
  })

  await page.route('**/api/quiz/submit', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          correct: true,
          correct_answer: question.correct_answer,
          explanation: question.explanation,
        },
      },
    })
  })
}

test('收藏控件在答题前后都可以收藏和取消收藏', async ({ page }) => {
  const favoriteUpdates: boolean[] = []

  await page.addInitScript(() => {
    window.localStorage.setItem('sparklearn_token', 'practice-favorite-test-token')
    window.localStorage.setItem('sparklearn_user', JSON.stringify({
      user_id: 'practice-favorite-test',
      name: '收藏控件测试用户',
    }))
    window.localStorage.setItem('sparklearn_new_user_guide_seen:practice-favorite-test', 'true')
  })
  await mockPracticeApis(page, favoriteUpdates)

  await page.goto('/practice')
  await page.getByRole('combobox').selectOption('函数返回值')
  await page.getByRole('button', { name: '继续生成' }).click()

  const collectButton = page.getByRole('button', { name: '收藏', exact: true })
  await expect(collectButton).toBeVisible()
  await expect(collectButton).toBeEnabled()
  await collectButton.click()
  await expect(page.getByRole('button', { name: '已收藏', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '已收藏', exact: true }).click()
  await expect(collectButton).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('button', { name: '退出循环', exact: true }).click()
  await page.getByRole('button', { name: '提交判题' }).click()
  await expect(page.getByRole('button', { name: '已提交' })).toBeVisible()

  await expect(collectButton).toBeEnabled()
  await collectButton.click()
  await expect(page.getByRole('button', { name: '已收藏', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '已收藏', exact: true }).click()
  await expect(collectButton).toHaveAttribute('aria-pressed', 'false')

  expect(favoriteUpdates).toEqual([true, false, true, false])
})
