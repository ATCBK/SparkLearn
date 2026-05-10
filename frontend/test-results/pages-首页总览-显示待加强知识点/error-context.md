# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> 首页总览 >> 显示待加强知识点
- Location: test\pages.spec.ts:191:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('待加强知识点')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('待加强知识点')

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
      - generic [ref=e108]: 学习中心 / 学习工作台
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
            - generic [ref=e127]: 学习中心 / 资源回顾与新推荐
            - heading "今日学习工作台" [level=1] [ref=e128]
            - paragraph [ref=e129]: 系统已结合画像、路径和错题，把今天最应该完成的学习动作排在前面。
          - generic [ref=e130]:
            - generic [ref=e131]:
              - generic [ref=e132]: 60分钟
              - generic [ref=e133]: 建议投入
            - generic [ref=e134]:
              - generic [ref=e135]: 3项
              - generic [ref=e136]: 待完成
            - generic [ref=e137]:
              - generic [ref=e138]: 12天
              - generic [ref=e139]: 连续学习
        - generic [ref=e141]:
          - generic [ref=e142]: 优先薄弱点
          - generic [ref=e143]:
            - heading "先补「类与对象」，再推进下一段路径" [level=2] [ref=e144]
            - paragraph [ref=e145]: 当前稳定度 30%。建议先回顾一个短资源，再做 8 道达标题，预计 24 分钟。
          - generic [ref=e146]:
            - generic [ref=e147]: 来自错题回流
            - generic [ref=e148]: 关联当前路径
            - generic [ref=e149]: 适合案例驱动
            - generic [ref=e150]: 完成后可进入下一节点
          - generic [ref=e151]:
            - link "开始回顾资源" [ref=e152] [cursor=pointer]:
              - /url: /resources
            - link "先做练习" [ref=e153] [cursor=pointer]:
              - /url: /practice
            - link "根据卡点生成" [ref=e154] [cursor=pointer]:
              - /url: /generate
        - generic [ref=e156]:
          - generic [ref=e157]:
            - generic [ref=e158]: 30%
            - generic [ref=e159]: 当前薄弱点稳定度
          - generic [ref=e160]:
            - generic [ref=e161]: 8题
            - generic [ref=e162]: 建议达标题数量
          - generic [ref=e163]:
            - generic [ref=e164]: 12天
            - generic [ref=e165]: 连续学习
          - generic [ref=e166]:
            - generic [ref=e167]: 1步
            - generic [ref=e168]: 到下一路径节点
        - generic [ref=e169]:
          - generic [ref=e170]:
            - generic [ref=e171]:
              - heading "资源回顾推送" [level=2] [ref=e172]
              - link "进入资源库" [ref=e173] [cursor=pointer]:
                - /url: /resources
                - text: 进入资源库
                - img [ref=e174]
            - generic [ref=e176]:
              - link "函数类的教学文档 讲义 · 学习进度 100% 回顾" [ref=e177] [cursor=pointer]:
                - /url: /resources
                - generic [ref=e178]:
                  - generic [ref=e179]: 函数类的教学文档
                  - generic [ref=e180]: 讲义 · 学习进度 100%
                - generic [ref=e181]: 回顾
              - link "帮我生成一个讲解Python类的课程文档 讲义 · 学习进度 100% 回顾" [ref=e182] [cursor=pointer]:
                - /url: /resources
                - generic [ref=e183]:
                  - generic [ref=e184]: 帮我生成一个讲解Python类的课程文档
                  - generic [ref=e185]: 讲义 · 学习进度 100%
                - generic [ref=e186]: 回顾
              - link "生成讲解Python类的课程文档 讲义 · 学习进度 100% 回顾" [ref=e187] [cursor=pointer]:
                - /url: /resources
                - generic [ref=e188]:
                  - generic [ref=e189]: 生成讲解Python类的课程文档
                  - generic [ref=e190]: 讲义 · 学习进度 100%
                - generic [ref=e191]: 回顾
          - generic [ref=e192]:
            - generic [ref=e193]:
              - heading "今日新资源推荐" [level=2] [ref=e194]
              - link "根据卡点生成" [ref=e195] [cursor=pointer]:
                - /url: /generate
                - text: 根据卡点生成
                - img [ref=e196]
            - generic [ref=e198]:
              - link "函数类的教学文档 因为你当前基础较弱，建议先从这份资源开始补强。 推荐" [ref=e199] [cursor=pointer]:
                - /url: /resources
                - generic [ref=e200]:
                  - generic [ref=e201]: 函数类的教学文档
                  - generic [ref=e202]: 因为你当前基础较弱，建议先从这份资源开始补强。
                - generic [ref=e203]: 推荐
              - link "帮我生成一个讲解Python类的课程文档 基于你当前学习阶段，这份资源是更合适的下一步。 推荐" [ref=e204] [cursor=pointer]:
                - /url: /resources
                - generic [ref=e205]:
                  - generic [ref=e206]: 帮我生成一个讲解Python类的课程文档
                  - generic [ref=e207]: 基于你当前学习阶段，这份资源是更合适的下一步。
                - generic [ref=e208]: 推荐
              - link "生成讲解Python类的课程文档 今日复习建议：用这份资源做一次巩固练习。 推荐" [ref=e209] [cursor=pointer]:
                - /url: /resources
                - generic [ref=e210]:
                  - generic [ref=e211]: 生成讲解Python类的课程文档
                  - generic [ref=e212]: 今日复习建议：用这份资源做一次巩固练习。
                - generic [ref=e213]: 推荐
        - generic [ref=e214]:
          - generic [ref=e215]:
            - img [ref=e217]
            - generic [ref=e220]:
              - generic [ref=e221]: 变量与数据类型复盘
              - generic [ref=e222]: 25 分钟 · 等待开始
          - generic [ref=e223]:
            - img [ref=e225]
            - generic [ref=e228]:
              - generic [ref=e229]: 函数定义与调用练习
              - generic [ref=e230]: 15 分钟 · 等待开始
          - generic [ref=e231]:
            - img [ref=e233]
            - generic [ref=e236]:
              - generic [ref=e237]: 条件循环专题阅读
              - generic [ref=e238]: 20 分钟 · 等待开始
    - button "打开 AI 助手" [ref=e239] [cursor=pointer]:
      - img [ref=e240]
  - button "Open Next.js Dev Tools" [ref=e247] [cursor=pointer]:
    - img [ref=e248]
  - alert [ref=e251]
