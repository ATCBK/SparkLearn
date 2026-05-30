# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> Auth 页面 >> 注册表单输入功能
- Location: test\pages.spec.ts:39:7

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: locator.click: Test timeout of 45000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '注册' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - img "学而思 SparkLearn" [ref=e4]
      - generic [ref=e5]:
        - strong [ref=e6]: 学而思 SparkLearn
        - generic [ref=e7]: 智能个性化学习平台
    - generic [ref=e8]:
      - generic [ref=e9]:
        - heading "让学习更懂你 成就每一次进步" [level=1] [ref=e10]:
          - text: 让学习更懂你
          - generic [ref=e11]: 成就每一次进步
        - paragraph [ref=e12]:
          - text: 学习画像持续进化，越学越懂你，资
          - generic [ref=e13]: "|"
        - generic [ref=e14]:
          - article [ref=e15]:
            - img [ref=e17]
            - heading "学习画像" [level=2] [ref=e21]
            - paragraph [ref=e22]:
              - text: 数据驱动的个性化分析
              - text: 全面了解你的学习情况
            - generic [ref=e23]: 知识掌握度 72%
          - article [ref=e26]:
            - img [ref=e28]
            - heading "当前学习路径" [level=2] [ref=e31]
            - paragraph [ref=e32]:
              - text: 函数与导数进阶
              - text: 第 3/8 阶段 · 进行中
          - article [ref=e37]:
            - img [ref=e39]
            - heading "今日推荐任务" [level=2] [ref=e43]
            - paragraph [ref=e44]:
              - text: 导数的应用练习
              - text: 巩固知识 · 提升能力
            - generic [ref=e45]:
              - generic [ref=e46]: 去学习
              - generic [ref=e47]: →
      - complementary [ref=e48]:
        - heading "欢迎回来" [level=2] [ref=e49]
        - paragraph [ref=e50]: 登录继续你的个性化学习之旅
        - tablist "登录注册切换" [ref=e51]:
          - tab "登录" [selected] [ref=e52] [cursor=pointer]
          - tab "注册" [ref=e53] [cursor=pointer]
        - generic [ref=e54]:
          - generic [ref=e55]:
            - img
            - textbox "请输入邮箱" [ref=e56]
          - generic [ref=e57]:
            - img
            - textbox "请输入密码" [ref=e58]
            - button "显示或隐藏密码" [ref=e59] [cursor=pointer]:
              - img [ref=e60]
          - generic [ref=e63]:
            - generic [ref=e64] [cursor=pointer]:
              - checkbox "记住我" [ref=e65]
              - generic [ref=e66]: 记住我
            - button "忘记密码？" [ref=e67] [cursor=pointer]
          - button "立即登录" [ref=e68] [cursor=pointer]
        - generic [ref=e69]:
          - img [ref=e70]
          - generic [ref=e72]:
            - text: 登录即表示同意
            - link "《用户协议》" [ref=e73] [cursor=pointer]:
              - /url: "#"
            - text: 与
            - link "《隐私政策》" [ref=e74] [cursor=pointer]:
              - /url: "#"
  - button "Open Next.js Dev Tools" [ref=e80] [cursor=pointer]:
    - img [ref=e81]
  - alert [ref=e84]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | // ============================================================
  4   | // 1. Auth 页面 (/auth)
  5   | // ============================================================
  6   | test.describe('Auth 页面', () => {
  7   |   test.beforeEach(async ({ page }) => {
  8   |     await page.goto('/auth')
  9   |   })
  10  | 
  11  |   test('显示登录和注册 Tab', async ({ page }) => {
  12  |     // Tab buttons in the tab bar (not the form submit button)
  13  |     const tabBar = page.locator('div.flex.gap-1.bg-bg-hover')
  14  |     await expect(tabBar.getByRole('button', { name: '登录' })).toBeVisible()
  15  |     await expect(tabBar.getByRole('button', { name: '注册' })).toBeVisible()
  16  |   })
  17  | 
  18  |   test('默认显示登录表单', async ({ page }) => {
  19  |     await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible()
  20  |     await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
  21  |     await expect(page.getByPlaceholder('请再次输入密码')).not.toBeVisible()
  22  |   })
  23  | 
  24  |   test('点击注册 Tab 切换到注册表单', async ({ page }) => {
  25  |     await page.getByRole('button', { name: '注册' }).click()
  26  |     await expect(page.getByPlaceholder('请再次输入密码')).toBeVisible()
  27  |   })
  28  | 
  29  |   test('左侧品牌区显示 SparkLearn', async ({ page }) => {
  30  |     await expect(page.getByText('SparkLearn').first()).toBeVisible()
  31  |     await expect(page.getByText('AI 驱动的个性化学习平台')).toBeVisible()
  32  |   })
  33  | 
  34  |   test('点击登录按钮跳转到 onboarding', async ({ page }) => {
  35  |     await page.locator('form button[type="submit"]').click()
  36  |     await expect(page).toHaveURL(/onboarding/, { timeout: 10000 })
  37  |   })
  38  | 
  39  |   test('注册表单输入功能', async ({ page }) => {
> 40  |     await page.getByRole('button', { name: '注册' }).click()
      |                                                    ^ Error: locator.click: Test timeout of 45000ms exceeded.
  41  |     await page.getByPlaceholder('请输入邮箱').fill('new@example.com')
  42  |     await page.getByPlaceholder('请输入密码').fill('pass123')
  43  |     await page.getByPlaceholder('请再次输入密码').fill('pass123')
  44  |     await expect(page.getByPlaceholder('请再次输入密码')).toHaveValue('pass123')
  45  |   })
  46  | })
  47  | 
  48  | // ============================================================
  49  | // 2. Onboarding 页面 (/onboarding)
  50  | // ============================================================
  51  | test.describe('Onboarding 页面', () => {
  52  |   test.beforeEach(async ({ page }) => {
  53  |     await page.goto('/onboarding')
  54  |     await page.waitForTimeout(1500) // 等待打字动画
  55  |   })
  56  | 
  57  |   test('显示5个步骤标题', async ({ page }) => {
  58  |     await expect(page.getByText('学习目标').first()).toBeVisible()
  59  |     await expect(page.getByText('编程基础')).toBeVisible()
  60  |     await expect(page.getByText('薄弱环节')).toBeVisible()
  61  |     await expect(page.getByText('学习偏好')).toBeVisible()
  62  |     await expect(page.getByText('学习时间')).toBeVisible()
  63  |   })
  64  | 
  65  |   test('第一步显示4个目标选项', async ({ page }) => {
  66  |     await expect(page.getByText('掌握核心技能')).toBeVisible()
  67  |     await expect(page.getByText('项目实战能力')).toBeVisible()
  68  |     await expect(page.getByText('兴趣探索')).toBeVisible()
  69  |     await expect(page.getByText('准备找工作')).toBeVisible()
  70  |   })
  71  | 
  72  |   test('未选择时下一步按钮为 disabled', async ({ page }) => {
  73  |     await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled()
  74  |   })
  75  | 
  76  |   test('选择选项后下一步按钮为 enabled', async ({ page }) => {
  77  |     await page.getByRole('button', { name: /掌握核心技能/ }).click()
  78  |     await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled()
  79  |   })
  80  | 
  81  |   test('完成全流程到达摘要页', async ({ page }) => {
  82  |     // Step 1: 学习目标
  83  |     await page.getByRole('button', { name: /掌握核心技能/ }).click()
  84  |     await page.getByRole('button', { name: '下一步' }).click()
  85  |     await page.waitForTimeout(2000)
  86  | 
  87  |     // Step 2: 编程基础
  88  |     await page.getByRole('button', { name: /入门阶段/ }).click()
  89  |     await page.getByRole('button', { name: '下一步' }).click()
  90  |     await page.waitForTimeout(2000)
  91  | 
  92  |     // Step 3: 薄弱环节 (tags)
  93  |     await page.getByText('数据结构').click()
  94  |     await page.getByRole('button', { name: '下一步' }).click()
  95  |     await page.waitForTimeout(2000)
  96  | 
  97  |     // Step 4: 学习偏好
  98  |     await page.getByRole('button', { name: /动手实践/ }).click()
  99  |     await page.getByRole('button', { name: '下一步' }).click()
  100 |     await page.waitForTimeout(2000)
  101 | 
  102 |     // Step 5: 学习时间 (最后一步显示摘要 + "开始学习"按钮)
  103 |     // 注意：最后一步 canNext 默认 true，不需要选择
  104 |     // 但需要点击时间选项（如果有的话）
  105 |     const timeOption = page.getByRole('button', { name: '5-10小时' })
  106 |     if (await timeOption.isVisible()) {
  107 |       await timeOption.click()
  108 |     }
  109 |     await expect(page.getByRole('button', { name: '完成建档' })).toBeVisible()
  110 |   })
  111 | 
  112 |   test('点击开始学习跳转到首页', async ({ page }) => {
  113 |     // 快速走完流程
  114 |     await page.getByRole('button', { name: /掌握核心技能/ }).click()
  115 |     await page.getByRole('button', { name: '下一步' }).click()
  116 |     await page.waitForTimeout(2000)
  117 |     await page.getByRole('button', { name: /入门阶段/ }).click()
  118 |     await page.getByRole('button', { name: '下一步' }).click()
  119 |     await page.waitForTimeout(2000)
  120 |     await page.getByText('数据结构').click()
  121 |     await page.getByRole('button', { name: '下一步' }).click()
  122 |     await page.waitForTimeout(2000)
  123 |     await page.getByRole('button', { name: /动手实践/ }).click()
  124 |     await page.getByRole('button', { name: '下一步' }).click()
  125 |     await page.waitForTimeout(2000)
  126 | 
  127 |     await page.getByRole('button', { name: '5-10小时' }).click()
  128 |     await page.getByRole('button', { name: '完成建档' }).click()
  129 |     await expect(page).toHaveURL(/\//, { timeout: 10000 })
  130 |   })
  131 | 
  132 |   test('返回按钮从第2步可以回到第1步', async ({ page }) => {
  133 |     await page.getByRole('button', { name: /掌握核心技能/ }).click()
  134 |     await page.getByRole('button', { name: '下一步' }).click()
  135 |     await page.waitForTimeout(2000)
  136 | 
  137 |     const backBtn = page.getByRole('button', { name: '上一步' })
  138 |     await expect(backBtn).toBeEnabled()
  139 |     await backBtn.click()
  140 |     await expect(page.getByRole('button', { name: /掌握核心技能/ })).toBeVisible()
```