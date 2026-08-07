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
    await expect(page.getByText('跟着 SparkLearn 跑完整个平台')).toBeVisible()
    await expect(page.getByText('平台级新手任务流')).toBeVisible()
    await page.getByRole('button', { name: /开始体验/ }).click()
    await expect(page.getByText('从工作台开始你的学习闭环')).toBeVisible()
    await expect(page.getByRole('button', { name: /下一步/ })).toBeVisible()
  })

  test('跳过引导后刷新不再自动展示，重看入口仍可打开', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /开始体验/ }).click()
    await page.getByRole('button', { name: '跳过引导' }).click()
    await expect(page.getByTestId('new-user-guide-panel')).toBeHidden()
    await page.reload()
    await expect(page.getByTestId('new-user-guide-panel')).toHaveCount(0)
    await page.getByRole('button', { name: '新手引导' }).click({ force: true })
    await expect(page.getByTestId('new-user-guide-panel')).toBeVisible()
  })
})
