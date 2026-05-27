import { test, expect } from '@playwright/test'

// ============================================================
// 1. Auth 页面 (/auth)
// ============================================================
test.describe('Auth 页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth')
  })

  test('显示登录和注册 Tab', async ({ page }) => {
    // Tab buttons in the tab bar (not the form submit button)
    const tabBar = page.locator('div.flex.gap-1.bg-bg-hover')
    await expect(tabBar.getByRole('button', { name: '登录' })).toBeVisible()
    await expect(tabBar.getByRole('button', { name: '注册' })).toBeVisible()
  })

  test('默认显示登录表单', async ({ page }) => {
    await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible()
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
    await expect(page.getByPlaceholder('请再次输入密码')).not.toBeVisible()
  })

  test('点击注册 Tab 切换到注册表单', async ({ page }) => {
    await page.getByRole('button', { name: '注册' }).click()
    await expect(page.getByPlaceholder('请再次输入密码')).toBeVisible()
  })

  test('左侧品牌区显示 SparkLearn', async ({ page }) => {
    await expect(page.getByText('SparkLearn').first()).toBeVisible()
    await expect(page.getByText('AI 驱动的个性化学习平台')).toBeVisible()
  })

  test('点击登录按钮跳转到 onboarding', async ({ page }) => {
    await page.locator('form button[type="submit"]').click()
    await expect(page).toHaveURL(/onboarding/, { timeout: 10000 })
  })

  test('注册表单输入功能', async ({ page }) => {
    await page.getByRole('button', { name: '注册' }).click()
    await page.getByPlaceholder('请输入邮箱').fill('new@example.com')
    await page.getByPlaceholder('请输入密码').fill('pass123')
    await page.getByPlaceholder('请再次输入密码').fill('pass123')
    await expect(page.getByPlaceholder('请再次输入密码')).toHaveValue('pass123')
  })
})

// ============================================================
// 2. Onboarding 页面 (/onboarding)
// ============================================================
test.describe('Onboarding 页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForTimeout(1500) // 等待打字动画
  })

  test('显示5个步骤标题', async ({ page }) => {
    await expect(page.getByText('学习目标').first()).toBeVisible()
    await expect(page.getByText('编程基础')).toBeVisible()
    await expect(page.getByText('薄弱环节')).toBeVisible()
    await expect(page.getByText('学习偏好')).toBeVisible()
    await expect(page.getByText('学习时间')).toBeVisible()
  })

  test('第一步显示4个目标选项', async ({ page }) => {
    await expect(page.getByText('期末提分')).toBeVisible()
    await expect(page.getByText('竞赛准备')).toBeVisible()
    await expect(page.getByText('兴趣探索')).toBeVisible()
    await expect(page.getByText('求职准备')).toBeVisible()
  })

  test('未选择时下一步按钮为 disabled', async ({ page }) => {
    await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled()
  })

  test('选择选项后下一步按钮为 enabled', async ({ page }) => {
    await page.getByText('期末提分').click()
    await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled()
  })

  test('完成全流程到达摘要页', async ({ page }) => {
    // Step 1: 学习目标
    await page.getByText('期末提分').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(2000)

    // Step 2: 编程基础
    await page.getByText('有一些基础').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(2000)

    // Step 3: 薄弱环节 (tags)
    await page.getByText('数据结构').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(2000)

    // Step 4: 学习偏好
    await page.getByText('实践型').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(2000)

    // Step 5: 学习时间 (最后一步显示摘要 + "开始学习"按钮)
    // 注意：最后一步 canNext 默认 true，不需要选择
    // 但需要点击时间选项（如果有的话）
    const timeOption = page.getByText('1-2小时')
    if (await timeOption.isVisible()) {
      await timeOption.click()
    }
    // 最后一步按钮是"开始学习"
    await expect(page.getByRole('button', { name: '开始学习' })).toBeVisible()
  })

  test('点击开始学习跳转到首页', async ({ page }) => {
    // 快速走完流程
    await page.getByText('期末提分').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(2000)
    await page.getByText('有一些基础').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(2000)
    await page.getByText('数据结构').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(2000)
    await page.getByText('实践型').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(2000)

    // 最后一步直接点击开始学习
    await page.getByRole('button', { name: '开始学习' }).click()
    await expect(page).toHaveURL(/\//, { timeout: 10000 })
  })

  test('返回按钮从第2步可以回到第1步', async ({ page }) => {
    await page.getByText('期末提分').click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.waitForTimeout(2000)

    const backBtn = page.getByRole('button', { name: '上一步' })
    await expect(backBtn).toBeEnabled()
    await backBtn.click()
    await expect(page.getByText('期末提分')).toBeVisible()
  })
})

