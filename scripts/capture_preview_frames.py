import asyncio
import os
from playwright.async_api import async_playwright

async def capture_previews():
    os.makedirs("video_assets/previews", exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        html_path = os.path.abspath("scripts/motion_renderer.html").replace("\\", "/")
        await page.goto(f"file:///{html_path}")
        await page.wait_for_timeout(1000)
        
        timestamps = [
            ("new_01_landing_hero", 2.5),
            ("new_02_market_desk", 6.8),
            ("new_03_trading_chart", 11.5),
            ("new_04_launch_studio", 16.2),
            ("new_05_community_curves", 21.2),
            ("new_06_portfolio_vaults", 25.2),
            ("new_07_brand_outro", 30.5)
        ]
        
        for name, t in timestamps:
            await page.evaluate(f"window.seekTime({t})")
            out_file = f"video_assets/previews/{name}.jpg"
            await page.screenshot(path=out_file, type="jpeg", quality=95)
            print(f"Captured {out_file} at t={t}s")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(capture_previews())
