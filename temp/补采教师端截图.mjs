import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const 根目录 = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const 前端目录 = path.join(根目录, 'frontend')
const 输出目录 = path.join(根目录, 'docs', '用户使用手册截图')
const 基础地址 = process.env.SPARKLEARN_BASE_URL || 'http://127.0.0.1:3000'
const requireFromFrontend = createRequire(path.join(前端目录, 'package.json'))
const { chromium } = requireFromFrontend('playwright')

const 教师业务页 = [
  ['061-教师端-数据看板-桌面端.png', '/teacher/dashboard'],
  ['062-教师端-工作台入口-桌面端.png', '/teacher'],
  ['063-教师端-学科管理-桌面端.png', '/teacher/subjects'],
  ['064-教师端-学生列表-桌面端.png', '/teacher/students'],
  ['065-教师端-学生详情演示-桌面端.png', '/teacher/students/demo'],
  ['066-教师端-干预中心-桌面端.png', '/teacher/interventions'],
  ['067-教师端-通知分发-桌面端.png', '/teacher/broadcast'],
  ['068-教师端-AI助手-桌面端.png', '/teacher/ai'],
  ['069-教师端-学习报告-桌面端.png', '/teacher/reports'],
]

async function 等待页面稳定(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(1000)
}

async function 教师登录(page) {
  await page.goto(`${基础地址}/teacher/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await 等待页面稳定(page)
  await page.locator('input').nth(0).fill('teacher')
  await page.locator('input').nth(1).fill('123456')
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL('**/teacher/dashboard', { timeout: 15000 })
  await 等待页面稳定(page)
}

async function main() {
  await fs.mkdir(输出目录, { recursive: true })
  const browser = await chromium.launch({ headless: true })

  for (const [文件名, route] of 教师业务页) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 920 },
      deviceScaleFactor: 1,
      locale: 'zh-CN',
    })
    const page = await context.newPage()
    await 教师登录(page)
    if (route === '/teacher') {
      await page.goto(`${基础地址}/teacher`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await 等待页面稳定(page)
    } else if (route === '/teacher/dashboard') {
      await 等待页面稳定(page)
    } else if (route === '/teacher/students/demo') {
      await page.locator('a[href="/teacher/students"]').first().click()
      await page.waitForURL('**/teacher/students', { timeout: 15000 })
      await 等待页面稳定(page)
      const detailLinks = page.locator('a[href^="/teacher/students/"]')
      if (await detailLinks.count()) {
        await detailLinks.first().click()
        await page.waitForURL('**/teacher/students/*', { timeout: 15000 }).catch(() => {})
        await 等待页面稳定(page)
      }
    } else {
      await page.locator(`a[href="${route}"]`).first().click()
      await page.waitForURL(`**${route}`, { timeout: 15000 })
      await 等待页面稳定(page)
    }
    await page.screenshot({
      path: path.join(输出目录, 文件名),
      fullPage: true,
      animations: 'disabled',
    })
    await context.close()
    console.log(`已补采：${文件名}`)
  }

  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
