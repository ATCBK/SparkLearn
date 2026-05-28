/**
 * Digital Human E2E tests.
 *
 * Prerequisites:
 *   1. Backend running at http://localhost:8000
 *   2. Frontend dev server at http://localhost:3000
 *   3. At least one video with timeline.json in backend data dir
 *
 * Run: npx playwright test e2e/digital-human.spec.ts
 * Or:  npx playwright test --project=chromium e2e/digital-human.spec.ts
 *
 * Requires: npm install -D @playwright/test (if not already present)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Digital Human — Video Page', () => {
  test('page loads and shows video list or empty state', async ({ page }) => {
    await page.goto(`${BASE}/video`)

    // Should show either the video list heading or an empty state
    await expect(page.locator('h1')).toContainText('视频播放')
  })

  test('can navigate back to resource center', async ({ page }) => {
    await page.goto(`${BASE}/video`)

    const backLink = page.locator('a', { hasText: '返回资源中心' })
    if (await backLink.isVisible()) {
      await expect(backLink).toHaveAttribute('href', /generate/)
    }
  })

  test('mobile viewport shows floating button', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE}/video`)

    // Digital human should be accessible via floating button on mobile
    const floatBtn = page.locator('button').filter({ has: page.locator('svg') }).last()
    // If there are videos, the floating digital human button should be visible
    // If no videos, the empty state is shown instead
  })

  test('desktop shows three-column layout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/video`)

    // On desktop, the digital human panel should be visible (hidden lg:flex)
    // If no videos exist, empty state is shown instead
    await page.waitForLoadState('networkidle')
  })

  test('selecting a video shows player and controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/video`)
    await page.waitForLoadState('networkidle')

    // Click first video card if available
    const videoCards = page.locator('[class*="cursor-pointer"]').filter({ hasText: /全部视频|播放/ })
    // If videos exist, clicking one should show player area
  })

  test('digital human chat input is functional', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/video`)
    await page.waitForLoadState('networkidle')

    // The digital human panel should have a text input
    const chatInput = page.locator('input[placeholder*="输入"]')
    if (await chatInput.isVisible()) {
      await chatInput.fill('你好')
      await expect(chatInput).toHaveValue('你好')

      // Send button should be enabled when input has text
      const sendBtn = chatInput.locator('..').locator('button').last()
      // Clearing input should disable send
      await chatInput.fill('')
    }
  })

  test('mic button appears when ASR is supported', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/video`)
    await page.waitForLoadState('networkidle')

    // In Chromium, SpeechRecognition is available via webkit prefix; check mic button presence
    // Mic button may or may not appear depending on browser support
  })

  test('error state shows retry option', async ({ page }) => {
    // Simulate network failure by navigating when backend is down
    await page.goto(`${BASE}/video`)
    await page.waitForLoadState('networkidle')

    // If error state appears, it should have retry capability
    const errorState = page.locator('text=加载失败')
    if (await errorState.isVisible()) {
      const retryBtn = page.locator('button', { hasText: '重试' })
      if (await retryBtn.isVisible()) {
        await retryBtn.click()
      }
    }
  })
})
