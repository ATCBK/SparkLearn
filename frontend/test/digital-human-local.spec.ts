import { expect, test } from '@playwright/test'

test('视频页恢复旧版数字人且不再请求 SDK 会话', async ({ page }) => {
  const requestedPaths: string[] = []

  await page.addInitScript(() => {
    window.localStorage.setItem('sparklearn_token', 'digital-human-regression-token')
    window.localStorage.setItem('sparklearn_user', JSON.stringify({ user_id: 'regression-user', name: '回退验证用户' }))
  })

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    requestedPaths.push(url.pathname)

    if (url.pathname === '/api/video/resources') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            id: 'regression-video',
            title: '旧版数字人回退验证',
            video_url: '',
            duration: 60,
            created_at: '2026-08-21T00:00:00Z',
          }],
        }),
      })
      return
    }

    if (url.pathname === '/api/num-person/memory/load') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { memory_id: 'regression-memory', video_title: '旧版数字人回退验证' },
        }),
      })
      return
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })

  await page.goto('/video')

  const legacyAvatar = page.locator('iframe[title="数字人陪学"]')
  await expect(legacyAvatar).toBeVisible()
  await expect(legacyAvatar).toHaveAttribute('src', '/dh-live/index.html')
  await expect(page.locator('[aria-label="讯飞数字人画面"]')).toHaveCount(0)
  expect(requestedPaths).not.toContain('/api/num-person/digital-human/config')
  expect(requestedPaths).not.toContain('/api/num-person/digital-human/session')
})
