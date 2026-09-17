import asyncio
import time
from playwright.async_api import async_playwright
import os

async def test_speed():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        html_path = os.path.abspath("scripts/motion_renderer.html").replace("\\", "/")
        await page.goto(f"file:///{html_path}")
        await page.wait_for_timeout(500)
        
        t0 = time.time()
        for i in range(10):
            t = i * (1.0 / 30.0)
            await page.evaluate(f"window.seekTime({t})")
            # capture screenshot
            _ = await page.screenshot(type="jpeg", quality=90)
        t1 = time.time()
        fps = 10.0 / (t1 - t0)
        print(f"Render speed: {fps:.2f} frames per second")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_speed())
