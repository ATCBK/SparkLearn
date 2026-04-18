import { test, expect } from '@playwright/test'

test.describe('Auth 页面 (/auth)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth')
  })

  test('页面加载后显示"登录"和"注册" Tab', async ({ page }) => {
    const tabArea = page.locator('div.flex.gap-1.bg-bg-hover')
    await expect(tabArea.locator('button:text("登录")')).toBeVisible()
    await expect(tabArea.locator('button:text("注册")')).toBeVisible()
  })

  test('点击"注册" Tab 切换到注册表单', async ({ page }) => {
    const tabArea = page.locator('div.flex.gap-1.bg-bg-hover')
    await tabArea.locator('button:text("注册")').click()
    await expect(page.getByPlaceholder('请再次输入密码')).toBeVisible()
    await expect(page.locator('form button[type="submit"]')).toContainText('注册')
  })

  test('点击"登录" Tab 切换回登录表单', async ({ page }) => {
    const tabArea = page.locator('div.flex.gap-1.bg-bg-hover')
    await tabArea.locator('button:text("注册")').click()
    await expect(page.getByPlaceholder('请再次输入密码')).toBeVisible()

    await tabArea.locator('button:text("登录")').click()
    await expect(page.getByPlaceholder('请再次输入密码')).not.toBeVisible()
    await expect(page.locator('form button[type="submit"]')).toContainText('登录')
  })

  test('登录表单有邮箱和密码输入框', async ({ page }) => {
    await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible()
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
    await expect(page.getByPlaceholder('请再次输入密码')).not.toBeVisible()
  })

  test('注册表单有邮箱、密码和确认密码输入框', async ({ page }) => {
    const tabArea = page.locator('div.flex.gap-1.bg-bg-hover')
    await tabArea.locator('button:text("注册")').click()
    await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible()
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
    await expect(page.getByPlaceholder('请再次输入密码')).toBeVisible()
  })

  test('点击登录按钮可以跳转到 onboarding', async ({ page }) => {
    await page.locator('form button[type="submit"]').click()
    await expect(page).toHaveURL(/onboarding/, { timeout: 10000 })
  })

  test('左侧品牌区显示 SparkLearn 和数据亮点', async ({ page }) => {
    await expect(page.getByText('SparkLearn').first()).toBeVisible()
    await expect(page.getByText('AI 驱动的个性化学习平台')).toBeVisible()
    await expect(page.getByText('10w+')).toBeVisible()
    await expect(page.getByText('95%')).toBeVisible()
    await expect(page.getByText('50+')).toBeVisible()
  })

  test('登录表单可以输入邮箱和密码', async ({ page }) => {
    await page.getByPlaceholder('请输入邮箱').fill('test@example.com')
    await page.getByPlaceholder('请输入密码').fill('password123')
    await expect(page.getByPlaceholder('请输入邮箱')).toHaveValue('test@example.com')
    await expect(page.getByPlaceholder('请输入密码')).toHaveValue('password123')
  })

  test('注册表单可以输入邮箱、密码和确认密码', async ({ page }) => {
    const tabArea = page.locator('div.flex.gap-1.bg-bg-hover')
    await tabArea.locator('button:text("注册")').click()
    await page.getByPlaceholder('请输入邮箱').fill('new@example.com')
    await page.getByPlaceholder('请输入密码').fill('pass123')
    await page.getByPlaceholder('请再次输入密码').fill('pass123')
    await expect(page.getByPlaceholder('请再次输入密码')).toHaveValue('pass123')
  })

  test('密码可见/隐藏切换按钮存在', async ({ page }) => {
    const passwordInput = page.getByPlaceholder('请输入密码')
    await expect(passwordInput).toBeVisible()
    const eyeBtn = page.locator('button:has(svg)').filter({ has: page.locator('svg') }).nth(1)
    await expect(eyeBtn).toBeVisible()
  })

  test('记住我复选框存在', async ({ page }) => {
    await expect(page.getByText('记住我')).toBeVisible()
  })

  test('忘记密码链接存在', async ({ page }) => {
    await expect(page.getByText('忘记密码？')).toBeVisible()
  })

  test('截图 - 登录页面', async ({ page }) => {
    await page.screenshot({ path: 'screenshots/auth-login.png', fullPage: true })
  })

  test('截图 - 注册页面', async ({ page }) => {
    const tabArea = page.locator('div.flex.gap-1.bg-bg-hover')
    await tabArea.locator('button:text("注册")').click()
    await page.screenshot({ path: 'screenshots/auth-register.png', fullPage: true })
  })
})

