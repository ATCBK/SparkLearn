import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const 根目录 = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const 前端目录 = path.join(根目录, 'frontend')
const 输出目录 = path.join(根目录, 'docs', '用户使用手册截图')
const 基础地址 = process.env.SPARKLEARN_BASE_URL || 'http://127.0.0.1:3000'
const requireFromFrontend = createRequire(path.join(前端目录, 'package.json'))
const { chromium } = requireFromFrontend('playwright')

const 桌面视口 = { name: '桌面端', width: 1440, height: 920 }
const 移动视口 = { name: '移动端', width: 390, height: 844, isMobile: true }

const 演示用户 = {
  user_id: 'single_user',
  name: '张同学',
  phone: '13800000000',
  loginAt: new Date().toISOString(),
}

function 安全文件名(名称) {
  return 名称.replace(/[\\/:*?"<>|]/g, '，').replace(/\s+/g, '')
}

function 模拟用户登录脚本() {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    sub: 演示用户.user_id,
    name: 演示用户.name,
    phone: 演示用户.phone,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 72 * 60 * 60,
  }
  const encode = (value) => Buffer.from(JSON.stringify(value))
    .toString('base64url')
  const token = `${encode(header)}.${encode(payload)}.mock-signature`
  return `
    localStorage.setItem('sparklearn_token', ${JSON.stringify(token)});
    localStorage.setItem('sparklearn_user', ${JSON.stringify(JSON.stringify(演示用户))});
    localStorage.setItem('sparklearn_profile_collected_at:${演示用户.user_id}', new Date().toISOString());
    localStorage.setItem('sparklearn_profile_collected_at', new Date().toISOString());
    localStorage.setItem('admin_token', 'demo_admin_token');
    localStorage.setItem('teacher_token', 'demo_teacher_token');
  `
}

async function 写入演示登录态(page) {
  await page.evaluate(模拟用户登录脚本())
}

async function 等待页面稳定(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(900)
}

async function 截图(page, 编号, 模块, 名称, 视口名, 清单, 说明 = '') {
  await 等待页面稳定(page)
  const 文件名 = 安全文件名(`${String(编号).padStart(3, '0')}-${模块}-${名称}-${视口名}.png`)
  const 文件路径 = path.join(输出目录, 文件名)
  await page.screenshot({ path: 文件路径, fullPage: true, animations: 'disabled' })
  清单.push({
    编号,
    模块,
    名称,
    视口: 视口名,
    页面地址: page.url(),
    文件名,
    说明,
  })
}

async function 导航(page, route) {
  await page.goto(`${基础地址}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await 等待页面稳定(page)
}

async function 尝试点击(page, selector, options = {}) {
  const locator = page.locator(selector)
  const count = await locator.count().catch(() => 0)
  if (count < 1) return false
  await locator.first().click({ timeout: 3500, ...options }).catch(() => {})
  await 等待页面稳定(page)
  return true
}

async function 尝试填写(page, selector, value) {
  const locator = page.locator(selector)
  const count = await locator.count().catch(() => 0)
  if (count < 1) return false
  await locator.first().fill(value, { timeout: 3500 }).catch(() => {})
  await 等待页面稳定(page)
  return true
}

const 普通页面 = [
  ['首页总览', '/', '默认状态'],
  ['学习画像', '/profile', '默认状态'],
  ['学习画像', '/profile/settings', '个人设置'],
  ['学习路径', '/path', '路径总览'],
  ['知识图谱', '/graph', '图谱总览'],
  ['资源生成', '/generate', '默认状态'],
  ['知识库', '/knowledge', '默认状态'],
  ['练习评测', '/practice', '默认题目'],
  ['错题收藏', '/practice/mistakes', '错题本'],
  ['错题收藏', '/practice/favorites', '收藏题目'],
  ['错题收藏', '/practice/records', '练习记录'],
  ['学习论坛', '/forum', '帖子列表'],
  ['学习论坛', '/forum/new', '发布帖子'],
  ['学习发现', '/info-stream', '信息流'],
  ['学习报告', '/report', '默认报告'],
  ['学习伙伴', '/agent', '默认状态'],
  ['智能辅导', '/tutor', '对话首页'],
  ['视频资源', '/video', '播放页'],
  ['学习广场', '/plaza', '广场首页'],
  ['学习广场', '/plaza/qa', '问答板块'],
  ['学习广场', '/plaza/resource-share', '资源分享'],
  ['学习广场', '/plaza/experience-share', '经验分享'],
  ['学习广场', '/plaza/team-study', '组队学习'],
  ['学习广场', '/plaza/history', '浏览历史'],
  ['学习广场', '/plaza/my-likes', '我的点赞'],
  ['学习广场', '/plaza/my-comments', '我的评论'],
  ['Tutor工具', '/tutor/roles', '角色管理'],
  ['Tutor工具', '/tutor/workshop', '角色工作坊'],
  ['Tutor工具', '/tutor/knowledge', '知识库'],
  ['Tutor工具', '/tutor/files', '文件管理'],
  ['Tutor工具', '/tutor/skills', '技能商店'],
  ['Tutor工具', '/tutor/mcp-store', '插件商店'],
  ['Tutor工具', '/tutor/mcp-store/docs', '插件文档'],
  ['分享页面', '/share/demo', '演示分享码'],
  ['学习论坛', '/forum/demo', '帖子详情演示'],
  ['学习广场', '/plaza/demo', '广场详情演示'],
]

const 教师页面 = [
  ['教师端', '/teacher/login', '登录页'],
  ['教师端', '/teacher/dashboard', '数据看板'],
  ['教师端', '/teacher', '工作台入口'],
  ['教师端', '/teacher/subjects', '学科管理'],
  ['教师端', '/teacher/students', '学生列表'],
  ['教师端', '/teacher/students/demo', '学生详情演示'],
  ['教师端', '/teacher/interventions', '干预中心'],
  ['教师端', '/teacher/broadcast', '通知分发'],
  ['教师端', '/teacher/ai', 'AI助手'],
  ['教师端', '/teacher/reports', '学习报告'],
]

const 管理页面 = [
  ['管理端', '/admin/login', '登录页'],
  ['管理端', '/admin/dashboard', '平台总览'],
  ['管理端', '/admin', '管理入口'],
  ['管理端', '/admin/users', '用户与权限'],
  ['管理端', '/admin/forum', '帖子审核'],
  ['管理端', '/admin/audit', '审计日志'],
  ['管理端', '/admin/settings', '系统设置'],
]

async function 采集普通交互(page, 清单, 起始编号, 视口名, 包含入口流程 = true) {
  let 编号 = 起始编号

  if (包含入口流程) {
    await 导航(page, '/auth')
    await 截图(page, 编号++, '登录注册', '登录页默认状态', 视口名, 清单, '普通用户入口页')
    await 尝试点击(page, 'button:has-text("注册")')
    await 截图(page, 编号++, '登录注册', '注册页切换状态', 视口名, 清单, '点击注册 Tab 后')

    await 写入演示登录态(page)
    await 导航(page, '/onboarding')
    await 截图(page, 编号++, '新手建档', '学习目标选择', 视口名, 清单, '建档第 1 步')
    await 尝试点击(page, 'button:has-text("Python"), button:has-text("掌握核心技能")')
    await 截图(page, 编号++, '新手建档', '目标已选择', 视口名, 清单, '选择学习目标后的响应')
    await 尝试点击(page, 'button:has-text("下一步")')
    await 截图(page, 编号++, '新手建档', '编程基础选择', 视口名, 清单, '进入第 2 步后的结果')

    if (包含入口流程 === '仅入口') return 编号
  }

  await 导航(page, '/generate')
  await 截图(page, 编号++, '资源生成', '输入前默认状态', 视口名, 清单)
  await 尝试填写(page, 'textarea, input[placeholder*="学习资源"], input[placeholder*="描述"]', '请生成一份 Python 列表推导式入门讲义')
  await 截图(page, 编号++, '资源生成', '输入资源需求后', 视口名, 清单, '填写示例需求后的按钮与表单状态')

  await 导航(page, '/practice')
  await 截图(page, 编号++, '练习评测', '答题前', 视口名, 清单)
  await 尝试点击(page, 'button:has-text("A"), button:has-text("B"), button:has-text("C"), button:has-text("D")')
  await 截图(page, 编号++, '练习评测', '选择答案后', 视口名, 清单, '点击选项后的响应')
  await 尝试点击(page, 'button:has-text("提交答案")')
  await 截图(page, 编号++, '练习评测', '提交答案反馈', 视口名, 清单, '提交后的反馈结果')

  await 导航(page, '/report')
  await 截图(page, 编号++, '学习报告', '本周视图', 视口名, 清单)
  await 尝试点击(page, 'button:has-text("本月")')
  await 截图(page, 编号++, '学习报告', '本月视图', 视口名, 清单, '点击本月后的切换结果')

  await 导航(page, '/tutor')
  await 截图(page, 编号++, '智能辅导', '发送前', 视口名, 清单)
  await 尝试填写(page, 'textarea, input[placeholder*="问题"], input[placeholder*="请输入"]', '请用一个生活化例子解释 Python 字典')
  await 截图(page, 编号++, '智能辅导', '输入问题后', 视口名, 清单, '填写示例问题后的输入状态')
  await 尝试点击(page, 'button:has(svg), button:has-text("发送")')
  await 截图(page, 编号++, '智能辅导', '发送问题后', 视口名, 清单, '点击发送后的对话结果')

  await 导航(page, '/path')
  await 截图(page, 编号++, '学习路径', '路径总览', 视口名, 清单)
  await 尝试点击(page, 'button:has-text("甘特"), button:has-text("路径"), button:has-text("列表")')
  await 截图(page, 编号++, '学习路径', '视图切换后', 视口名, 清单, '点击路径视图控件后的响应')

  return 编号
}

async function 采集页面组(page, pages, 清单, 起始编号, 视口名, beforeEach) {
  let 编号 = 起始编号
  for (const [模块, route, 名称] of pages) {
    try {
      if (beforeEach) await beforeEach(page, route)
      await 导航(page, route)
      await 截图(page, 编号++, 模块, 名称, 视口名, 清单)
    } catch (error) {
      清单.push({
        编号: 编号++,
        模块,
        名称,
        视口: 视口名,
        页面地址: `${基础地址}${route}`,
        文件名: '',
        说明: `采集失败：${error.message}`,
      })
    }
  }
  return 编号
}

async function 采集教师管理登录过程(page, 清单, 起始编号, 视口名) {
  let 编号 = 起始编号

  await 导航(page, '/teacher/login')
  await 截图(page, 编号++, '教师端登录', '输入前', 视口名, 清单)
  await 尝试填写(page, 'input[placeholder="请输入教师账号"]', 'teacher')
  await 尝试填写(page, 'input[placeholder="请输入密码"]', '123456')
  await 截图(page, 编号++, '教师端登录', '输入演示账号后', 视口名, 清单)
  await 尝试点击(page, 'button:has-text("登录教师工作台")')
  await 截图(page, 编号++, '教师端登录', '登录成功后数据看板', 视口名, 清单)

  await 导航(page, '/admin/login')
  await 截图(page, 编号++, '管理端登录', '输入前', 视口名, 清单)
  await 尝试填写(page, 'input[placeholder="请输入管理员账号"]', 'admin')
  await 尝试填写(page, 'input[placeholder="请输入密码"]', '123456')
  await 截图(page, 编号++, '管理端登录', '输入演示账号后', 视口名, 清单)
  await 尝试点击(page, 'button:has-text("登录管理端")')
  await 截图(page, 编号++, '管理端登录', '登录成功后平台总览', 视口名, 清单)

  return 编号
}

async function 写清单(清单) {
  const lines = [
    '# SparkLearn 用户使用手册截图清单',
    '',
    `- 采集时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    `- 访问地址：${基础地址}`,
    `- 输出目录：${输出目录}`,
    '',
    '| 编号 | 模块 | 截图内容 | 视口 | 文件 | 页面地址 | 说明 |',
    '|---:|---|---|---|---|---|---|',
    ...清单.map((item) => `| ${item.编号} | ${item.模块} | ${item.名称} | ${item.视口} | ${item.文件名 ? `[${item.文件名}](./${encodeURI(item.文件名)})` : '未生成'} | ${item.页面地址} | ${item.说明 || ''} |`),
  ]
  await fs.writeFile(path.join(输出目录, '截图清单.md'), lines.join('\n'), 'utf8')
}

async function main() {
  await fs.rm(输出目录, { recursive: true, force: true })
  await fs.mkdir(输出目录, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const entryContext = await browser.newContext({
    viewport: { width: 桌面视口.width, height: 桌面视口.height },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
  })
  const entryPage = await entryContext.newPage()
  const 清单 = []

  let 编号 = 1
  编号 = await 采集普通交互(entryPage, 清单, 编号, 桌面视口.name, '仅入口')
  编号 = await 采集教师管理登录过程(entryPage, 清单, 编号, 桌面视口.name)
  await entryContext.close()

  const context = await browser.newContext({
    viewport: { width: 桌面视口.width, height: 桌面视口.height },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
  })
  const page = await context.newPage()
  await 导航(page, '/auth')
  await 写入演示登录态(page)
  编号 = await 采集普通交互(page, 清单, 编号, 桌面视口.name, false)
  编号 = await 采集页面组(page, 普通页面, 清单, 编号, 桌面视口.name, async (p) => {
    await 写入演示登录态(p)
  })
  编号 = await 采集页面组(page, 教师页面, 清单, 编号, 桌面视口.name, async (p) => {
    await p.evaluate(() => {
      localStorage.setItem('teacher_token', 'demo_teacher_token')
      window.dispatchEvent(new Event('teacher-auth-changed'))
    })
  })
  编号 = await 采集页面组(page, 管理页面, 清单, 编号, 桌面视口.name, async (p) => {
    await p.evaluate(() => localStorage.setItem('admin_token', 'demo_admin_token'))
  })
  await context.close()

  const mobileEntryContext = await browser.newContext({
    viewport: { width: 移动视口.width, height: 移动视口.height },
    isMobile: true,
    deviceScaleFactor: 2,
    locale: 'zh-CN',
  })
  const mobileEntryPage = await mobileEntryContext.newPage()
  编号 = await 采集普通交互(mobileEntryPage, 清单, 编号, 移动视口.name, '仅入口')
  await mobileEntryContext.close()

  const mobileContext = await browser.newContext({
    viewport: { width: 移动视口.width, height: 移动视口.height },
    isMobile: true,
    deviceScaleFactor: 2,
    locale: 'zh-CN',
  })
  const mobilePage = await mobileContext.newPage()
  await 导航(mobilePage, '/auth')
  await 写入演示登录态(mobilePage)

  编号 = await 采集普通交互(mobilePage, 清单, 编号, 移动视口.name, false)
  编号 = await 采集页面组(
    mobilePage,
    [
      ['首页总览', '/', '默认状态'],
      ['学习画像', '/profile', '默认状态'],
      ['学习路径', '/path', '路径总览'],
      ['资源生成', '/generate', '默认状态'],
      ['练习评测', '/practice', '默认题目'],
      ['学习论坛', '/forum', '帖子列表'],
      ['智能辅导', '/tutor', '对话首页'],
      ['学习报告', '/report', '默认报告'],
      ['教师端', '/teacher/dashboard', '移动端数据看板'],
      ['管理端', '/admin/dashboard', '移动端平台总览'],
    ],
    清单,
    编号,
    移动视口.name,
    async (p, route) => {
      await 写入演示登录态(p)
      if (route.startsWith('/teacher')) {
        await p.evaluate(() => {
          localStorage.setItem('teacher_token', 'demo_teacher_token')
          window.dispatchEvent(new Event('teacher-auth-changed'))
        })
      }
      if (route.startsWith('/admin')) {
        await p.evaluate(() => localStorage.setItem('admin_token', 'demo_admin_token'))
      }
    },
  )
  await mobileContext.close()
  await browser.close()

  await 写清单(清单)
  console.log(`完成：生成 ${清单.filter((item) => item.文件名).length} 张截图`)
  console.log(输出目录)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
