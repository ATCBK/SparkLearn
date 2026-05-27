# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> 学习路径页 >> 显示学习阶段列表
- Location: test\pages.spec.ts:219:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h3').filter({ hasText: '学习阶段' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('h3').filter({ hasText: '学习阶段' })

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
      - generic [ref=e108]: 学习中心 / 个性化路径
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
            - generic [ref=e127]: 学习中心 / 个性化路径
            - heading "学习路径" [level=1] [ref=e128]
            - paragraph [ref=e129]: 路径会根据画像、掌握度和练习结果动态调整。当前优先补弱，再推进目标节点。
          - generic [ref=e130]:
            - generic [ref=e131]:
              - generic [ref=e132]: 10%
              - generic [ref=e133]: 整体进度
            - generic [ref=e134]:
              - generic [ref=e135]: 函数定义与调用
              - generic [ref=e136]: 当前节点
            - generic [ref=e137]:
              - generic [ref=e138]: 21个
              - generic [ref=e139]: 知识节点
        - generic [ref=e141]:
          - generic [ref=e142]:
            - generic [ref=e143]:
              - generic [ref=e144]: 路径目标
              - generic [ref=e145]: 输入目标后，系统会重排建议顺序
            - textbox [ref=e146]: 完成 Python 函数与模块专项提升
          - generic [ref=e148]:
            - generic [ref=e149]: 10%
            - generic [ref=e150]: 路径进度
        - generic [ref=e151]:
          - generic [ref=e152]:
            - generic [ref=e153]:
              - heading "三分支学习导航" [level=2] [ref=e154]:
                - img [ref=e155]
                - text: 三分支学习导航
              - generic [ref=e159]: 练习结果会回流
            - generic [ref=e160]:
              - generic [ref=e161]:
                - generic [ref=e162]: 补弱路径
                - generic [ref=e163]:
                  - button "条件分支 if-elif-else 基础语法 · 0%" [ref=e164] [cursor=pointer]:
                    - generic [ref=e165]: 条件分支 if-elif-else
                    - generic [ref=e166]: 基础语法 · 0%
                  - button "循环与控制语句 基础语法 · 0%" [ref=e169] [cursor=pointer]:
                    - generic [ref=e170]: 循环与控制语句
                    - generic [ref=e171]: 基础语法 · 0%
                  - button "列表与字典基础 基础语法 · 0%" [ref=e174] [cursor=pointer]:
                    - generic [ref=e175]: 列表与字典基础
                    - generic [ref=e176]: 基础语法 · 0%
                  - button "模块与包管理 函数与模块 · 0%" [ref=e179] [cursor=pointer]:
                    - generic [ref=e180]: 模块与包管理
                    - generic [ref=e181]: 函数与模块 · 0%
              - generic [ref=e184]:
                - generic [ref=e185]: 达标路径
                - generic [ref=e186]:
                  - button "变量与数据类型 基础语法 · 92%" [ref=e187] [cursor=pointer]:
                    - generic [ref=e188]: 变量与数据类型
                    - generic [ref=e189]: 基础语法 · 92%
                  - button "表达式与运算符 基础语法 · 100%" [ref=e193] [cursor=pointer]:
                    - generic [ref=e194]: 表达式与运算符
                    - generic [ref=e195]: 基础语法 · 100%
                  - button "函数定义与调用 函数与模块 · 75%" [ref=e199] [cursor=pointer]:
                    - generic [ref=e200]: 函数定义与调用
                    - generic [ref=e201]: 函数与模块 · 75%
                  - button "作用域与闭包 函数与模块 · 67%" [ref=e205] [cursor=pointer]:
                    - generic [ref=e206]: 作用域与闭包
                    - generic [ref=e207]: 函数与模块 · 67%
              - generic [ref=e211]:
                - generic [ref=e212]: 目标路径
                - generic [ref=e213]:
                  - button "装饰器 高级特性 · 0%" [ref=e214] [cursor=pointer]:
                    - generic [ref=e215]: 装饰器
                    - generic [ref=e216]: 高级特性 · 0%
                  - button "生成器与迭代器 高级特性 · 0%" [ref=e219] [cursor=pointer]:
                    - generic [ref=e220]: 生成器与迭代器
                    - generic [ref=e221]: 高级特性 · 0%
                  - button "列表推导式与函数式工具 高级特性 · 0%" [ref=e224] [cursor=pointer]:
                    - generic [ref=e225]: 列表推导式与函数式工具
                    - generic [ref=e226]: 高级特性 · 0%
                  - button "异步编程入门 高级特性 · 0%" [ref=e229] [cursor=pointer]:
                    - generic [ref=e230]: 异步编程入门
                    - generic [ref=e231]: 高级特性 · 0%
          - generic [ref=e234]:
            - generic [ref=e235]: 当前建议
            - heading "函数定义与调用" [level=2] [ref=e236]
            - paragraph [ref=e237]: 建议深入学习函数的参数传递规则，理解并实践如何通过参数传递来优化代码。同时，尝试将函数拆分策略应用到实际项目中，以加深对面向对象编程的理解。
            - generic [ref=e239]:
              - generic [ref=e240]: 掌握度
              - generic [ref=e241]: 75%
            - generic [ref=e244]:
              - generic [ref=e245]:
                - generic [ref=e246]: 学习参数传递规则
                - img [ref=e247]
              - generic [ref=e249]:
                - generic [ref=e250]: 参与项目实践
                - img [ref=e251]
              - generic [ref=e253]:
                - generic [ref=e254]: 阅读关于函数拆分策略的文章或教程
                - img [ref=e255]
            - generic [ref=e257]:
              - link "看资源" [ref=e258] [cursor=pointer]:
                - /url: /resources
              - link "生成资源" [ref=e259] [cursor=pointer]:
                - /url: /generate
              - link "做练习" [ref=e260] [cursor=pointer]:
                - /url: /practice
              - button "问 AI" [ref=e261] [cursor=pointer]:
                - img [ref=e262]
                - text: 问 AI
        - generic [ref=e265]:
          - generic [ref=e266]:
            - generic [ref=e267]:
              - img [ref=e268]
              - generic [ref=e272]: 函数类的教学文档
            - paragraph [ref=e273]: 因为你当前基础较弱，建议先从这份资源开始补强。
          - generic [ref=e274]:
            - generic [ref=e275]:
              - img [ref=e276]
              - generic [ref=e280]: 帮我生成一个讲解Python类的课程文档
            - paragraph [ref=e281]: 基于你当前学习阶段，这份资源是更合适的下一步。
          - generic [ref=e282]:
            - generic [ref=e283]:
              - img [ref=e284]
              - generic [ref=e288]: 生成讲解Python类的课程文档
            - paragraph [ref=e289]: 今日复习建议：用这份资源做一次巩固练习。
    - button "打开 AI 助手" [ref=e290] [cursor=pointer]:
      - img [ref=e291]
  - button "Open Next.js Dev Tools" [ref=e298] [cursor=pointer]:
    - img [ref=e299]
  - alert [ref=e302]
