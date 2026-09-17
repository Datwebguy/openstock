import asyncio
from playwright.async_api import async_playwright

async def recapture():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
        await page.goto("http://localhost:3000", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        # Screenshot the landing hero area
        await page.screenshot(path="video_assets/actual_screens/01_landing.png")
        print("Captured 01_landing.png successfully")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(recapture())
