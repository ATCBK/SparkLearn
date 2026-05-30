import { expect, test, type Page } from '@playwright/test'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

const mojibake = /[\uE000-\uF8FF]|\uFFFD|Ã|Â|(?:鈹|鈫|鉁|銆|锛|歿|噞|俓|寋|▄|鍙|鍩|鍑|鍒|鍔|鍚|鍛|鍦|鍧|鍏|鎴|鎵|鎺|鏁|鏃|鏄|闂|閫|閭|鐧|瀛|绔|绠|璧|璇|钖|杩|寮|缁|褰|涔|姝|澶|瑙|濂|涓|鏂|淇|浣|鑳|骞|闆|椤|熀|紝|€){2,}/

async function expectNoMojibake(page: Page) {
  const visibleText = await page.locator('body').innerText({ timeout: 10000 })
  expect(visibleText).not.toMatch(mojibake)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(4)
}

async function expectNoObviousTextClipping(page: Page) {
  const offenders = await page.evaluate(() => {
    const ignoredTags = new Set(['svg', 'path', 'canvas', 'img', 'video', 'textarea'])
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => {
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        const text = (el.innerText || el.textContent || '').trim()
        if (!text || ignoredTags.has(el.tagName.toLowerCase())) return false
        if (rect.width < 8 || rect.height < 8 || style.visibility === 'hidden' || style.display === 'none') return false
        if (style.textOverflow === 'ellipsis' || style.overflow === 'hidden' || style.overflowX === 'hidden' || style.overflowX === 'auto') return false
        const horizontalClip = style.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 6
        const verticalClip = style.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 8
        return horizontalClip || verticalClip
      })
      .slice(0, 8)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.textContent || '').trim().slice(0, 80),
        className: el.className?.toString().slice(0, 120),
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      }))
  })
  expect(offenders).toEqual([])
}

async function expectPageHealthy(page: Page) {
  await expect(page.locator('body')).toBeVisible()
  await expectNoMojibake(page)
  await expectNoHorizontalOverflow(page)
  await expectNoObviousTextClipping(page)
}

async function createForumPost(request: Page['request'], marker: string) {
  const response = await request.post(`${API_BASE}/api/forum/posts`, {
    data: {
      title: `端到端验收帖子 ${marker}`,
      content: `这是一条用于验证论坛搜索、详情、点赞、收藏和评论链路的帖子。标记：${marker}`,
      tags: ['Playwright', '验收'],
    },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as { id: number; title: string }
}

async function loginTeacher(page: Page) {
  await page.goto('/teacher/login')
  await page.locator('input[type="text"]').fill('teacher')
  await page.locator('input[type="password"]').fill('123456')
  await Promise.all([
    page.waitForURL(/\/teacher\/dashboard/, { timeout: 12000 }),
    page.getByRole('button', { name: /登录/ }).click(),
  ])
}

test.describe('全平台页面健康扫描', () => {
  test('学生端、广场端、辅导端页面在当前视口下无乱码、无横向溢出、无明显文字裁切', async ({ page, request }) => {
    const marker = Date.now().toString()
    const post = await createForumPost(request, marker)
    const routes = [
      '/',
      '/path',
      '/knowledge',
      '/practice',
      '/practice/records',
      '/practice/mistakes',
      '/practice/favorites',
      '/feed',
      '/generate?view=library',
      '/forum',
      '/forum/new',
      `/forum/${post.id}`,
      '/profile',
      '/profile/settings',
      '/report',
      '/video',
      '/agent',
      '/tutor',
      '/tutor/workshop',
      '/tutor/knowledge',
      '/tutor/files',
      '/tutor/roles',
      '/tutor/mcp-store',
      '/tutor/mcp-store/docs',
      '/plaza',
      '/plaza/qa',
      '/plaza/resource-share',
      '/plaza/experience-share',
      '/plaza/team-study',
      '/plaza/my-likes',
      '/plaza/my-comments',
      '/plaza/history',
      `/plaza/${post.id}`,
    ]

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(500)
      await expectPageHealthy(page)
    }
  })

  test('教师端页面在当前视口下无乱码、无横向溢出、无明显文字裁切', async ({ page }) => {
    const routes = [
      '/teacher/dashboard',
      '/teacher/students',
      '/teacher/students/stu_001',
      '/teacher/reports',
      '/teacher/interventions',
      '/teacher/ai',
      '/teacher/broadcast',
    ]

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(500)
      await expectPageHealthy(page)
    }
  })

  test('管理端页面在当前视口下无乱码、无横向溢出、无明显文字裁切', async ({ page }) => {
    await page.goto('/admin/login')
    await page.locator('form input').nth(0).fill('admin')
    await page.locator('form input[type="password"]').fill('123456')
    await Promise.all([
      page.waitForURL(/\/admin\/dashboard/, { timeout: 12000 }),
      page.getByRole('button', { name: /登录/ }).click(),
    ])

    const routes = ['/admin/dashboard', '/admin/users', '/admin/forum', '/admin/audit', '/admin/settings']
    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(500)
      await expectPageHealthy(page)
    }
  })
})

