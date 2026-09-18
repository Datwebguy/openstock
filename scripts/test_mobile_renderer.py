import asyncio
import os
from playwright.async_api import async_playwright

OUTPUT_DIR = "video_assets/promo_previews"

TIMESTAMPS = [
    ("scene_1_hero_entrance", 2.5),
    ("scene_2_trio_cascade", 7.2),
    ("scene_3_macro_focus", 12.0),
    ("scene_4_launch_studio", 16.5),
    ("scene_5_five_phone_fan", 22.0),
    ("scene_6_landscape_flip", 26.5),
    ("scene_7_outro_brand", 31.0),
]

async def capture_promo_previews():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    html_path = os.path.abspath("scripts/mobile_promo_renderer.html").replace("\\", "/")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        await page.goto(f"file:///{html_path}", wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(1000)

        for name, t in TIMESTAMPS:
            await page.evaluate(f"window.seekTime({t})")
            await page.wait_for_timeout(200)
            out_file = os.path.join(OUTPUT_DIR, f"{name}.jpg")
            await page.screenshot(path=out_file, type="jpeg", quality=95)
            print(f"[OK] Captured {out_file} at t={t}s")

        await browser.close()
        print("\nAll promo preview frames generated successfully!")

if __name__ == "__main__":
    asyncio.run(capture_promo_previews())