test.describe('Onboarding 页面 (/onboarding)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForTimeout(1500)
  })

  test('页面加载后显示步骤指示器（5个步骤标题）', async ({ page }) => {
    await expect(page.getByText('学习目标').first()).toBeVisible()
    await expect(page.getByText('编程基础')).toBeVisible()
    await expect(page.getByText('薄弱环节')).toBeVisible()
    await expect(page.getByText('学习偏好')).toBeVisible()
    await expect(page.getByText('学习时间')).toBeVisible()
  })

  test('AI气泡显示问题文字', async ({ page }) => {
    // 等待打字动画结束
    await page.waitForTimeout(1500)
    await expect(page.locator('p.text-body:text("你的学习目标是什么？")')).toBeAttached()
  })

  test('第一步显示4个卡片选项', async ({ page }) => {
    await expect(page.getByText('期末提分')).toBeVisible()
    await expect(page.getByText('竞赛准备')).toBeVisible()
    await expect(page.getByText('兴趣探索')).toBeVisible()
    await expect(page.getByText('求职准备')).toBeVisible()
  })

  test('点击卡片选项后可以选中（高亮）', async ({ page }) => {
    const card = page.getByText('期末提分').locator('..')
    await card.click()
    const cardBtn = page.locator('button:has-text("期末提分")')
    await expect(cardBtn).toHaveClass(/border-blue/)
  })

  test('第一步未选择时"下一步"按钮为 disabled', async ({ page }) => {
    const nextBtn = page.getByRole('button', { name: '下一步' })
    await expect(nextBtn).toBeVisible()
    await expect(nextBtn).toBeDisabled()
  })

  test('第一步"上一步"按钮为 disabled', async ({ page }) => {
    const backBtn = page.getByRole('button', { name: '上一步' })
    await expect(backBtn).toBeVisible()
    await expect(backBtn).toBeDisabled()
  })

  test('选择选项后点击"下一步"进入第二步', async ({ page }) => {
    await page.getByText('期末提分').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)
    await expect(page.getByText('你的编程基础如何？')).toBeAttached()
  })

  test('第二步显示编程基础选项', async ({ page }) => {
    await page.getByText('期末提分').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)
    await expect(page.getByText('零基础')).toBeVisible()
    await expect(page.getByText('有一些基础')).toBeVisible()
    await expect(page.getByText('基础较好')).toBeVisible()
    await expect(page.getByText('有编程经验')).toBeVisible()
  })

  test('返回按钮在第二步可用且可以回到第一步', async ({ page }) => {
    await page.getByText('期末提分').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)
    const backBtn = page.getByRole('button', { name: '上一步' })
    await expect(backBtn).toBeEnabled()
    await backBtn.click()
    await expect(page.getByText('期末提分')).toBeVisible()
  })

  test('第三步显示标签云（薄弱环节）', async ({ page }) => {
    await page.getByText('期末提分').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)
    await page.getByText('有一些基础').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)
    await expect(page.getByText('选择需要加强的方向（可多选）')).toBeVisible()
    await expect(page.getByText('数据结构')).toBeVisible()
    await expect(page.getByText('算法设计')).toBeVisible()
  })

  test('步骤指示器在前进后更新状态', async ({ page }) => {
    await page.getByText('期末提分').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)
    await expect(page.getByText('学习目标').first()).toHaveClass(/text-success/)
  })

  test('完整流程：从第1步到最后一步摘要', async ({ page }) => {
    // Step 1
    await page.getByText('期末提分').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)

    // Step 2
    await page.getByText('有一些基础').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)

    // Step 3
    await page.getByText('数据结构').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)

    // Step 4
    await page.getByText('实践型').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)

    // Step 5
    await page.getByText('1–2 小时').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)

    // Summary
    await expect(page.getByText('以下是为你构建的学习画像：')).toBeVisible()
    await expect(page.getByRole('button', { name: '开始学习' })).toBeVisible()
  })

  test('页面无乱码（中文字符正常显示）', async ({ page }) => {
    // 检查步骤指示器标题
    await expect(page.getByText('学习目标').first()).toBeVisible()
    // 检查按钮文字
    await expect(page.getByRole('button', { name: '下一步' })).toBeVisible()
    await expect(page.getByRole('button', { name: '上一步' })).toBeVisible()
    // 检查选项文字
    await expect(page.getByText('期末提分')).toBeVisible()
  })

  test('截图 - 第一步', async ({ page }) => {
    await page.screenshot({ path: 'screenshots/onboarding-step1.png', fullPage: true })
  })

  test('截图 - 第三步标签云', async ({ page }) => {
    await page.getByText('期末提分').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)
    await page.getByText('有一些基础').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'screenshots/onboarding-step3.png', fullPage: true })
  })
})
