import { chromium } from "playwright";

async function testAll() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const routes = [
    { path: "/app", name: "Market", headingSelector: ".workspace-heading" },
    { path: "/app/community", name: "Memes & Pairs", headingSelector: ".workspace-heading" },
    { path: "/launch", name: "Launch", headingSelector: ".launch-intro, .launch-container" },
    { path: "/app/orders", name: "Orders", headingSelector: ".workspace-heading" },
    { path: "/app/portfolio", name: "Portfolio", headingSelector: ".portfolio-hero-card, .portfolio-container" },
    { path: "/app/analytics", name: "Analytics", headingSelector: ".workspace-heading" },
    { path: "/app/wallet", name: "Wallet", headingSelector: ".history-header" },
  ];

  const viewports = [
    { name: "Desktop (1280px)", width: 1280, height: 900 },
    { name: "Tablet (820px)", width: 820, height: 900 },
    { name: "Mobile (390px)", width: 390, height: 844 },
  ];

  console.log("=== TESTING ROUTE SPACING & CLEARANCE ===");
  let failures = 0;

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const theme of ["light", "dark"]) {
      for (const route of routes) {
        await page.goto("http://localhost:3000" + route.path, { waitUntil: "domcontentloaded" });
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.waitForTimeout(200);

        const navBox = await page.locator(".nav").boundingBox();
        const contentBox = await page.locator(route.headingSelector).first().boundingBox();

        if (!navBox || !contentBox) {
          console.error(`[${vp.name}][${theme}][${route.name}] Element not found! (nav=${Boolean(navBox)}, content=${Boolean(contentBox)})`);
          failures++;
          continue;
        }

        const navBottom = navBox.y + navBox.height;
        const contentTop = contentBox.y;
        const clearance = contentTop - navBottom;

        if (clearance < 0) {
          console.error(`FAIL: [${vp.name}][${theme}][${route.name}] OVERLAP! navBottom=${navBottom}, contentTop=${contentTop}`);
          failures++;
        } else {
          console.log(`PASS: [${vp.name}][${theme}][${route.name}] Clear by ${clearance.toFixed(1)}px (navBottom=${navBottom.toFixed(0)}, top=${contentTop.toFixed(0)})`);
        }
      }
    }
  }

  // Test Market page table data
  console.log("\n=== TESTING MARKET TABLE DATA ===");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://localhost:3000/app", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  const rows = await page.locator(".trends-table tbody tr").all();
  console.log("Total table rows rendered:", rows.length);

  const sampleRows = [];
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    const asset = await row.locator(".trends-asset-symbol").textContent();
    const price = await row.locator(".trends-price-val").textContent();
    const change = await row.locator(".trends-td--change").textContent();
    const volume = await row.locator(".trends-td--volume").textContent();
    const liquidity = await row.locator(".trends-td--liquidity").textContent();
    sampleRows.push({ asset: asset?.trim(), price: price?.trim(), change: change?.trim(), volume: volume?.trim(), liquidity: liquidity?.trim() });
  }
  console.log("Top rows data sample:");
  console.table(sampleRows);

  console.log("\nTest completed. Total clearance failures:", failures);
  await browser.close();
}

testAll().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
