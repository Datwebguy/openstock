import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const logoDir = path.resolve("public/logo");

const exportsList = [
  { file: "openstock-icon.svg", out: "openstock-icon.png", width: 512, height: 512, transparent: false },
  { file: "openstock-icon-transparent.svg", out: "openstock-icon-transparent.png", width: 512, height: 512, transparent: true },
  { file: "openstock-badge-mark.svg", out: "openstock-badge-mark.png", width: 256, height: 256, transparent: true },
  { file: "openstock-logo-horizontal-dark.svg", out: "openstock-logo-horizontal-dark.png", width: 1080, height: 240, transparent: false },
  { file: "openstock-logo-horizontal-light.svg", out: "openstock-logo-horizontal-light.png", width: 1080, height: 240, transparent: false },
  { file: "openstock-logo-horizontal-transparent.svg", out: "openstock-logo-horizontal-transparent.png", width: 1000, height: 160, transparent: true },
  { file: "openstock-logo-vertical-dark.svg", out: "openstock-logo-vertical-dark.png", width: 720, height: 720, transparent: false },
  { file: "openstock-logo-vertical-light.svg", out: "openstock-logo-vertical-light.png", width: 720, height: 720, transparent: false },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const item of exportsList) {
    const svgPath = path.join(logoDir, item.file);
    if (!fs.existsSync(svgPath)) continue;
    const svgContent = fs.readFileSync(svgPath, "utf-8");

    await page.setViewportSize({ width: item.width, height: item.height });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              width: ${item.width}px; 
              height: ${item.height}px; 
              overflow: hidden; 
              background: ${item.transparent ? "transparent" : "#07070D"};
              display: flex;
              align-items: center;
              justify-content: center;
            }
            svg {
              width: 100%;
              height: 100%;
              display: block;
            }
          </style>
        </head>
        <body>
          ${svgContent}
        </body>
      </html>
    `);

    const outPath = path.join(logoDir, item.out);
    await page.screenshot({ path: outPath, omitBackground: item.transparent });
    console.log(`Generated: ${item.out} (${item.width}x${item.height})`);
  }

  await browser.close();
  console.log("Logo PNG export completed successfully!");
}

main().catch(err => {
  console.error("Export failed:", err);
  process.exit(1);
});
