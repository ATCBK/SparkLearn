# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> 练习与错题页 >> 显示3个 Tab
- Location: test\pages.spec.ts:300:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: '练习' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: '练习' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - img "SparkLearn Logo" [ref=e6]
        - generic [ref=e7]:
          - strong [ref=e8]: 学而思
          - generic [ref=e9]: SparkLearn
      - navigation [ref=e10]:
        - generic [ref=e11]:
          - generic [ref=e12]: 学习中心
          - link "学习工作台" [ref=e13] [cursor=pointer]:
            - /url: /
            - img [ref=e14]
            - generic [ref=e17]: 学习工作台
          - link "学习画像" [ref=e18] [cursor=pointer]:
            - /url: /profile
            - img [ref=e19]
            - generic [ref=e27]: 学习画像
          - link "个性化路径" [ref=e28] [cursor=pointer]:
            - /url: /path
            - img [ref=e29]
            - generic [ref=e33]: 个性化路径
        - generic [ref=e34]:
          - generic [ref=e35]: 资源与练习
          - link "资源中心" [ref=e36] [cursor=pointer]:
            - /url: /generate
            - img [ref=e37]
            - generic [ref=e40]: 资源中心
          - link "资源库" [ref=e41] [cursor=pointer]:
            - /url: /resources
            - img [ref=e42]
            - generic [ref=e44]: 资源库
          - link "练习评测" [ref=e45] [cursor=pointer]:
            - /url: /practice
            - img [ref=e46]
            - generic [ref=e51]: 练习评测
        - generic [ref=e52]:
          - generic [ref=e53]: 个人知识库
          - link "我的资料库" [ref=e54] [cursor=pointer]:
            - /url: /knowledge
            - img [ref=e55]
            - generic [ref=e59]: 我的资料库
        - generic [ref=e60]:
          - generic [ref=e61]: 分析与反馈
          - link "学习报表" [ref=e62] [cursor=pointer]:
            - /url: /report
            - img [ref=e63]
            - generic [ref=e65]: 学习报表
          - link "复习计划" [ref=e66] [cursor=pointer]:
            - /url: /loop
            - img [ref=e67]
            - generic [ref=e72]: 复习计划
        - generic [ref=e73]:
          - generic [ref=e74]: 工具
          - link "智能辅导" [ref=e75] [cursor=pointer]:
            - /url: /tutor
            - img [ref=e76]
            - generic [ref=e78]: 智能辅导
          - link "视频中心" [ref=e79] [cursor=pointer]:
            - /url: /video
            - img [ref=e80]
            - generic [ref=e82]: 视频中心
      - generic [ref=e83]:
        - generic [ref=e84]:
          - generic [ref=e85]: 今日状态
          - paragraph [ref=e86]: 优先补齐当前卡点，再推进下一阶段。
          - generic [ref=e87]:
            - generic [ref=e88]:
              - generic [ref=e89]: 薄弱点
              - strong [ref=e90]: 类与对象
            - generic [ref=e91]:
              - generic [ref=e92]: 今日建议
              - strong [ref=e93]: 60 分钟
            - generic [ref=e94]:
              - generic [ref=e95]: 当前路径
              - strong [ref=e96]: 函数与模块
        - link "个人信息" [ref=e97] [cursor=pointer]:
          - /url: /profile/settings
          - img [ref=e98]
          - generic [ref=e101]: 个人信息
        - button "收起侧栏" [ref=e102] [cursor=pointer]:
          - img [ref=e103]
          - generic [ref=e106]: 收起
    - banner [ref=e107]:
      - generic [ref=e108]: 资源与练习 / 练习评测
      - generic [ref=e109]:
        - generic [ref=e110]:
          - img [ref=e111]
          - generic [ref=e114]: 搜索资源、知识点、错题
        - button "通知" [ref=e115] [cursor=pointer]:
          - img [ref=e116]
        - generic [ref=e119]:
          - generic [ref=e120]: 张
          - generic [ref=e121]: 张同学
    - main [ref=e122]:
      - generic [ref=e124]:
        - generic [ref=e125]:
          - generic [ref=e126]:
            - generic [ref=e127]: 资源与练习 / 练习评测
            - heading "练习评测" [level=1] [ref=e128]
            - paragraph [ref=e129]: 提交后系统会判题、沉淀错题、更新掌握度，并触发补弱资源推荐。
          - generic [ref=e130]:
            - generic [ref=e131]:
              - generic [ref=e132]: 8题
              - generic [ref=e133]: 本组练习
            - generic [ref=e134]:
              - generic [ref=e135]: 0%
              - generic [ref=e136]: 当前进度
            - generic [ref=e137]:
              - generic [ref=e138]: 函数
              - generic [ref=e139]: 知识点
            - generic [ref=e140]:
              - link "错题本" [ref=e141] [cursor=pointer]:
                - /url: /practice/mistakes
              - link "收藏题目" [ref=e142] [cursor=pointer]:
                - /url: /practice/favorites
        - generic [ref=e143]:
          - generic [ref=e145]: 正在生成练习题...
          - generic [ref=e146]:
            - heading "答题导航" [level=2] [ref=e147]
            - generic [ref=e148]:
              - generic [ref=e149]:
                - img [ref=e150]
                - text: 选择答案后提交判题
              - generic [ref=e152]:
                - img [ref=e153]
                - text: 错题会进入错题本
              - generic [ref=e155]:
                - img [ref=e156]
                - text: 报告会汇总练习结果
            - link "生成补弱资源" [ref=e158] [cursor=pointer]:
              - /url: /generate
    - button "打开 AI 助手" [ref=e159] [cursor=pointer]:
      - img [ref=e160]
  - button "Open Next.js Dev Tools" [ref=e167] [cursor=pointer]:
    - img [ref=e168]
  - alert [ref=e171]
