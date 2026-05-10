# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> 资源中心页 >> 显示筛选标签
- Location: test\pages.spec.ts:259:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  getByText('全部')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('全部')
    9 × locator resolved to <option selected>全部</option>
      - unexpected value "hidden"

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
      - generic [ref=e108]: 资源与练习 / 资源库
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
            - generic [ref=e127]: 资源与练习 / 资源库
            - heading "资源库" [level=1] [ref=e128]
            - paragraph [ref=e129]: 所有生成和推荐过的资源都会沉淀在这里，学习进度会影响后续练习与报告。
          - generic [ref=e130]:
            - generic [ref=e131]:
              - generic [ref=e132]: "15"
              - generic [ref=e133]: 已保存资源
            - generic [ref=e134]:
              - generic [ref=e135]: "15"
              - generic [ref=e136]: 可学习
            - generic [ref=e137]:
              - generic [ref=e138]: "1"
              - generic [ref=e139]: PPT
        - generic [ref=e140]:
          - generic [ref=e141]:
            - generic [ref=e142]:
              - generic [ref=e143]:
                - img [ref=e144]
                - textbox "搜索资源或知识点" [ref=e147]
              - combobox [ref=e148]:
                - option "全部" [selected]
                - option "document"
                - option "ppt"
                - option "mindmap"
                - option "quiz"
                - option "reading"
                - option "code"
                - option "video"
            - generic [ref=e149]:
              - button "函数类的教学文档 completed 讲义 · 关联薄弱点：函数返回值" [ref=e150] [cursor=pointer]:
                - generic [ref=e151]:
                  - generic [ref=e152]: 函数类的教学文档
                  - generic [ref=e153]: completed
                - generic [ref=e154]: 讲义 · 关联薄弱点：函数返回值
              - button "帮我生成一个讲解Python类的课程文档 completed 讲义 · 关联薄弱点：函数返回值" [ref=e155] [cursor=pointer]:
                - generic [ref=e156]:
                  - generic [ref=e157]: 帮我生成一个讲解Python类的课程文档
                  - generic [ref=e158]: completed
                - generic [ref=e159]: 讲义 · 关联薄弱点：函数返回值
              - button "生成讲解Python类的课程文档 completed 讲义 · 关联薄弱点：函数返回值" [ref=e160] [cursor=pointer]:
                - generic [ref=e161]:
                  - generic [ref=e162]: 生成讲解Python类的课程文档
                  - generic [ref=e163]: completed
                - generic [ref=e164]: 讲义 · 关联薄弱点：函数返回值
              - button "生成函数的课程文档 completed 讲义 · 关联薄弱点：函数返回值" [ref=e165] [cursor=pointer]:
                - generic [ref=e166]:
                  - generic [ref=e167]: 生成函数的课程文档
                  - generic [ref=e168]: completed
                - generic [ref=e169]: 讲义 · 关联薄弱点：函数返回值
              - button "面向对象的课程文档 completed 讲义 · 关联薄弱点：函数返回值" [ref=e170] [cursor=pointer]:
                - generic [ref=e171]:
                  - generic [ref=e172]: 面向对象的课程文档
                  - generic [ref=e173]: completed
                - generic [ref=e174]: 讲义 · 关联薄弱点：函数返回值
              - button "帮我生成一个讲解 面向对象的思维导图 completed 思维导图 · 关联薄弱点：函数返回值" [ref=e175] [cursor=pointer]:
                - generic [ref=e176]:
                  - generic [ref=e177]: 帮我生成一个讲解 面向对象的思维导图
                  - generic [ref=e178]: completed
                - generic [ref=e179]: 思维导图 · 关联薄弱点：函数返回值
              - button "帮我生成一个讲解 面向对象的思维导图 completed 思维导图 · 关联薄弱点：函数返回值" [ref=e180] [cursor=pointer]:
                - generic [ref=e181]:
                  - generic [ref=e182]: 帮我生成一个讲解 面向对象的思维导图
                  - generic [ref=e183]: completed
                - generic [ref=e184]: 思维导图 · 关联薄弱点：函数返回值
              - button "Python类精讲 completed PPT · 关联薄弱点：函数返回值" [ref=e185] [cursor=pointer]:
                - generic [ref=e186]:
                  - generic [ref=e187]: Python类精讲
                  - generic [ref=e188]: completed
                - generic [ref=e189]: PPT · 关联薄弱点：函数返回值
              - button "帮我生成Python函数的讲解课程文档 completed 讲义 · 关联薄弱点：函数返回值" [ref=e190] [cursor=pointer]:
                - generic [ref=e191]:
                  - generic [ref=e192]: 帮我生成Python函数的讲解课程文档
                  - generic [ref=e193]: completed
                - generic [ref=e194]: 讲义 · 关联薄弱点：函数返回值
              - button "Python 变量 completed 讲义 · 关联薄弱点：函数返回值" [ref=e195] [cursor=pointer]:
                - generic [ref=e196]:
                  - generic [ref=e197]: Python 变量
                  - generic [ref=e198]: completed
                - generic [ref=e199]: 讲义 · 关联薄弱点：函数返回值
              - button "Python 变量 completed 讲义 · 关联薄弱点：函数返回值" [ref=e200] [cursor=pointer]:
                - generic [ref=e201]:
                  - generic [ref=e202]: Python 变量
                  - generic [ref=e203]: completed
                - generic [ref=e204]: 讲义 · 关联薄弱点：函数返回值
              - button "Python 变量 completed 讲义 · 关联薄弱点：函数返回值" [ref=e205] [cursor=pointer]:
                - generic [ref=e206]:
                  - generic [ref=e207]: Python 变量
                  - generic [ref=e208]: completed
                - generic [ref=e209]: 讲义 · 关联薄弱点：函数返回值
              - button "Python 变量 completed 讲义 · 关联薄弱点：函数返回值" [ref=e210] [cursor=pointer]:
                - generic [ref=e211]:
                  - generic [ref=e212]: Python 变量
                  - generic [ref=e213]: completed
                - generic [ref=e214]: 讲义 · 关联薄弱点：函数返回值
              - button "Python 变量 completed 讲义 · 关联薄弱点：函数返回值" [ref=e215] [cursor=pointer]:
                - generic [ref=e216]:
                  - generic [ref=e217]: Python 变量
                  - generic [ref=e218]: completed
                - generic [ref=e219]: 讲义 · 关联薄弱点：函数返回值
              - button "Python 变量 completed 讲义 · 关联薄弱点：函数返回值" [ref=e220] [cursor=pointer]:
                - generic [ref=e221]:
                  - generic [ref=e222]: Python 变量
                  - generic [ref=e223]: completed
                - generic [ref=e224]: 讲义 · 关联薄弱点：函数返回值
          - generic [ref=e226]:
            - generic [ref=e227]:
              - generic [ref=e228]:
                - generic [ref=e229]: 讲义
                - heading "函数类的教学文档" [level=2] [ref=e230]
                - paragraph [ref=e231]: 来源：AI 生成 · 关联薄弱点：函数返回值 · 学习进度 100%
              - generic [ref=e232]: 可学习
            - generic [ref=e237]: "# 函数类的教学文档 # 函数类教学文档 ## 1. 函数类概述 ### 1.1 定义与用途 函数是一段可重复使用的代码块，用于执行特定的任务。在编程中，函数可以接收输入参数、处理数据并返回结果。函数类是一种面向对象编程的高级概念，它允许我们封装函数的定义和实现，并提供更灵活的代码组织方式。 ### 1.2 函数类的特点 - **封装性**：函数类将函数的定义和实现封装在一起，外部无法直接访问内部实现细节。 - **复用性**：通过继承和多态，函数类可以被多次使用在不同的上下文中，提高代码的重用率。 - **灵活性**：函数类提供了一种灵活的方式来定义和管理函数，使得代码更加模块化和可维护。 ### 1.3 函数类的主要功能 - **定义函数**：创建一个新的函数类实例，定义函数的名称、参数和返回值。 - **调用函数**：通过函数名直接调用已定义的函数，传入相应的参数。 - **管理函数**：提供方法来添加、删除和修改函数的定义。 - **支持多态**：允许函数之间进行交互，实现不同的行为。 ## 2. 函数类的创建 ### 2.1 创建新函数类 要创建一个函数类，首先需要定义一个构造函数，该构造函数接受必要的参数（如函数名称、参数列表和返回类型）。然后，可以在构造函数中初始化一些属性，例如函数的局部变量或全局变量。接下来，可以使用`__init__`方法来初始化这些属性。最后，可以通过调用`__new__`方法来创建新的函数类实例。 ```python class MyFunction: def __init__(self, name, args, return_type): self.name = name self.args = args self.return_type = return_type def __call__(self, *args): # 函数体 pass ``` ### 2.2 继承与多态 函数类可以继承其他类，以实现多态。这允许函数类在运行时动态地更改其行为，而不需要修改其源代码。多态性是通过在基类中定义虚函数并在派生类中实现这些虚函数来实现的。这样可以确保无论何时调用哪个派生类实例，都能得到正确的行为。 ```python class BaseClass: def __init__(self, name): self.name = name def call(self, *args): print(f\"{self.name} called with {len(args)} arguments\") class DerivedClass(BaseClass): def call(self, *args): print(f\"{self.name} called with {len(args)} arguments\") ``` 在这个例子中，`DerivedClass`继承了`BaseClass`，并实现了`call`方法。当调用`DerivedClass`的实例时，将输出“DerivedClass called with 2 arguments”。 ## 3. 函数类的使用 ### 3.1 定义函数 在Python中，函数通常定义为一个类的方法。这意味着我们可以将函数作为类的属性来使用。以下是一个示例，展示了如何定义一个名为`my_function`的函数，并将其作为类的属性。 ```python class MyClass: def __init__(self): self.my_function = None def my_function(self, arg1, arg2): # 函数体 return arg1 + arg2 ``` ### 3.2 调用函数 要调用函数，只需使用`self.my_function()`语法。如果函数是类的属性，则可以直接通过类名后跟点号和属性名来调用。例如： ```python obj = MyClass() result = obj.my_function(1, 2) # 输出：3 ``` ### 3.3 管理函数 要管理多个函数，可以使用类中的`__dict__`属性。这个属性是一个字典，包含了类的所有属性和方法。通过修改`__dict__`，我们可以动态地添加、删除或修改函数。例如： ```python class MyClass: def __init__(self): self.__dict__['my_function'] = self.my_function def my_function(self, arg1, arg2): # 函数体 return arg1 + arg2 ``` 在这个例子中，`my_function`现在是一个类的属性，可以通过`MyClass.my_function()`来调用。"
            - generic [ref=e238]:
              - link "学完去练习" [ref=e239] [cursor=pointer]:
                - /url: /practice
              - button "让 AI 讲解" [ref=e240] [cursor=pointer]:
                - img [ref=e241]
                - text: 让 AI 讲解
              - button "下载" [ref=e243] [cursor=pointer]:
                - img [ref=e244]
                - text: 下载
              - button "删除" [ref=e247] [cursor=pointer]:
                - img [ref=e248]
                - text: 删除
    - button "打开 AI 助手" [ref=e251] [cursor=pointer]:
      - img [ref=e252]
  - button "Open Next.js Dev Tools" [ref=e259] [cursor=pointer]:
    - img [ref=e260]
  - alert [ref=e263]
```

# Test source

```ts
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
> 260 |     await expect(page.getByText('全部')).toBeVisible()
      |                                        ^ Error: expect(locator).toBeVisible() failed
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
```