```

# Test source

```ts
  122 |     await page.getByRole('button', { name: '下一步' }).click()
  123 |     await page.waitForTimeout(2000)
  124 |     await page.getByText('实践型').click()
  125 |     await page.getByRole('button', { name: '下一步' }).click()
  126 |     await page.waitForTimeout(2000)
  127 | 
  128 |     // 最后一步直接点击开始学习
  129 |     await page.getByRole('button', { name: '开始学习' }).click()
  130 |     await expect(page).toHaveURL(/\//, { timeout: 10000 })
  131 |   })
  132 | 
  133 |   test('返回按钮从第2步可以回到第1步', async ({ page }) => {
  134 |     await page.getByText('期末提分').click()
  135 |     await page.getByRole('button', { name: '下一步' }).click()
  136 |     await page.waitForTimeout(2000)
  137 | 
  138 |     const backBtn = page.getByRole('button', { name: '上一步' })
  139 |     await expect(backBtn).toBeEnabled()
  140 |     await backBtn.click()
  141 |     await expect(page.getByText('期末提分')).toBeVisible()
  142 |   })
  143 | })
  144 | 
  145 | // ============================================================
  146 | // 3. Homepage (/)
  147 | // ============================================================
  148 | test.describe('首页总览', () => {
  149 |   test.beforeEach(async ({ page }) => {
  150 |     await page.goto('/')
  151 |     // 等待数据加载
  152 |     await page.waitForTimeout(1500)
  153 |   })
  154 | 
  155 |   test('显示欢迎标题', async ({ page }) => {
  156 |     await expect(page.getByText('继续你的').first()).toBeVisible()
  157 |     await expect(page.getByText('学习之旅')).toBeVisible()
  158 |   })
  159 | 
  160 |   test('显示连续学习 Badge', async ({ page }) => {
  161 |     await expect(page.getByText(/连续学习/)).toBeVisible()
  162 |   })
  163 | 
  164 |   test('显示精选课程卡片', async ({ page }) => {
  165 |     await expect(page.getByText('Python 程序设计')).toBeVisible()
  166 |   })
  167 | 
  168 |   test('显示4个统计卡片', async ({ page }) => {
  169 |     await expect(page.getByText('学习时长')).toBeVisible()
  170 |     await expect(page.getByText('任务完成率')).toBeVisible()
  171 |     await expect(page.getByText('正确率')).toBeVisible()
  172 |     await expect(page.getByText('连续天数')).toBeVisible()
  173 |   })
  174 | 
  175 |   test('显示今日任务列表', async ({ page }) => {
  176 |     await expect(page.getByText('今日任务')).toBeVisible()
  177 |   })
  178 | 
  179 |   test('显示学习打卡热力图', async ({ page }) => {
  180 |     await expect(page.getByText('学习打卡')).toBeVisible()
  181 |   })
  182 | 
  183 |   test('显示学习画像卡片', async ({ page }) => {
  184 |     await expect(page.getByText('学习画像')).toBeVisible()
  185 |   })
  186 | 
  187 |   test('显示最近学习列表', async ({ page }) => {
  188 |     await expect(page.getByText('最近学习')).toBeVisible()
  189 |   })
  190 | 
  191 |   test('显示待加强知识点', async ({ page }) => {
  192 |     await expect(page.getByText('待加强知识点')).toBeVisible()
  193 |   })
  194 | 
  195 |   test('点击任务圆圈可以切换完成状态', async ({ page }) => {
  196 |     const taskButtons = page.locator('button.w-5.h-5.rounded-full')
  197 |     const firstTask = taskButtons.first()
  198 |     if (await firstTask.isVisible()) {
  199 |       await firstTask.click()
  200 |       // 点击后应该变成完成状态（绿色背景）
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
> 222 |     await expect(stageHeading).toBeVisible()
      |                                ^ Error: expect(locator).toBeVisible() failed
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
  301 |     await expect(page.getByRole('button', { name: '练习' })).toBeVisible()
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
```