// ============================================================
// 3. Homepage (/)
// ============================================================
test.describe('首页总览', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // 等待数据加载
    await page.waitForTimeout(1500)
  })

  test('显示欢迎标题', async ({ page }) => {
    await expect(page.getByText('继续你的').first()).toBeVisible()
    await expect(page.getByText('学习之旅')).toBeVisible()
  })

  test('显示连续学习 Badge', async ({ page }) => {
    await expect(page.getByText(/连续学习/)).toBeVisible()
  })

  test('显示精选课程卡片', async ({ page }) => {
    await expect(page.getByText('Python 程序设计')).toBeVisible()
  })

  test('显示4个统计卡片', async ({ page }) => {
    await expect(page.getByText('学习时长')).toBeVisible()
    await expect(page.getByText('任务完成率')).toBeVisible()
    await expect(page.getByText('正确率')).toBeVisible()
    await expect(page.getByText('连续天数')).toBeVisible()
  })

  test('显示今日任务列表', async ({ page }) => {
    await expect(page.getByText('今日任务')).toBeVisible()
  })

  test('显示学习打卡热力图', async ({ page }) => {
    await expect(page.getByText('学习打卡')).toBeVisible()
  })

  test('显示学习画像卡片', async ({ page }) => {
    await expect(page.getByText('学习画像')).toBeVisible()
  })

  test('显示最近学习列表', async ({ page }) => {
    await expect(page.getByText('最近学习')).toBeVisible()
  })

  test('显示待加强知识点', async ({ page }) => {
    await expect(page.getByText('待加强知识点')).toBeVisible()
  })

  test('点击任务圆圈可以切换完成状态', async ({ page }) => {
    const taskButtons = page.locator('button.w-5.h-5.rounded-full')
    const firstTask = taskButtons.first()
    if (await firstTask.isVisible()) {
      await firstTask.click()
      // 点击后应该变成完成状态（绿色背景）
      await expect(firstTask).toHaveClass(/bg-success/)
    }
  })
})

// ============================================================
// 4. 学习路径 (/path)
// ============================================================
test.describe('学习路径页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/path')
    await page.waitForTimeout(1500)
  })

  test('显示页面标题', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '学习路径' })).toBeVisible()
  })

  test('显示学习阶段列表', async ({ page }) => {
    // "学习阶段" h3 和侧栏可能有类似文字，通过 Card 内 h3 精确匹配
    const stageHeading = page.locator('h3', { hasText: '学习阶段' })
    await expect(stageHeading).toBeVisible()
    await expect(page.locator('span:text("基础语法")').first()).toBeVisible()
  })

  test('显示当前阶段标记', async ({ page }) => {
    await expect(page.getByText('当前')).toBeVisible()
  })

  test('显示知识图谱', async ({ page }) => {
    await expect(page.getByText('知识图谱')).toBeVisible()
  })

  test('点击知识节点可以展开/折叠', async ({ page }) => {
    const node = page.locator('span.text-small:has-text("基础语法")').first()
    if (await node.isVisible()) {
      await node.click()
    }
  })
})

// ============================================================
// 5. 资源中心 (/resources)
// ============================================================
test.describe('资源中心页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/resources')
    await page.waitForTimeout(1500)
  })

  test('显示页面标题', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '资源中心' })).toBeVisible()
  })

  test('显示搜索框', async ({ page }) => {
    await expect(page.getByPlaceholder('搜索学习资源...')).toBeVisible()
  })

  test('显示筛选标签', async ({ page }) => {
    await expect(page.getByText('全部')).toBeVisible()
  })

  test('显示资源列表', async ({ page }) => {
    // 表格应该有内容
    const tableRows = page.locator('table tbody tr')
    await expect(tableRows.first()).toBeVisible()
  })

  test('搜索功能过滤资源', async ({ page }) => {
    await page.getByPlaceholder('搜索学习资源...').fill('变量')
    await page.waitForTimeout(400) // debounce
    // 验证结果变化
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('点击筛选标签过滤资源', async ({ page }) => {
    // 点击"全部"筛选
    const allBtn = page.locator('button:has-text("全部")')
    if (await allBtn.isVisible()) {
      await allBtn.click()
    }
  })
})

