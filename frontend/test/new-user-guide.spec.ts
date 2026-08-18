import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test.describe('新手任务式引导', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sparklearn_token', 'test-token')
      window.localStorage.setItem('sparklearn_user', JSON.stringify({ user_id: 'new_user_guide_test', name: '新手用户' }))
      window.localStorage.removeItem('sparklearn_new_user_guide_seen:new_user_guide_test')
      window.localStorage.removeItem('sparklearn_new_user_guide_progress:new_user_guide_test')
      window.localStorage.removeItem('sparklearn_new_user_guide_active:new_user_guide_test')
      window.localStorage.removeItem('sparklearn_new_user_guide_step:new_user_guide_test')
    })
  })

  test('首次进入工作台自动展示小星同学案例链路', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('new-user-guide-panel')).toBeVisible()
    await expect(page.getByText('跟着小星同学完成一次学习闭环')).toBeVisible()
    await expect(page.getByText('8 步案例式引导')).toBeVisible()
    await page.getByRole('button', { name: /开始体验/ }).click()
    await expect(page.getByText('先知道今天从哪开始')).toBeVisible()
    await expect(page.getByRole('button', { name: '背后的思路' })).toBeVisible()
    await page.getByRole('button', { name: '背后的思路' }).click()
    await expect(page.getByText('工作台先组织学习动作')).toBeVisible()
    await expect(page.getByRole('button', { name: '回到任务' })).toBeVisible()
    await expect(page.getByRole('button', { name: /下一步/ })).toBeVisible()
  })

  test('画像建档页不自动展示平台新手引导', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(page.getByTestId('new-user-guide-panel')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /下一步|完成建档/ }).first()).toBeVisible()
  })

  test('功能页不被自动新手引导遮罩拦截侧栏导航', async ({ page }) => {
    await page.goto('/generate')
    await expect(page.getByTestId('new-user-guide-panel')).toHaveCount(0)

    await page.getByRole('link', { name: /知识图谱/ }).click()

    await expect(page).toHaveURL(/\/graph/)
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

  test('跨页面后继续恢复正在进行的小星同学引导', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sparklearn_new_user_guide_seen:new_user_guide_test', 'true')
      window.localStorage.setItem('sparklearn_new_user_guide_active:new_user_guide_test', 'true')
      window.localStorage.setItem('sparklearn_new_user_guide_step:new_user_guide_test', 'resource')
    })

    await page.goto('/generate')
    await expect(page.getByTestId('new-user-guide-panel')).toBeVisible()
    await expect(page.getByText('围绕当前卡点生成材料')).toBeVisible()
  })

  test('引导定位不依赖长固定等待', async () => {
    const source = readFileSync(resolve(__dirname, '../src/components/onboarding/NewUserGuidePanel.tsx'), 'utf8')

    expect(source).toContain('MutationObserver')
    expect(source).toContain('router.prefetch')
    expect(source).not.toContain('420')
  })
})
