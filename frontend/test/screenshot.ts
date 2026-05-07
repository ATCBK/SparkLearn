import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  // Auth page - 登录状态
  await page.goto('http://localhost:3000/auth')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: './screenshots/auth-login.png', fullPage: true })
  console.log('✓ auth-login.png')

  // Auth page - 注册状态
  await page.click('text=注册')
  await page.waitForTimeout(500)
  await page.screenshot({ path: './screenshots/auth-register.png', fullPage: true })
  console.log('✓ auth-register.png')

  // Onboarding - 等待打字机效果结束
  await page.goto('http://localhost:3000/onboarding')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: './screenshots/onboarding-step1.png', fullPage: true })
  console.log('✓ onboarding-step1.png')

  // Onboarding - 选中选项后
  await page.click('text=期末提分')
  await page.click('text=竞赛准备')
  await page.waitForTimeout(300)
  await page.screenshot({ path: './screenshots/onboarding-step1-selected.png', fullPage: true })
  console.log('✓ onboarding-step1-selected.png')

  // Onboarding - 点击下一步到第二步
  await page.click('text=下一步')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: './screenshots/onboarding-step2.png', fullPage: true })
  console.log('✓ onboarding-step2.png')

  // Onboarding - 跳到第五步（确认画像）
  await page.click('text=有一些基础')
  await page.waitForTimeout(300)
  await page.click('text=下一步')
  await page.waitForTimeout(2500)
  await page.click('text=视觉型')
  await page.waitForTimeout(300)
  await page.click('text=下一步')
  await page.waitForTimeout(2500)
  await page.click('text=30-60分钟')
  await page.waitForTimeout(300)
  await page.click('text=下一步')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: './screenshots/onboarding-step5-confirm.png', fullPage: true })
  console.log('✓ onboarding-step5-confirm.png')

  await browser.close()
  console.log('Done!')
}

main().catch((e) => { console.error(e); process.exit(1) })