```

# Test source

```ts
  201 |       await expect(firstTask).toHaveClass(/bg-success/)
  202 |     }
  203 |   })
  204 | })
  205 | 
  206 | // ============================================================
  207 | // 4. 学习路径 (/path)
  208 | // ============================================================
  209 | test.describe('学习路径页', () => {
  210 |   test.beforeEach(async ({ page }) => {
  211 |     await page.goto('/path')
  212 |     await page.waitForTimeout(1500)
  213 |   })
  214 | 
  215 |   test('显示页面标题', async ({ page }) => {
  216 |     await expect(page.getByRole('heading', { name: '学习路径' })).toBeVisible()
  217 |   })
  218 | 
  219 |   test('显示学习阶段列表', async ({ page }) => {
  220 |     // "学习阶段" h3 和侧栏可能有类似文字，通过 Card 内 h3 精确匹配
  221 |     const stageHeading = page.locator('h3', { hasText: '学习阶段' })
  222 |     await expect(stageHeading).toBeVisible()
  223 |     await expect(page.locator('span:text("基础语法")').first()).toBeVisible()
  224 |   })
  225 | 
  226 |   test('显示当前阶段标记', async ({ page }) => {
  227 |     await expect(page.getByText('当前')).toBeVisible()
  228 |   })
  229 | 
  230 |   test('显示知识图谱', async ({ page }) => {
  231 |     await expect(page.getByText('知识图谱')).toBeVisible()
  232 |   })
  233 | 
  234 |   test('点击知识节点可以展开/折叠', async ({ page }) => {
  235 |     const node = page.locator('span.text-small:has-text("基础语法")').first()
  236 |     if (await node.isVisible()) {
  237 |       await node.click()
  238 |     }
  239 |   })
  240 | })
  241 | 
  242 | // ============================================================
  243 | // 5. 资源中心 (/resources)
  244 | // ============================================================
  245 | test.describe('资源中心页', () => {
  246 |   test.beforeEach(async ({ page }) => {
  247 |     await page.goto('/resources')
  248 |     await page.waitForTimeout(1500)
  249 |   })
  250 | 
  251 |   test('显示页面标题', async ({ page }) => {
  252 |     await expect(page.getByRole('heading', { name: '资源中心' })).toBeVisible()
  253 |   })
  254 | 
  255 |   test('显示搜索框', async ({ page }) => {
  256 |     await expect(page.getByPlaceholder('搜索学习资源...')).toBeVisible()
  257 |   })
  258 | 
  259 |   test('显示筛选标签', async ({ page }) => {
  260 |     await expect(page.getByText('全部')).toBeVisible()
  261 |   })
  262 | 
  263 |   test('显示资源列表', async ({ page }) => {
  264 |     // 表格应该有内容
  265 |     const tableRows = page.locator('table tbody tr')
  266 |     await expect(tableRows.first()).toBeVisible()
  267 |   })
  268 | 
  269 |   test('搜索功能过滤资源', async ({ page }) => {
  270 |     await page.getByPlaceholder('搜索学习资源...').fill('变量')
  271 |     await page.waitForTimeout(400) // debounce
  272 |     // 验证结果变化
  273 |     const rows = page.locator('table tbody tr')
  274 |     const count = await rows.count()
  275 |     expect(count).toBeGreaterThanOrEqual(0)
  276 |   })
  277 | 
  278 |   test('点击筛选标签过滤资源', async ({ page }) => {
  279 |     // 点击"全部"筛选
  280 |     const allBtn = page.locator('button:has-text("全部")')
  281 |     if (await allBtn.isVisible()) {
  282 |       await allBtn.click()
  283 |     }
  284 |   })
  285 | })
  286 | 
  287 | // ============================================================
  288 | // 6. 练习与错题 (/practice)
  289 | // ============================================================
  290 | test.describe('练习与错题页', () => {
  291 |   test.beforeEach(async ({ page }) => {
  292 |     await page.goto('/practice')
  293 |     await page.waitForTimeout(1500)
  294 |   })
  295 | 
  296 |   test('显示页面标题', async ({ page }) => {
  297 |     await expect(page.getByRole('heading', { name: '练习与错题' })).toBeVisible()
  298 |   })
  299 | 
  300 |   test('显示3个 Tab', async ({ page }) => {
> 301 |     await expect(page.getByRole('button', { name: '练习' })).toBeVisible()
      |                                                            ^ Error: expect(locator).toBeVisible() failed
  302 |     await expect(page.getByRole('button', { name: '错题本' })).toBeVisible()
  303 |     await expect(page.getByRole('button', { name: '收藏' })).toBeVisible()
  304 |   })
  305 | 
  306 |   test('默认显示练习 Tab', async ({ page }) => {
  307 |     const practiceTab = page.getByRole('button', { name: '练习' })
  308 |     await expect(practiceTab).toHaveClass(/bg-blue/)
  309 |   })
  310 | 
  311 |   test('显示题目内容', async ({ page }) => {
  312 |     await expect(page.getByText(/第 \d+ 题/)).toBeVisible()
  313 |   })
  314 | 
  315 |   test('选择题选项可以点击', async ({ page }) => {
  316 |     const options = page.locator('button.w-full.flex.items-center.gap-3')
  317 |     if (await options.first().isVisible()) {
  318 |       await options.first().click()
  319 |       // 选中后应该有蓝色边框
  320 |       await expect(options.first()).toHaveClass(/border-blue/)
  321 |     }
  322 |   })
  323 | 
  324 |   test('选择答案后可以提交', async ({ page }) => {
  325 |     const options = page.locator('button.w-full.flex.items-center.gap-3')
  326 |     if (await options.first().isVisible()) {
  327 |       await options.first().click()
  328 |       const submitBtn = page.getByRole('button', { name: '提交答案' })
  329 |       await expect(submitBtn).toBeEnabled()
  330 |     }
  331 |   })
  332 | 
  333 |   test('提交后显示正确/错误反馈', async ({ page }) => {
  334 |     const options = page.locator('button.w-full.flex.items-center.gap-3')
  335 |     if (await options.first().isVisible()) {
  336 |       await options.first().click()
  337 |       await page.getByRole('button', { name: '提交答案' }).click()
  338 |       // 应该显示反馈区域
  339 |       const feedback = page.locator('div.p-4.rounded-\\[12px\\]')
  340 |       await expect(feedback).toBeVisible()
  341 |     }
  342 |   })
  343 | 
  344 |   test('切换到错题本 Tab', async ({ page }) => {
  345 |     await page.getByRole('button', { name: '错题本' }).click()
  346 |     await expect(page.getByText('还没有错题记录')).toBeVisible()
  347 |   })
  348 | 
  349 |   test('切换到收藏 Tab', async ({ page }) => {
  350 |     await page.getByRole('button', { name: '收藏' }).click()
  351 |     await expect(page.getByText('还没有收藏的题目')).toBeVisible()
  352 |   })
  353 | 
  354 |   test('右侧显示正确率', async ({ page }) => {
  355 |     await expect(page.getByText('正确率')).toBeVisible()
  356 |   })
  357 | })
  358 | 
  359 | // ============================================================
  360 | // 7. 资源推送 (/feed)
  361 | // ============================================================
  362 | test.describe('资源推送页', () => {
  363 |   test.beforeEach(async ({ page }) => {
  364 |     await page.goto('/feed')
  365 |     await page.waitForTimeout(1500)
  366 |   })
  367 | 
  368 |   test('显示页面标题', async ({ page }) => {
  369 |     await expect(page.getByRole('heading', { name: '资源推送' })).toBeVisible()
  370 |   })
  371 | 
  372 |   test('显示 AI 推荐 Banner', async ({ page }) => {
  373 |     // Banner 特定文字：位于 Card 有渐变背景的蓝色卡片中
  374 |     await expect(page.getByText('基于你的学习画像，AI 为你精选以下资源')).toBeVisible()
  375 |   })
  376 | 
  377 |   test('显示推荐资源卡片', async ({ page }) => {
  378 |     const cards = page.locator('.grid.grid-cols-3 > div')
  379 |     const count = await cards.count()
  380 |     expect(count).toBeGreaterThan(0)
  381 |   })
  382 | 
  383 |   test('推荐卡片显示推荐理由', async ({ page }) => {
  384 |     // 每个推荐卡片应该有 reason 文字
  385 |     const reasons = page.locator('p.text-small.text-ink-secondary')
  386 |     const count = await reasons.count()
  387 |     expect(count).toBeGreaterThan(0)
  388 |   })
  389 | })
  390 | 
  391 | // ============================================================
  392 | // 8. 资源生成 (/generate)
  393 | // ============================================================
  394 | test.describe('资源生成页', () => {
  395 |   test.beforeEach(async ({ page }) => {
  396 |     await page.goto('/generate')
  397 |     await page.waitForTimeout(1500)
  398 |   })
  399 | 
  400 |   test('显示页面标题', async ({ page }) => {
  401 |     await expect(page.getByRole('heading', { name: '资源生成' })).toBeVisible()
```