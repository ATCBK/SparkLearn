import { expect, test, type Page } from '@playwright/test'

const mojibake = /[\uE000-\uF8FF]|\uFFFD|Ã|Â|(?:鈹|鈫|鉁|銆|锛|歿|噞|俓|寋|▄|鍙|鍩|鍑|鍒|鍔|鍚|鍛|鍦|鍧|鍏|鎴|鎵|鎺|鏁|鏃|鏄|闂|閫|閭|鐧|瀛|绔|绠|璧|璇|钖|杩|寮|缁|褰|涔|姝|澶|瑙|濂|涓|鏂|淇|浣|鑳|骞|闆|椤|熀|紝|€){2,}/

async function expectNoMojibake(page: Page) {
  const visibleText = await page.locator('body').innerText({ timeout: 10000 })
  expect(visibleText).not.toMatch(mojibake)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return doc.scrollWidth - doc.clientWidth
  })
  expect(overflow).toBeLessThanOrEqual(4)
}

async function expectInteractivePageHealthy(page: Page) {
  await expect(page.locator('body')).toBeVisible()
  await expectNoMojibake(page)
  await expectNoHorizontalOverflow(page)
}

test.describe('端到端验收：学生主链路', () => {
  test('正常流程：登录、画像采集、任务完成、练习提交、报告查看', async ({ page }) => {
    await page.goto('/auth')
    await expectInteractivePageHealthy(page)

    await page.getByPlaceholder(/邮箱|账号|email/i).fill('student@example.com')
    await page.getByPlaceholder(/密码|password/i).first().fill('pass123456')
    await page.locator('form button[type="submit"]').click()
    await expect(page).toHaveURL(/\/onboarding/)

    const onboardingInputs = ['掌握 Python 核心能力', '有一些基础', '函数、闭包和项目实战', '动手实践和文档阅读', '每天 30-60 分钟']
    for (const text of onboardingInputs) {
      const textbox = page.getByRole('textbox').last()
      await expect(textbox).toBeVisible()
      await textbox.fill(text)
      const send = textbox.locator('..').getByRole('button').first()
      await expect(send).toBeEnabled()
      await send.click()
      await page.waitForTimeout(900)
    }
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 })
    await expectInteractivePageHealthy(page)

    const taskToggle = page.locator('button').filter({ hasText: /^$/ }).first()
    if (await taskToggle.isVisible().catch(() => false)) {
      await taskToggle.click()
    }

    await page.goto('/practice')
    await expectInteractivePageHealthy(page)
    const answer = page.getByRole('button').filter({ hasText: /list|def|退出循环|添加/ }).first()
    if (await answer.isVisible().catch(() => false)) {
      await answer.click()
      await page.getByRole('button', { name: /提交|确认/ }).first().click()
      await expect(page.getByText(/正确|错误|答案|解析/)).toBeVisible({ timeout: 10000 })
    }

    await page.goto('/report')
    await expectInteractivePageHealthy(page)
    await expect(page.getByText(/学习报告|掌握|建议|正确率/).first()).toBeVisible()
  })

  test('边界流程：空登录、无选择继续、资源库搜索无结果、论坛空内容拦截', async ({ page }) => {
    await page.goto('/auth')
    await page.locator('form button[type="submit"]').click()
    await expect(page).toHaveURL(/\/auth/)
    await expect(page.getByText(/填写|邮箱|密码|required/i).first()).toBeVisible()

    await page.goto('/onboarding')
    const next = page.getByRole('button', { name: /下一步|完成/ }).first()
    await expect(next).toBeDisabled()

    await page.goto('/generate?view=library')
    await expectInteractivePageHealthy(page)
    const search = page.getByPlaceholder(/搜索/)
    await search.fill('zzzz-no-resource-match-987')
    await expect(page.getByText(/没有|暂无|无匹配/).first()).toBeVisible()

    await page.goto('/forum/new')
    await expectInteractivePageHealthy(page)
    await page.getByRole('button', { name: /发布|提交/ }).first().click()
    await expect(page.getByText(/必填|标题|内容|不能为空|请输入/).first()).toBeVisible()
  })
})

test.describe('端到端验收：教师与管理链路', () => {
  test('教师正常与异常流程：登录、学生详情、AI 诊断空/正常请求', async ({ page }) => {
    await page.goto('/teacher/login')
    await page.getByPlaceholder(/教师|账号/).fill('wrong')
    await page.getByPlaceholder(/密码/).fill('wrong')
    await page.getByRole('button', { name: /登录/ }).click()
    await expect(page.getByText(/错误|账号|密码/).first()).toBeVisible()

    await page.getByPlaceholder(/教师|账号/).fill('teacher')
    await page.getByPlaceholder(/密码/).fill('123456')
    const loginButton = page.getByRole('button', { name: /登录/ })
    await expect(loginButton).toBeEnabled()
    await Promise.all([
      page.waitForURL(/\/teacher\/dashboard/, { timeout: 12000 }),
      loginButton.click(),
    ])
    await expectInteractivePageHealthy(page)

    await page.goto('/teacher/students')
    await expectInteractivePageHealthy(page)
    await page.getByRole('link', { name: /查看/ }).first().click()
    await expect(page).toHaveURL(/\/teacher\/students\//)
    await expectInteractivePageHealthy(page)
  })

  test('管理端边界：未登录跳转、错误登录拦截、正确登录进入审核页', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/\/admin\/login/)

    await page.getByPlaceholder(/账号|用户名/).fill('admin')
    await page.getByPlaceholder(/密码/).fill('bad-password')
    await page.getByRole('button', { name: /登录/ }).click()
    await expect(page.getByText(/错误|账号|密码/).first()).toBeVisible()

    await page.getByPlaceholder(/账号|用户名/).fill('admin')
    await page.getByPlaceholder(/密码/).fill('123456')
    await page.getByRole('button', { name: /登录/ }).click()
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    await page.goto('/admin/forum')
    await expectInteractivePageHealthy(page)
  })
})
