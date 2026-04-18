# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> Onboarding 页面 (/onboarding) >> 选择选项后点击"下一步"进入第二步
- Location: test\pages.spec.ts:151:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  getByText('你的编程基础如何？')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('你的编程基础如何？')
    9 × locator resolved to <p class="text-body text-ink">你的编程基础如何？</p>
      - unexpected value "hidden"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e6]:
        - img [ref=e8]
        - generic [ref=e11]: 学习目标
      - generic [ref=e14]:
        - generic [ref=e15]: "2"
        - generic [ref=e16]: 编程基础
      - generic [ref=e19]:
        - generic [ref=e20]: "3"
        - generic [ref=e21]: 薄弱环节
      - generic [ref=e24]:
        - generic [ref=e25]: "4"
        - generic [ref=e26]: 学习偏好
      - generic [ref=e29]:
        - generic [ref=e30]: "5"
        - generic [ref=e31]: 学习时间
    - generic [ref=e32]:
      - generic [ref=e33]:
        - generic [ref=e35]:
          - generic [ref=e37]: AI
          - generic [ref=e38]:
            - paragraph: 你的编程基础如何？
        - generic [ref=e40]:
          - button "零基础 从未接触编程" [ref=e41]:
            - img [ref=e43]
            - generic [ref=e45]: 零基础
            - generic [ref=e46]: 从未接触编程
          - button "有一些基础 了解基本概念" [ref=e47]:
            - img [ref=e49]
            - generic [ref=e52]: 有一些基础
            - generic [ref=e53]: 了解基本概念
          - button "基础较好 能独立写项目" [ref=e54]:
            - img [ref=e56]
            - generic [ref=e59]: 基础较好
            - generic [ref=e60]: 能独立写项目
          - button "有编程经验 熟练掌握语言" [ref=e61]:
            - img [ref=e63]
            - generic [ref=e66]: 有编程经验
            - generic [ref=e67]: 熟练掌握语言
      - generic [ref=e68]:
        - button "上一步" [ref=e69]:
          - img [ref=e70]
          - text: 上一步
        - button "下一步" [disabled] [ref=e72]:
          - text: 下一步
          - img [ref=e73]
  - button "Open Next.js Dev Tools" [ref=e80] [cursor=pointer]:
    - img [ref=e81]
  - alert [ref=e84]
```

# Test source

```ts
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
  121 |     await expect(page.getByText('你的学习目标是什么？')).toBeVisible()
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
> 155 |     await expect(page.getByText('你的编程基础如何？')).toBeVisible()
      |                                               ^ Error: expect(locator).toBeVisible() failed
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
  222 |     await expect(page.getByText('每天能投入多少时间学习？')).toBeVisible()
  223 |     await page.getByText('1–2 小时').click()
  224 |     await page.getByRole('button', { name: '下一步' }).click()
  225 |     await page.waitForTimeout(1500)
  226 | 
  227 |     // Summary
  228 |     await expect(page.getByText('以下是为你构建的学习画像：')).toBeVisible()
  229 |     await expect(page.getByRole('button', { name: '开始学习' })).toBeVisible()
  230 |   })
  231 | 
  232 |   test('页面无乱码（中文字符正常显示）', async ({ page }) => {
  233 |     await expect(page.getByText('你的学习目标是什么？')).toBeVisible()
  234 |     await expect(page.getByRole('button', { name: '下一步' })).toBeVisible()
  235 |     await expect(page.getByRole('button', { name: '上一步' })).toBeVisible()
  236 |     await expect(page.getByText('AI').first()).toBeVisible()
  237 |   })
  238 | 
  239 |   test('截图 - 第一步', async ({ page }) => {
  240 |     await page.screenshot({ path: 'screenshots/onboarding-step1.png', fullPage: true })
  241 |   })
  242 | 
  243 |   test('截图 - 第三步标签云', async ({ page }) => {
  244 |     await page.getByText('期末提分').click()
  245 |     await page.getByRole('button', { name: '下一步' }).click()
  246 |     await page.waitForTimeout(1500)
  247 |     await page.getByText('有一些基础').click()
  248 |     await page.getByRole('button', { name: '下一步' }).click()
  249 |     await page.waitForTimeout(1500)
  250 |     await page.screenshot({ path: 'screenshots/onboarding-step3.png', fullPage: true })
  251 |   })
  252 | })
  253 | 
```