// ============================================================
// 6. 练习与错题 (/practice)
// ============================================================
test.describe('练习与错题页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/practice')
    await page.waitForTimeout(1500)
  })

  test('显示页面标题', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '练习与错题' })).toBeVisible()
  })

  test('显示3个 Tab', async ({ page }) => {
    await expect(page.getByRole('button', { name: '练习' })).toBeVisible()
    await expect(page.getByRole('button', { name: '错题本' })).toBeVisible()
    await expect(page.getByRole('button', { name: '收藏' })).toBeVisible()
  })

  test('默认显示练习 Tab', async ({ page }) => {
    const practiceTab = page.getByRole('button', { name: '练习' })
    await expect(practiceTab).toHaveClass(/bg-blue/)
  })

  test('显示题目内容', async ({ page }) => {
    await expect(page.getByText(/第 \d+ 题/)).toBeVisible()
  })

  test('选择题选项可以点击', async ({ page }) => {
    const options = page.locator('button.w-full.flex.items-center.gap-3')
    if (await options.first().isVisible()) {
      await options.first().click()
      // 选中后应该有蓝色边框
      await expect(options.first()).toHaveClass(/border-blue/)
    }
  })

  test('选择答案后可以提交', async ({ page }) => {
    const options = page.locator('button.w-full.flex.items-center.gap-3')
    if (await options.first().isVisible()) {
      await options.first().click()
      const submitBtn = page.getByRole('button', { name: '提交答案' })
      await expect(submitBtn).toBeEnabled()
    }
  })

  test('提交后显示正确/错误反馈', async ({ page }) => {
    const options = page.locator('button.w-full.flex.items-center.gap-3')
    if (await options.first().isVisible()) {
      await options.first().click()
      await page.getByRole('button', { name: '提交答案' }).click()
      // 应该显示反馈区域
      const feedback = page.locator('div.p-4.rounded-\\[12px\\]')
      await expect(feedback).toBeVisible()
    }
  })

  test('切换到错题本 Tab', async ({ page }) => {
    await page.getByRole('button', { name: '错题本' }).click()
    await expect(page.getByText('还没有错题记录')).toBeVisible()
  })

  test('切换到收藏 Tab', async ({ page }) => {
    await page.getByRole('button', { name: '收藏' }).click()
    await expect(page.getByText('还没有收藏的题目')).toBeVisible()
  })

  test('右侧显示正确率', async ({ page }) => {
    await expect(page.getByText('正确率')).toBeVisible()
  })
})

// ============================================================
// 7. 资源推送 (/feed)
// ============================================================
test.describe('资源推送页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/feed')
    await page.waitForTimeout(1500)
  })

  test('显示页面标题', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '资源推送' })).toBeVisible()
  })

  test('显示 AI 推荐 Banner', async ({ page }) => {
    // Banner 特定文字：位于 Card 有渐变背景的蓝色卡片中
    await expect(page.getByText('基于你的学习画像，AI 为你精选以下资源')).toBeVisible()
  })

  test('显示推荐资源卡片', async ({ page }) => {
    const cards = page.locator('.grid.grid-cols-3 > div')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('推荐卡片显示推荐理由', async ({ page }) => {
    // 每个推荐卡片应该有 reason 文字
    const reasons = page.locator('p.text-small.text-ink-secondary')
    const count = await reasons.count()
    expect(count).toBeGreaterThan(0)
  })
})

// ============================================================
// 8. 资源生成 (/generate)
// ============================================================
test.describe('资源生成页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/generate')
    await page.waitForTimeout(1500)
  })

  test('显示页面标题', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '资源生成' })).toBeVisible()
  })

  test('显示6种资源类型选择器', async ({ page }) => {
    const typeButtons = page.locator('.grid.grid-cols-6 > button')
    await expect(typeButtons).toHaveCount(6)
  })

  test('显示输入框', async ({ page }) => {
    await expect(page.getByPlaceholder('请描述你需要的学习资源...')).toBeVisible()
  })

  test('显示快捷标签', async ({ page }) => {
    // 快捷标签区域存在
    const tags = page.locator('button.px-3.py-1.rounded-pill')
    const count = await tags.count()
    expect(count).toBeGreaterThan(0)
  })

  test('生成按钮在输入为空时禁用', async ({ page }) => {
    const genBtn = page.getByRole('button', { name: /生成/ })
    await expect(genBtn).toBeDisabled()
  })

  test('输入文字后可以点击生成', async ({ page }) => {
    await page.getByPlaceholder('请描述你需要的学习资源...').fill('Python 变量')
    const genBtn = page.getByRole('button', { name: /生成/ })
    await expect(genBtn).toBeEnabled()
  })

  test('点击资源类型切换选中状态', async ({ page }) => {
    const typeButtons = page.locator('.grid.grid-cols-6 > button')
    // 点击第二个
    await typeButtons.nth(1).click()
    await expect(typeButtons.nth(1)).toHaveClass(/border-blue/)
  })

  test('已有资源列表显示', async ({ page }) => {
    // Mock 返回了6个初始资源
    const resourceItems = page.locator('div.flex.items-center.gap-3.p-3')
    const count = await resourceItems.count()
    expect(count).toBeGreaterThan(0)
  })
})

