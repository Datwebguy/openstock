import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function generateBanner() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Standard 3:1 Twitter/X banner size
  const width = 1500;
  const height = 500;
  await page.setViewportSize({ width, height });

  const bgBase64 = fs.readFileSync(path.resolve("public/logo/nyse_bg_1.jpg")).toString("base64");
  const bgDataUrl = `data:image/jpeg;base64,${bgBase64}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@700&family=Orbitron:wght@800;900&family=Space+Mono:wght@700&family=Syncopate:wght@700&family=Syne:wght@800&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
            background: #07070D;
            position: relative;
            font-family: 'Orbitron', -apple-system, sans-serif;
          }

          /* Architectural Background */
          .bg-layer {
            position: absolute;
            inset: 0;
            background-image: url('${bgDataUrl}');
            background-size: cover;
            background-position: center 28%;
            filter: contrast(1.15) brightness(0.95);
          }

          /* Duotone Purple Overlay to match Breakpoint purple tone */
          .duotone-tint {
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(147, 51, 234, 0.45) 0%, rgba(124, 58, 237, 0.25) 50%, rgba(109, 40, 217, 0.5) 100%);
            mix-blend-mode: color;
          }

          .vignette {
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 50% 40%, transparent 40%, rgba(7, 7, 13, 0.6) 100%);
            pointer-events: none;
          }

          /* Slit-Scan Displacement Glitch Strips */
          .glitch-strip {
            position: absolute;
            background-image: url('${bgDataUrl}');
            background-size: cover;
            background-position: center 28%;
            filter: contrast(1.3) brightness(1.1);
            mix-blend-mode: screen;
            opacity: 0.85;
          }

          .strip-1 {
            left: 280px;
            top: 60px;
            width: 48px;
            height: 380px;
            background-position: calc(50% - 20px) 35%;
            filter: contrast(1.4) brightness(1.2) hue-rotate(15deg);
            border-left: 1px solid rgba(255, 255, 255, 0.3);
            border-right: 1px solid rgba(153, 69, 255, 0.4);
          }

          .strip-2 {
            left: 540px;
            top: 20px;
            width: 72px;
            height: 440px;
            background-position: calc(50% + 40px) 24%;
            filter: contrast(1.5) brightness(1.3);
            border-left: 1.5px solid rgba(255, 255, 255, 0.5);
            border-right: 1.5px solid rgba(3, 225, 255, 0.6);
          }

          .strip-3 {
            left: 880px;
            top: 80px;
            width: 56px;
            height: 360px;
            background-position: calc(50% - 35px) 32%;
            filter: contrast(1.4) brightness(1.25);
            border-left: 1px solid rgba(255, 255, 255, 0.4);
            border-right: 1px solid rgba(153, 69, 255, 0.5);
          }

          .strip-4 {
            left: 1120px;
            top: 40px;
            width: 84px;
            height: 400px;
            background-position: calc(50% + 50px) 26%;
            filter: contrast(1.5) brightness(1.15);
            border-left: 1.5px solid rgba(255, 255, 255, 0.4);
          }

          /* Horizontal Glitch Shift Line */
          .horizontal-slice {
            position: absolute;
            left: 0;
            top: 240px;
            width: 100%;
            height: 16px;
            background-image: url('${bgDataUrl}');
            background-size: cover;
            background-position: calc(50% + 25px) calc(28% - 5px);
            opacity: 0.9;
            mix-blend-mode: hard-light;
            border-top: 1px solid rgba(255, 255, 255, 0.4);
            border-bottom: 1px solid rgba(153, 69, 255, 0.3);
          }

          /* Header Container */
          .header-bar {
            position: absolute;
            top: 36px;
            left: 48px;
            right: 48px;
            z-index: 20;
          }

          .brand-title-row {
            display: flex;
            align-items: center;
            gap: 24px;
            margin-bottom: 16px;
          }

          .solana-icon {
            width: 72px;
            height: 56px;
            flex-shrink: 0;
          }

          .brand-name {
            font-family: 'Orbitron', 'Syncopate', sans-serif;
            font-size: 82px;
            font-weight: 900;
            color: #FFFFFF;
            letter-spacing: 0.06em;
            line-height: 1;
            text-transform: uppercase;
            text-shadow: 0 4px 24px rgba(0, 0, 0, 0.8), 0 0 40px rgba(153, 69, 255, 0.4);
          }

          /* Meta Sub-Bar */
          .meta-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding-top: 8px;
            font-family: 'Space Mono', monospace;
            font-size: 16px;
            font-weight: 700;
            color: #FFFFFF;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);
          }

          .meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .meta-item.center {
            text-align: center;
          }

          .meta-item.right {
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div class="bg-layer"></div>
        <div class="duotone-tint"></div>
        
        <!-- Glitch displacement strips -->
        <div class="glitch-strip strip-1"></div>
        <div class="glitch-strip strip-2"></div>
        <div class="glitch-strip strip-3"></div>
        <div class="glitch-strip strip-4"></div>
        <div class="horizontal-slice"></div>

        <div class="vignette"></div>

        <!-- Foreground Typography -->
        <div class="header-bar">
          <div class="brand-title-row">
            <svg class="solana-icon" viewBox="0 0 397 311" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="#FFFFFF"/>
              <path d="M64.6 3.8C67 1.4 70.3 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="#FFFFFF"/>
              <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="#FFFFFF"/>
            </svg>
            <h1 class="brand-name">OPENSTOCK</h1>
          </div>

          <div class="meta-row">
            <div class="meta-item">TOKENIZED EQUITIES · 24/7</div>
            <div class="meta-item center">NEW YORK · WALL STREET</div>
            <div class="meta-item right">OPENSTOCK.APP</div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000); // Allow fonts to render smoothly

  const outPath = path.resolve("public/logo/test_banner_v1.png");
  await page.screenshot({ path: outPath });
  await browser.close();
  console.log("Draft banner generated at:", outPath);
}

generateBanner().catch(console.error);
