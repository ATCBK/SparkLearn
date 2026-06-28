import { expect, test } from '@playwright/test'

test.describe('学习伙伴认养界面', () => {
  test('首次进入时展示大角色卡和实时预览', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sparklearn_token', 'test-token')
      localStorage.setItem('sparklearn_user', JSON.stringify({ user_id: 'single_user', name: '测试用户' }))
    })
    await page.route('**/api/agent/pet', async route => {
      await route.fulfill({ json: { success: true, data: null } })
    })

    await page.goto('/agent')

    await expect(page.getByRole('heading', { name: '创建你的 AI 学习伙伴' })).toBeVisible()
    await expect(page.getByText('选择最适合你的学习伙伴')).toBeVisible()
    await expect(page.getByRole('button', { name: /灵狐/ })).toBeVisible()
    await expect(page.getByText('实时伙伴预览')).toBeVisible()
    await expect(page.getByText('擅长：搜索发现').first()).toBeVisible()
  })
})