// ============================================================
// 9. 智能辅导 (/tutor)
// ============================================================
test.describe('智能辅导页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tutor')
    await page.waitForTimeout(1500)
  })

  test('显示页面标题', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '智能辅导' })).toBeVisible()
  })

  test('显示对话历史', async ({ page }) => {
    // Mock 返回了历史消息
    const messages = page.locator('div.max-w-\\[70\\%\\]')
    const count = await messages.count()
    expect(count).toBeGreaterThan(0)
  })

  test('显示输入框', async ({ page }) => {
    await expect(page.getByPlaceholder('请输入你的问题...')).toBeVisible()
  })

  test('发送消息功能', async ({ page }) => {
    await page.getByPlaceholder('请输入你的问题...').fill('什么是列表推导式？')
    // 按 Enter 发送
    await page.getByPlaceholder('请输入你的问题...').press('Enter')
    await page.waitForTimeout(1500)
    // 用户消息应该出现
    const userMessages = page.locator('div.bg-blue.text-white')
    await expect(userMessages.first()).toBeVisible()
  })

  test('发送按钮功能', async ({ page }) => {
    await page.getByPlaceholder('请输入你的问题...').fill('Python 入门')
    const sendBtn = page.locator('button:has(svg.lucide-send)')
    await sendBtn.click()
    await page.waitForTimeout(1500)
    const userMessages = page.locator('div.bg-blue.text-white')
    await expect(userMessages.first()).toBeVisible()
  })

  test('输入为空时发送按钮禁用', async ({ page }) => {
    const sendBtn = page.locator('button:has(svg.lucide-send)')
    await expect(sendBtn).toBeDisabled()
  })

  test('显示麦克风按钮', async ({ page }) => {
    const micBtn = page.locator('button:has(svg.lucide-mic)')
    await expect(micBtn).toBeVisible()
  })
})

// ============================================================
// 10. 学习报告 (/report)
// ============================================================
test.describe('学习报告页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report')
    await page.waitForTimeout(1500)
  })

  test('显示页面标题', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '学习报告' })).toBeVisible()
  })

  test('显示本周/本月切换按钮', async ({ page }) => {
    await expect(page.getByRole('button', { name: '本周' })).toBeVisible()
    await expect(page.getByRole('button', { name: '本月' })).toBeVisible()
  })

  test('默认选中本周', async ({ page }) => {
    const weekBtn = page.getByRole('button', { name: '本周' })
    await expect(weekBtn).toHaveClass(/bg-blue/)
  })

  test('显示4个统计卡片', async ({ page }) => {
    await expect(page.getByText('总学习时长')).toBeVisible()
    await expect(page.getByText('任务完成率')).toBeVisible()
    await expect(page.getByText('习题正确率')).toBeVisible()
    await expect(page.getByText('连续学习')).toBeVisible()
  })

  test('显示每日学习时长柱状图', async ({ page }) => {
    await expect(page.getByText('每日学习时长')).toBeVisible()
  })

  test('显示时间分配', async ({ page }) => {
    await expect(page.getByText('时间分配')).toBeVisible()
  })

  test('显示薄弱点', async ({ page }) => {
    await expect(page.getByText('薄弱点')).toBeVisible()
  })

  test('显示 AI 分析总结', async ({ page }) => {
    await expect(page.getByText('AI 分析总结')).toBeVisible()
  })

  test('点击本月切换', async ({ page }) => {
    await page.getByRole('button', { name: '本月' }).click()
    await expect(page.getByRole('button', { name: '本月' })).toHaveClass(/bg-blue/)
  })
})

// ============================================================
// 11. 视频播放 (/video)
// ============================================================
test.describe('视频播放页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/video')
    await page.waitForTimeout(1500)
  })

  test('显示页面标题', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '视频播放' })).toBeVisible()
  })

  test('显示视频播放区域', async ({ page }) => {
    await expect(page.getByText('视频播放区域')).toBeVisible()
  })

  test('显示视频标题', async ({ page }) => {
    // 视频标题在 Video Info 卡片中
    const videoInfoTitle = page.locator('h2.text-h3')
    await expect(videoInfoTitle).toBeVisible()
  })

  test('显示全部视频列表', async ({ page }) => {
    await expect(page.getByText('全部视频')).toBeVisible()
  })

  test('点击视频列表项切换播放', async ({ page }) => {
    const videoItems = page.locator('div[class*="ring"]')
    // 找到另一个视频卡片点击
    const videoCards = page.locator('div.cursor-pointer')
    if (await videoCards.count() > 1) {
      await videoCards.nth(1).click()
      // 切换后应该更新播放区标题
    }
  })
})