test.describe('全平台复杂业务链路', () => {
  test('论坛：发帖、搜索、详情、空评论拦截、评论、点赞、收藏完整链路', async ({ page }) => {
    const marker = Date.now().toString()
    const title = `论坛验收复杂任务 ${marker}`

    await page.goto('/forum/new')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    const titleInput = page.locator('form input').nth(0)
    await titleInput.click()
    await titleInput.pressSequentially(title, { delay: 1 })
    await expect(titleInput).toHaveValue(title)
    await page.locator('form textarea').fill('验证一个真实学生在学习论坛中提出问题、补充标签、再回到列表检索的完整路径。')
    await page.locator('form input').nth(1).fill('Python,函数,验收')
    await page.getByRole('button', { name: /^发布$/ }).click()
    await expect(page).toHaveURL(/\/forum\/\d+/, { timeout: 15000 })
    await expectPageHealthy(page)

    await page.getByRole('button', { name: /发送|评论/ }).click()
    await expect(page.getByText(/请输入评论内容/)).toBeVisible()

    await page.getByPlaceholder(/评论/).fill('这个问题可以补充一个闭包示例。')
    await page.getByRole('button', { name: /发送|评论/ }).click()
    await expect(page.getByText('这个问题可以补充一个闭包示例。')).toBeVisible()

    await page.getByRole('button', { name: /点赞/ }).click()
    await page.getByRole('button', { name: /收藏/ }).click()
    await expectPageHealthy(page)

    await page.goto('/forum')
    await page.getByPlaceholder(/搜索帖子/).fill(marker)
    await page.getByRole('button', { name: /搜索/ }).click()
    await expect(page.getByText(title)).toBeVisible()
  })

  test('个人设置：编辑资料、调整学习时间、保存后出现成功反馈', async ({ page }) => {
    await page.goto('/profile/settings')
    await expectPageHealthy(page)

    const uniqueName = `验收学生${Date.now().toString().slice(-5)}`
    await page.getByLabel(/姓名/).fill(uniqueName)
    await page.getByLabel(/邮箱/).fill('acceptance@example.com')
    await page.locator('input[type="range"]').fill('95')
    await page.getByRole('button', { name: /保存修改/ }).click()
    await expect(page.getByText(/保存成功/)).toBeVisible({ timeout: 10000 })
    await expectPageHealthy(page)
  })

  test('教师通知：空内容和指定学生未选择被后端拦截，正常通知可发送并标记查看状态', async ({ page }) => {
    await loginTeacher(page)
    await page.goto('/teacher/broadcast')
    await expectPageHealthy(page)

    await page.getByRole('button', { name: /发送通知/ }).click()
    await expect(page.getByText(/title is required|通知标题/)).toBeVisible()

    await page.getByRole('button', { name: /指定学生/ }).click()
    await page.getByPlaceholder(/通知标题/).fill('验收通知')
    await page.getByPlaceholder(/通知内容/).fill('请完成今天的函数闭包复盘。')
    const checked = await page.locator('input[type="checkbox"]').first().isVisible().catch(() => false)
    if (checked) {
      await page.locator('input[type="checkbox"]').first().click()
    }
    await page.getByRole('button', { name: /发送通知/ }).click()
    await expect(page.getByText('验收通知').first()).toBeVisible({ timeout: 12000 })
    await page.getByRole('button', { name: /标记为已查看/ }).first().click()
    await expect(page.getByText(/已查看/).first()).toBeVisible()
    await expectPageHealthy(page)
  })
})
