import asyncio
from playwright.async_api import async_playwright

async def screenshot():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto("file:///D:/Project_building/SparkLearn/ui-prototypes/homepage.html")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="D:/Project_building/SparkLearn/ui-prototypes/homepage-screenshot.png", full_page=True)
        await browser.close()
        print("Screenshot saved!")

asyncio.run(screenshot())