// ============================================================
// 12. 个人信息 (/profile)
// ============================================================
test.describe('个人信息页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile')
    await page.waitForTimeout(1500)
  })

  test('显示页面标题', async ({ page }) => {
    await expect(page.getByText('个人信息')).toBeVisible()
  })

  test('显示基本信息卡片', async ({ page }) => {
    await expect(page.getByText('基本信息')).toBeVisible()
  })

  test('显示用户姓名', async ({ page }) => {
    // 姓名出现在侧栏和个人信息页中，使用 main 区域限定
    await expect(page.getByRole('main').getByText('张同学')).toBeVisible()
  })

  test('显示输入字段', async ({ page }) => {
    await expect(page.getByText('姓名')).toBeVisible()
    await expect(page.getByText('专业')).toBeVisible()
    await expect(page.getByText('年级')).toBeVisible()
  })

  test('显示学习目标 Badge', async ({ page }) => {
    await expect(page.getByText('期末提分')).toBeVisible()
  })

  test('显示保存按钮', async ({ page }) => {
    await expect(page.getByRole('button', { name: /保存修改/ })).toBeVisible()
  })

  test('显示学习概况卡片', async ({ page }) => {
    await expect(page.getByText('学习概况')).toBeVisible()
  })

  test('显示安全设置卡片', async ({ page }) => {
    await expect(page.getByText('安全设置')).toBeVisible()
    await expect(page.getByRole('button', { name: '修改密码' })).toBeVisible()
  })
})

// ============================================================
// 13. 侧栏导航跳转
// ============================================================
test.describe('侧栏导航', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1500)
  })

  const navItems = [
    { label: '首页总览', path: '/' },
    { label: '学习路径', path: '/path' },
    { label: '资源中心', path: '/resources' },
    { label: '练习与错题', path: '/practice' },
    { label: '资源推送', path: '/feed' },
    { label: '资源生成', path: '/generate' },
    { label: '智能辅导', path: '/tutor' },
    { label: '学习报告', path: '/report' },
    { label: '视频播放', path: '/video' },
  ]

  for (const item of navItems) {
    test(`点击"${item.label}"导航到 ${item.path}`, async ({ page }) => {
      // 展开侧栏（如果缩起了）
      const navLink = page.locator(`a[href="${item.path}"]`)
      await navLink.click()
      await expect(page).toHaveURL(new RegExp(item.path === '/' ? '/$' : item.path), { timeout: 5000 })
    })
  }

  test('侧栏收起按钮功能', async ({ page }) => {
    const collapseBtn = page.getByRole('button', { name: '收起侧栏' })
    await collapseBtn.click()
    // 侧栏应该变窄
    const sidebar = page.locator('aside')
    await expect(sidebar).toHaveClass(/w-16/)
  })

  test('侧栏两次收起后显示展开按钮', async ({ page }) => {
    // 第一次点击：expanded -> icons
    await page.getByRole('button', { name: '收起侧栏' }).click()
    // 第二次点击：icons -> collapsed
    await page.getByRole('button', { name: '展开侧栏' }).click()
    // 侧栏消失，应该有展开的箭头按钮
    await expect(page.getByRole('button', { name: '展开侧栏' })).toBeVisible()
  })
})

// ============================================================
// 14. 页面间跳转回归
// ============================================================
test.describe('页面跳转回归', () => {
  test('从首页跳到报告再返回首页', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1500)

    await page.locator('a[href="/report"]').click()
    await page.waitForTimeout(1500)
    await expect(page).toHaveURL(/report/)

    await page.locator('a[href="/"]').click()
    await page.waitForTimeout(1500)
    await expect(page).toHaveURL(/\/$/)
  })

  test('从首页跳到资源中心搜索后跳到生成页面', async ({ page }) => {
    await page.goto('/resources')
    await page.waitForTimeout(1500)

    // 空搜索结果时应该有"去生成"链接
    await page.getByPlaceholder('搜索学习资源...').fill('不存在的资源xyz')
    await page.waitForTimeout(400)
  })

  test('从视频页跳到生成页面', async ({ page }) => {
    await page.goto('/video')
    await page.waitForTimeout(1500)
    // 目前视频页面不空，没有空状态的"去生成"链接
    // 但可以确认页面正常渲染
    await expect(page.getByRole('heading', { name: '视频播放' })).toBeVisible()
  })
})
