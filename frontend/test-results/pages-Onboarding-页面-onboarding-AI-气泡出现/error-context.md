# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> Onboarding 页面 (/onboarding) >> AI 气泡出现
- Location: test\pages.spec.ts:120:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  getByText('你的学习目标是什么？')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('你的学习目标是什么？')
    9 × locator resolved to <p class="text-body text-ink">你的学习目标是什么？</p>
      - unexpected value "hidden"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e6]:
        - generic [ref=e7]: "1"
        - generic [ref=e8]: 学习目标
      - generic [ref=e11]:
        - generic [ref=e12]: "2"
        - generic [ref=e13]: 编程基础
      - generic [ref=e16]:
        - generic [ref=e17]: "3"
        - generic [ref=e18]: 薄弱环节
      - generic [ref=e21]:
        - generic [ref=e22]: "4"
        - generic [ref=e23]: 学习偏好
      - generic [ref=e26]:
        - generic [ref=e27]: "5"
        - generic [ref=e28]: 学习时间
    - generic [ref=e29]:
      - generic [ref=e30]:
        - generic [ref=e32]:
          - generic [ref=e34]: AI
          - generic [ref=e35]:
            - paragraph: 你的学习目标是什么？
        - generic [ref=e37]:
          - button "期末提分 高效备考冲刺" [ref=e38]:
            - img [ref=e40]
            - generic [ref=e42]: 期末提分
            - generic [ref=e43]: 高效备考冲刺
          - button "竞赛准备 算法竞赛训练" [ref=e44]:
            - img [ref=e46]
            - generic [ref=e48]: 竞赛准备
            - generic [ref=e49]: 算法竞赛训练
          - button "兴趣探索 发现编程乐趣" [ref=e50]:
            - img [ref=e52]
            - generic [ref=e54]: 兴趣探索
            - generic [ref=e55]: 发现编程乐趣
          - button "求职准备 面试刷题进阶" [ref=e56]:
            - img [ref=e58]
            - generic [ref=e61]: 求职准备
            - generic [ref=e62]: 面试刷题进阶
      - generic [ref=e63]:
        - button "上一步" [disabled] [ref=e64]:
          - img [ref=e65]
          - text: 上一步
        - button "下一步" [disabled] [ref=e67]:
          - text: 下一步
          - img [ref=e68]
  - button "Open Next.js Dev Tools" [ref=e75] [cursor=pointer]:
    - img [ref=e76]
  - alert [ref=e79]
