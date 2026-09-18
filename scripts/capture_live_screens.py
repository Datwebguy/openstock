import asyncio
import os
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("OPENSTOCK_URL", "http://localhost:3005")
OUTPUT_DIR = "video_assets/mobile_screens"

SCREENS = [
    {
        "id": "01_home_hero",
        "url": f"{BASE_URL}/",
        "wait_for": ".os-hero, h1",
        "scroll": 0
    },
    {
        "id": "02_market_discovery",
        "url": f"{BASE_URL}/app",
        "wait_for": ".trends-table, .market-discovery, h1",
        "scroll": 0
    },
    {
        "id": "03_asset_nvdax",
        "url": f"{BASE_URL}/app/asset/NVDAx",
        "wait_for": ".pro-asset-header, h1",
        "scroll": 0
    },
    {
        "id": "04_launch_studio",
        "url": f"{BASE_URL}/launch?symbol=NVDAx",
        "wait_for": ".launch-card, .launch-studio, h1",
        "scroll": 0
    },
    {
        "id": "05_community_radar",
        "url": f"{BASE_URL}/app/community",
        "wait_for": ".graduation-radar-section, .community-market-section, h1",
        "scroll": 0
    },
    {
        "id": "06_automation_orders",
        "url": f"{BASE_URL}/app/automation",
        "wait_for": ".automation-container, h1, .panel",
        "scroll": 0
    },
    {
        "id": "07_portfolio_desk",
        "url": f"{BASE_URL}/app/portfolio",
        "wait_for": ".portfolio-container, h1, .panel",
        "scroll": 0
    }
]

async def capture_mobile_screens():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs("video_assets/desktop_screens", exist_ok=True)

    async with async_playwright() as p:
        # iPhone 15 Pro mobile viewport specs
        mobile_device = p.devices["iPhone 15 Pro"]
        browser = await p.chromium.launch(headless=True)
        
        context = await browser.new_context(
            **mobile_device,
            color_scheme="dark"
        )
        page = await context.new_page()

        print(f"--- Capturing Mobile Screens from {BASE_URL} ---")
        for item in SCREENS:
            target_file = os.path.join(OUTPUT_DIR, f"{item['id']}.png")
            print(f"Navigating to {item['url']}...")
            try:
                await page.goto(item['url'], wait_until="networkidle", timeout=30000)
            except Exception as e:
                print(f"Network idle timeout on {item['url']}, proceeding with domcontentloaded...")
                await page.goto(item['url'], wait_until="domcontentloaded", timeout=20000)
            
            await page.wait_for_timeout(2500)
            
            if item.get("scroll", 0) > 0:
                await page.evaluate(f"window.scrollTo(0, {item['scroll']})")
                await page.wait_for_timeout(800)

            # Clean capture of current viewport
            await page.screenshot(path=target_file, full_page=False)
            print(f"[OK] Saved mobile screen: {target_file}")

        # Also capture desktop 1920x1080 version
        print("\n--- Capturing Desktop Overview Screens ---")
        desktop_page = await browser.new_page(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=2,
            color_scheme="dark"
        )
        
        desktop_targets = [
            ("desktop_01_home", f"{BASE_URL}/"),
            ("desktop_02_app", f"{BASE_URL}/app"),
            ("desktop_03_launch", f"{BASE_URL}/launch?symbol=NVDAx"),
            ("desktop_04_asset_nvda", f"{BASE_URL}/app/asset/NVDAx"),
            ("desktop_05_community", f"{BASE_URL}/app/community")
        ]
        
        for name, url in desktop_targets:
            dest = os.path.join("video_assets/desktop_screens", f"{name}.png")
            print(f"Capturing desktop {url}...")
            try:
                await desktop_page.goto(url, wait_until="networkidle", timeout=30000)
            except Exception:
                await desktop_page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await desktop_page.wait_for_timeout(2500)
            await desktop_page.screenshot(path=dest, full_page=False)
            print(f"[OK] Saved desktop screen: {dest}")

        await browser.close()
        print("\nAll screen captures successfully complete!")

if __name__ == "__main__":
    asyncio.run(capture_mobile_screens())
