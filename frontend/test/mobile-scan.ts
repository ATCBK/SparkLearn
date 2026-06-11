import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const routes = ['/', '/profile', '/path', '/generate', '/practice', '/report', '/knowledge', '/video']

async function main() {
  const outDir = path.resolve('./screenshots/mobile-scan')
  await fs.mkdir(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

  for (const route of routes) {
    const url = `http://localhost:3000${route}`
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(1200)
      const name = route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')
      await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true })
      console.log(`[OK] ${route} ${resp?.status() ?? 'no-status'}`)
    } catch (e) {
      console.log(`[ERR] ${route} ${String(e)}`)
    }
  }

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