```

# Test source

```ts
  21  |   test('点击"登录" Tab 切换回登录表单', async ({ page }) => {
  22  |     const tabArea = page.locator('div.flex.gap-1.bg-bg-hover')
  23  |     await tabArea.locator('button:text("注册")').click()
  24  |     await expect(page.getByPlaceholder('请再次输入密码')).toBeVisible()
  25  | 
  26  |     await tabArea.locator('button:text("登录")').click()
  27  |     await expect(page.getByPlaceholder('请再次输入密码')).not.toBeVisible()
  28  |     await expect(page.locator('form button[type="submit"]')).toContainText('登录')
  29  |   })
  30  | 
  31  |   test('登录表单有邮箱和密码输入框', async ({ page }) => {
  32  |     await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible()
  33  |     await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
  34  |     await expect(page.getByPlaceholder('请再次输入密码')).not.toBeVisible()
  35  |   })
  36  | 
  37  |   test('注册表单有邮箱、密码和确认密码输入框', async ({ page }) => {
  38  |     const tabArea = page.locator('div.flex.gap-1.bg-bg-hover')
  39  |     await tabArea.locator('button:text("注册")').click()
  40  |     await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible()
  41  |     await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
  42  |     await expect(page.getByPlaceholder('请再次输入密码')).toBeVisible()
  43  |   })
  44  | 
  45  |   test('点击登录按钮可以跳转到 onboarding', async ({ page }) => {
  46  |     await page.locator('form button[type="submit"]').click()
  47  |     await expect(page).toHaveURL(/onboarding/, { timeout: 10000 })
  48  |   })
  49  | 
  50  |   test('左侧品牌区显示 SparkLearn 和数据亮点', async ({ page }) => {
  51  |     await expect(page.getByText('SparkLearn').first()).toBeVisible()
  52  |     await expect(page.getByText('AI 驱动的个性化学习平台')).toBeVisible()
  53  |     await expect(page.getByText('10w+')).toBeVisible()
  54  |     await expect(page.getByText('95%')).toBeVisible()
  55  |     await expect(page.getByText('50+')).toBeVisible()
  56  |   })
  57  | 
  58  |   test('登录表单可以输入邮箱和密码', async ({ page }) => {
  59  |     await page.getByPlaceholder('请输入邮箱').fill('test@example.com')
  60  |     await page.getByPlaceholder('请输入密码').fill('password123')
  61  |     await expect(page.getByPlaceholder('请输入邮箱')).toHaveValue('test@example.com')
  62  |     await expect(page.getByPlaceholder('请输入密码')).toHaveValue('password123')
  63  |   })
  64  | 
  65  |   test('注册表单可以输入邮箱、密码和确认密码', async ({ page }) => {
  66  |     const tabArea = page.locator('div.flex.gap-1.bg-bg-hover')
  67  |     await tabArea.locator('button:text("注册")').click()
  68  |     await page.getByPlaceholder('请输入邮箱').fill('new@example.com')
  69  |     await page.getByPlaceholder('请输入密码').fill('pass123')
  70  |     await page.getByPlaceholder('请再次输入密码').fill('pass123')
  71  |     await expect(page.getByPlaceholder('请再次输入密码')).toHaveValue('pass123')
  72  |   })
  73  | 
  74  |   test('密码可见/隐藏切换按钮存在', async ({ page }) => {
  75  |     // Eye icon button should exist next to password field
  76  |     const passwordInput = page.getByPlaceholder('请输入密码')
  77  |     await expect(passwordInput).toBeVisible()
  78  |     // The eye toggle button should be present (the Eye/EyeOff icon)
  79  |     const eyeBtn = page.locator('button:has(svg)').filter({ has: page.locator('svg') }).nth(1)
  80  |     await expect(eyeBtn).toBeVisible()
  81  |   })
  82  | 
  83  |   test('记住我复选框存在', async ({ page }) => {
  84  |     await expect(page.getByText('记住我')).toBeVisible()
  85  |   })
  86  | 
  87  |   test('忘记密码链接存在', async ({ page }) => {
  88  |     await expect(page.getByText('忘记密码？')).toBeVisible()
  89  |   })
  90  | 
  91  |   test('截图 - 登录页面', async ({ page }) => {
  92  |     await page.screenshot({ path: 'screenshots/auth-login.png', fullPage: true })
  93  |   })
  94  | 
  95  |   test('截图 - 注册页面', async ({ page }) => {
  96  |     const tabArea = page.locator('div.flex.gap-1.bg-bg-hover')
  97  |     await tabArea.locator('button:text("注册")').click()
  98  |     await page.screenshot({ path: 'screenshots/auth-register.png', fullPage: true })
  99  |   })
  100 | })
  101 | 
  102 | test.describe('Onboarding 页面 (/onboarding)', () => {
  103 |   test.beforeEach(async ({ page }) => {
  104 |     await page.goto('/onboarding')
  105 |     await page.waitForTimeout(1500)
  106 |   })
  107 | 
  108 |   test('页面加载后显示步骤指示器（5个步骤标题）', async ({ page }) => {
  109 |     await expect(page.getByText('学习目标').first()).toBeVisible()
  110 |     await expect(page.getByText('编程基础')).toBeVisible()
  111 |     await expect(page.getByText('薄弱环节')).toBeVisible()
  112 |     await expect(page.getByText('学习偏好')).toBeVisible()
  113 |     await expect(page.getByText('学习时间')).toBeVisible()
  114 |   })
  115 | 
  116 |   test('第一步显示"学习目标"标题', async ({ page }) => {
  117 |     await expect(page.getByText('你的学习目标是什么？')).toBeVisible()
  118 |   })
  119 | 
  120 |   test('AI 气泡出现', async ({ page }) => {
> 121 |     await expect(page.getByText('你的学习目标是什么？')).toBeVisible()
      |                                                ^ Error: expect(locator).toBeVisible() failed
  122 |   })
  123 | 
  124 |   test('第一步显示4个卡片选项', async ({ page }) => {
  125 |     await expect(page.getByText('期末提分')).toBeVisible()
  126 |     await expect(page.getByText('竞赛准备')).toBeVisible()
  127 |     await expect(page.getByText('兴趣探索')).toBeVisible()
  128 |     await expect(page.getByText('求职准备')).toBeVisible()
  129 |   })
  130 | 
  131 |   test('点击卡片选项后可以选中（高亮）', async ({ page }) => {
  132 |     const card = page.getByText('期末提分').locator('..')
  133 |     await card.click()
  134 |     // 选中后应有 border-blue 类
  135 |     const cardBtn = page.locator('button:has-text("期末提分")')
  136 |     await expect(cardBtn).toHaveClass(/border-blue/)
  137 |   })
  138 | 
  139 |   test('第一步未选择时"下一步"按钮为 disabled', async ({ page }) => {
  140 |     const nextBtn = page.getByRole('button', { name: '下一步' })
  141 |     await expect(nextBtn).toBeVisible()
  142 |     await expect(nextBtn).toBeDisabled()
  143 |   })
  144 | 
  145 |   test('第一步"上一步"按钮为 disabled', async ({ page }) => {
  146 |     const backBtn = page.getByRole('button', { name: '上一步' })
  147 |     await expect(backBtn).toBeVisible()
  148 |     await expect(backBtn).toBeDisabled()
  149 |   })
  150 | 
  151 |   test('选择选项后点击"下一步"进入第二步', async ({ page }) => {
  152 |     await page.getByText('期末提分').click()
  153 |     await page.getByRole('button', { name: '下一步' }).click()
  154 |     await page.waitForTimeout(1500)
  155 |     await expect(page.getByText('你的编程基础如何？')).toBeVisible()
  156 |   })
  157 | 
  158 |   test('第二步显示编程基础选项', async ({ page }) => {
  159 |     await page.getByText('期末提分').click()
  160 |     await page.getByRole('button', { name: '下一步' }).click()
  161 |     await page.waitForTimeout(1500)
  162 |     await expect(page.getByText('零基础')).toBeVisible()
  163 |     await expect(page.getByText('有一些基础')).toBeVisible()
  164 |     await expect(page.getByText('基础较好')).toBeVisible()
  165 |     await expect(page.getByText('有编程经验')).toBeVisible()
  166 |   })
  167 | 
  168 |   test('返回按钮在第二步可用且可以回到第一步', async ({ page }) => {
  169 |     await page.getByText('期末提分').click()
  170 |     await page.getByRole('button', { name: '下一步' }).click()
  171 |     await page.waitForTimeout(1500)
  172 |     const backBtn = page.getByRole('button', { name: '上一步' })
  173 |     await expect(backBtn).toBeEnabled()
  174 |     await backBtn.click()
  175 |     await expect(page.getByText('你的学习目标是什么？')).toBeVisible()
  176 |   })
  177 | 
  178 |   test('第三步显示标签云（薄弱环节）', async ({ page }) => {
  179 |     await page.getByText('期末提分').click()
  180 |     await page.getByRole('button', { name: '下一步' }).click()
  181 |     await page.waitForTimeout(1500)
  182 |     await page.getByText('有一些基础').click()
  183 |     await page.getByRole('button', { name: '下一步' }).click()
  184 |     await page.waitForTimeout(1500)
  185 |     await expect(page.getByText('选择需要加强的方向（可多选）')).toBeVisible()
  186 |     await expect(page.getByText('数据结构')).toBeVisible()
  187 |     await expect(page.getByText('算法设计')).toBeVisible()
  188 |     await expect(page.getByText('调试能力')).toBeVisible()
  189 |   })
  190 | 
  191 |   test('步骤指示器在前进后更新状态', async ({ page }) => {
  192 |     // 选中并前进到第二步
  193 |     await page.getByText('期末提分').click()
  194 |     await page.getByRole('button', { name: '下一步' }).click()
  195 |     await page.waitForTimeout(1500)
  196 |     // 第一步应该变绿（完成）
  197 |     await expect(page.getByText('学习目标').first()).toHaveClass(/text-success/)
  198 |   })
  199 | 
  200 |   test('完整流程：从第1步到最后一步摘要', async ({ page }) => {
  201 |     // Step 1
  202 |     await page.getByText('期末提分').click()
  203 |     await page.getByRole('button', { name: '下一步' }).click()
  204 |     await page.waitForTimeout(1500)
  205 | 
  206 |     // Step 2
  207 |     await page.getByText('有一些基础').click()
  208 |     await page.getByRole('button', { name: '下一步' }).click()
  209 |     await page.waitForTimeout(1500)
  210 | 
  211 |     // Step 3
  212 |     await page.getByText('数据结构').click()
  213 |     await page.getByRole('button', { name: '下一步' }).click()
  214 |     await page.waitForTimeout(1505)
  215 | 
  216 |     // Step 4
  217 |     await page.getByText('实践型').click()
  218 |     await page.getByRole('button', { name: '下一步' }).click()
  219 |     await page.waitForTimeout(1500)
  220 | 
  221 |     // Step 5 - 学习时间
```