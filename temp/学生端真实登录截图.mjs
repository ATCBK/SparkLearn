import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const 根目录 = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const 前端目录 = path.join(根目录, 'frontend')
const 后端目录 = path.join(根目录, 'backend')
const 输出目录 = path.join(根目录, 'docs', '用户使用手册截图')
const 基础地址 = process.env.SPARKLEARN_BASE_URL || 'http://127.0.0.1:3000'
const 手机号 = '13800000000'

const requireFromFrontend = createRequire(path.join(前端目录, 'package.json'))
const { chromium } = requireFromFrontend('playwright')

function python(code) {
  return execFileSync('python', ['-c', code], {
    cwd: 后端目录,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function 准备演示学生() {
  python(`
from app.db import init_db, execute, fetch_one, now_iso
from app.config import settings
phone = "${手机号}"
init_db()
user = fetch_one("SELECT user_id FROM students WHERE user_id = ?", (settings.single_user_id,))
ts = now_iso()
if not user:
    execute(
        "INSERT INTO students(user_id, name, phone, email, major, grade, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (settings.single_user_id, "张同学", phone, "student@sparklearn.ai", "Python", "大二", ts, ts),
    )
else:
    execute(
        "UPDATE students SET phone = ?, name = COALESCE(NULLIF(name, ''), '张同学'), updated_at = ? WHERE user_id = ?",
        (phone, ts, settings.single_user_id),
    )
execute("DELETE FROM sms_codes WHERE phone = ?", (phone,))
print(settings.single_user_id)
`)
}

function 读取最新验证码() {
  return python(`
from app.db import fetch_one
row = fetch_one(
    "SELECT code FROM sms_codes WHERE phone = ? AND purpose = 'login' AND used = 0 ORDER BY created_at DESC LIMIT 1",
    ("${手机号}",),
)
print(row["code"] if row else "")
`)
}

function 清理验证码() {
  python(`
from app.db import execute
execute("DELETE FROM sms_codes WHERE phone = ?", ("${手机号}",))
`)
}

async function 等待页面稳定(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(900)
}

async function 截图(page, 文件名, 清单, 说明) {
  await 等待页面稳定(page)
  const 文件路径 = path.join(输出目录, 文件名)
  await page.screenshot({ path: 文件路径, fullPage: true, animations: 'disabled' })
  清单.push({ 文件名, 地址: page.url(), 说明 })
}

async function main() {
  await fs.mkdir(输出目录, { recursive: true })
  准备演示学生()

  const browser = await chromium.launch({ headless: true })
  const 清单 = []

  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 920 },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
  })
  const page = await desktop.newPage()
  await page.goto(`${基础地址}/auth`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.evaluate(() => {
    localStorage.removeItem('sparklearn_token')
    localStorage.removeItem('sparklearn_user')
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await 截图(page, '104-学生端真实登录-登录页默认状态-桌面端.png', 清单, '未登录状态进入学生端登录页')

  await page.locator('input[type="tel"]').fill(手机号)
  await 截图(page, '105-学生端真实登录-输入手机号后-桌面端.png', 清单, '真实填写学生手机号')

  await page.locator('button.send-code-btn').click()
  await page.waitForTimeout(1200)
  const code = 读取最新验证码()
  if (!code) throw new Error('未能从本地数据库读取验证码')
  await page.locator('input[autocomplete="one-time-code"]').fill(code)
  await 截图(page, '106-学生端真实登录-输入验证码后-桌面端.png', 清单, `点击获取验证码后，从本地短信记录读取验证码 ${code}`)

  await page.locator('form button[type="submit"]').click()
  await page.waitForTimeout(3000)
  await 等待页面稳定(page)
  await 截图(page, '107-学生端真实登录-登录成功落地页-桌面端.png', 清单, '点击立即登录后的真实跳转结果')

  const 页面 = [
    ['108-学生端真实登录-首页总览-桌面端.png', '/'],
    ['109-学生端真实登录-学习画像-桌面端.png', '/profile'],
    ['110-学生端真实登录-学习路径-桌面端.png', '/path'],
    ['111-学生端真实登录-资源中心-桌面端.png', '/generate'],
    ['112-学生端真实登录-练习评测-桌面端.png', '/practice'],
    ['113-学生端真实登录-学习报告-桌面端.png', '/report'],
  ]
  for (const [文件名, route] of 页面) {
    await page.goto(`${基础地址}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await 截图(page, 文件名, 清单, `真实登录后访问 ${route}`)
  }

  await desktop.close()

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 2,
    locale: 'zh-CN',
  })
  const mobilePage = await mobile.newPage()
  清理验证码()
  await mobilePage.goto(`${基础地址}/auth`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await mobilePage.evaluate(() => {
    localStorage.removeItem('sparklearn_token')
    localStorage.removeItem('sparklearn_user')
    sessionStorage.clear()
  })
  await mobilePage.reload({ waitUntil: 'domcontentloaded' })
  await 截图(mobilePage, '114-学生端真实登录-登录页默认状态-移动端.png', 清单, '移动端未登录状态')
  await mobilePage.locator('input[type="tel"]').fill(手机号)
  await mobilePage.locator('button.send-code-btn').click({ force: true })
  await mobilePage.waitForTimeout(1200)
  const mobileCode = 读取最新验证码()
  await mobilePage.locator('input[autocomplete="one-time-code"]').fill(mobileCode)
  await 截图(mobilePage, '115-学生端真实登录-输入验证码后-移动端.png', 清单, '移动端真实填写手机号和验证码')
  await mobilePage.locator('form button[type="submit"]').click()
  await mobilePage.waitForTimeout(2500)
  await 截图(mobilePage, '116-学生端真实登录-登录成功落地页-移动端.png', 清单, '移动端点击登录后的真实跳转结果')
  await mobilePage.goto(`${基础地址}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await 截图(mobilePage, '117-学生端真实登录-首页总览-移动端.png', 清单, '移动端真实登录后首页')
  await mobile.close()

  await browser.close()

  const lines = [
    '# 学生端真实登录截图清单',
    '',
    `- 采集时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    `- 手机号：${手机号}`,
    `- 说明：通过登录页真实点击获取验证码、填写验证码并登录；验证码来自本地开发短信记录。`,
    '',
    '| 文件 | 地址 | 说明 |',
    '|---|---|---|',
    ...清单.map((item) => `| [${item.文件名}](./${encodeURI(item.文件名)}) | ${item.地址} | ${item.说明} |`),
  ]
  await fs.writeFile(path.join(输出目录, '学生端真实登录截图清单.md'), lines.join('\n'), 'utf8')
  console.log(`完成：生成 ${清单.length} 张学生端真实登录截图`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
