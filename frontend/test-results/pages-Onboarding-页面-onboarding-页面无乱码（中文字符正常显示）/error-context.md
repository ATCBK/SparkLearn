# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> Onboarding 页面 (/onboarding) >> 页面无乱码（中文字符正常显示）
- Location: test\pages.spec.ts:232:7

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
> 233 |     await expect(page.getByText('你的学习目标是什么？')).toBeVisible()
      |                                                ^ Error: expect(locator).toBeVisible() failed
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