import { expect, test } from '@playwright/test'

test('PPT 预览允许 Office 初始化，同时保持 3D 资源严格隔离', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('sparklearn_token', 'resource-preview-regression-token')
    window.localStorage.setItem('sparklearn_user', JSON.stringify({
      user_id: 'resource-preview-regression-user',
      name: '资源预览回归用户',
    }))
  })
  await page.route('**/api/resources/*/preview/html*', async (route) => {
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>preview</title>' })
  })
  await page.route('**/api/resources', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'preview-ppt',
            title: 'PPT 隔离验证',
            type: 'ppt',
            status: 'completed',
            created_at: '2026-08-21',
            content: '# PPT 隔离验证',
            source_url: 'https://files.example.com/preview.pptx',
            progress: 100,
          },
          {
            id: 'preview-visual3d',
            title: '3D 隔离验证',
            type: 'visual3d',
            status: 'completed',
            created_at: '2026-08-21',
            content: '# 3D 隔离验证',
            source_url: 'sparklearn-artifact://visual3d/preview-visual3d/index.html',
            artifact_kind: 'threejs',
            progress: 100,
          },
        ],
      }),
    })
  })

  await page.goto('/generate?view=library&id=preview-ppt')

  const pptFrame = page.locator('iframe[title="PPT 隔离验证"]')
  await expect(pptFrame).toBeVisible()
  await expect(pptFrame).toHaveAttribute('sandbox', /\ballow-forms\b/)
  await expect(pptFrame).toHaveAttribute('sandbox', /\ballow-same-origin\b/)

  await page.getByRole('button', { name: /3D 隔离验证/ }).click()

  const visual3dFrame = page.locator('iframe[title="3D 隔离验证"]')
  await expect(visual3dFrame).toBeVisible()
  await expect(visual3dFrame).toHaveAttribute('sandbox', 'allow-scripts allow-downloads')
})