```

# Test source

```ts
  92  |     // Step 3: 薄弱环节 (tags)
  93  |     await page.getByText('数据结构').click()
  94  |     await page.getByRole('button', { name: '下一步' }).click()
  95  |     await page.waitForTimeout(2000)
  96  | 
  97  |     // Step 4: 学习偏好
  98  |     await page.getByText('实践型').click()
  99  |     await page.getByRole('button', { name: '下一步' }).click()
  100 |     await page.waitForTimeout(2000)
  101 | 
  102 |     // Step 5: 学习时间 (最后一步显示摘要 + "开始学习"按钮)
  103 |     // 注意：最后一步 canNext 默认 true，不需要选择
  104 |     // 但需要点击时间选项（如果有的话）
  105 |     const timeOption = page.getByText('1-2小时')
  106 |     if (await timeOption.isVisible()) {
  107 |       await timeOption.click()
  108 |     }
  109 |     // 最后一步按钮是"开始学习"
  110 |     await expect(page.getByRole('button', { name: '开始学习' })).toBeVisible()
  111 |   })
  112 | 
  113 |   test('点击开始学习跳转到首页', async ({ page }) => {
  114 |     // 快速走完流程
  115 |     await page.getByText('期末提分').click()
  116 |     await page.getByRole('button', { name: '下一步' }).click()
  117 |     await page.waitForTimeout(2000)
  118 |     await page.getByText('有一些基础').click()
  119 |     await page.getByRole('button', { name: '下一步' }).click()
  120 |     await page.waitForTimeout(2000)
  121 |     await page.getByText('数据结构').click()
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
> 192 |     await expect(page.getByText('待加强知识点')).toBeVisible()
      |                                            ^ Error: expect(locator).toBeVisible() failed
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
```