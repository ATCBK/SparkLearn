import asyncio
from playwright.async_api import async_playwright

FILES = [
    ("homepage-v2.html", "homepage"),
]

async def screenshots():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for html_file, label in FILES:
            page = await browser.new_page(viewport={"width": 1440, "height": 900})
            await page.goto(f"file:///D:/Project_building/SparkLearn/ui-prototypes/{html_file}")
            await page.wait_for_timeout(1500)
            await page.screenshot(
                path=f"D:/Project_building/SparkLearn/ui-prototypes/screenshot-{label}.png",
                full_page=True
            )
            await page.close()
            print(f"Screenshot saved: screenshot-{label}.png")
        await browser.close()
        print("All screenshots saved!")

asyncio.run(screenshots())
