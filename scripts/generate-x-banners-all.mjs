import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const width = 1500;
  const height = 500;
  await page.setViewportSize({ width, height });

  const bg1Base64 = fs.readFileSync(path.resolve("public/logo/nyse_bg_1.jpg")).toString("base64");
  const bg2Base64 = fs.readFileSync(path.resolve("public/logo/nyse_bg_2.jpg")).toString("base64");

  const variants = [
    {
      id: "openstock-x-banner-nyse-solana",
      title: "Solana Logo + Extended Wide Typography",
      bgData: `data:image/jpeg;base64,${bg2Base64}`,
      bgPos: "center 48%",
      bgFilter: "contrast(1.22) brightness(0.98) saturate(1.1)",
      logoType: "solana",
      fontFamily: "'Syncopate', 'Orbitron', sans-serif",
      fontSize: 104,
      letterSpacing: "0.14em",
      subLeft: "TOKENIZED EQUITIES · 24/7",
      subCenter: "NEW YORK · WALL STREET",
      subRight: "OPENSTOCK.APP",
    },
    {
      id: "openstock-x-banner-nyse-classic",
      title: "Drip Slit-Scan + Colonnade Frieze",
      bgData: `data:image/jpeg;base64,${bg1Base64}`,
      bgPos: "center 38%",
      bgFilter: "contrast(1.25) brightness(0.92) saturate(1.15)",
      logoType: "solana",
      fontFamily: "'Syncopate', 'Orbitron', sans-serif",
      fontSize: 104,
      letterSpacing: "0.14em",
      subLeft: "SOLANA MAINNET-BETA",
      subCenter: "NYSE · EQUITIES ON-CHAIN",
      subRight: "OPENSTOCK.APP",
    },
    {
      id: "openstock-x-banner-nyse-brandmark",
      title: "OpenStock Signature Brandmark + NYSE",
      bgData: `data:image/jpeg;base64,${bg2Base64}`,
      bgPos: "center 45%",
      bgFilter: "contrast(1.2) brightness(0.95)",
      logoType: "openstock",
      fontFamily: "'Syncopate', 'Orbitron', sans-serif",
      fontSize: 100,
      letterSpacing: "0.12em",
      subLeft: "TOKENIZED EQUITIES · 24/7",
      subCenter: "NEW YORK · WALL STREET",
      subRight: "OPENSTOCK.APP",
    }
  ];

  for (const v of variants) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@700;800&family=Orbitron:wght@800;900&family=Space+Mono:wght@700&family=Syncopate:wght@700&family=Syne:wght@800&display=swap" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              width: ${width}px;
              height: ${height}px;
              overflow: hidden;
              background: #07070D;
              position: relative;
            }

            /* Base Architectural Photography */
            .bg-layer {
              position: absolute;
              inset: 0;
              background-image: url('${v.bgData}');
              background-size: cover;
              background-position: ${v.bgPos};
              filter: ${v.bgFilter};
            }

            /* Duotone Breakpoint Purple Overlay */
            .duotone-grade {
              position: absolute;
              inset: 0;
              background: linear-gradient(180deg, 
                rgba(168, 85, 247, 0.42) 0%, 
                rgba(147, 51, 234, 0.30) 40%, 
                rgba(126, 34, 206, 0.45) 100%
              );
              mix-blend-mode: color;
              pointer-events: none;
            }

            /* Atmospheric Top Fade for pure text legibility */
            .top-ambient {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 220px;
              background: linear-gradient(180deg, rgba(7, 7, 13, 0.45) 0%, rgba(7, 7, 13, 0.1) 70%, transparent 100%);
              pointer-events: none;
            }

            /* Slit-Scan Vertical Slices */
            .glitch-slice {
              position: absolute;
              background-image: url('${v.bgData}');
              background-size: cover;
              pointer-events: none;
            }

            .slice-a {
              left: 210px;
              top: 0;
              width: 55px;
              height: 500px;
              background-position: calc(50% - 18px) calc(${v.bgPos.split(" ")[1]} + 15px);
              filter: contrast(1.35) brightness(1.25);
              border-left: 1px solid rgba(255, 255, 255, 0.35);
              border-right: 1px solid rgba(168, 85, 247, 0.4);
            }

            .slice-b {
              left: 490px;
              top: 0;
              width: 80px;
              height: 500px;
              background-position: calc(50% + 28px) calc(${v.bgPos.split(" ")[1]} - 22px);
              filter: contrast(1.4) brightness(1.3);
              border-left: 1.5px solid rgba(255, 255, 255, 0.55);
              border-right: 1.5px solid rgba(3, 225, 255, 0.6);
            }

            .slice-c {
              left: 780px;
              top: 0;
              width: 65px;
              height: 500px;
              background-position: calc(50% - 25px) calc(${v.bgPos.split(" ")[1]} + 18px);
              filter: contrast(1.3) brightness(1.2);
              border-left: 1px solid rgba(255, 255, 255, 0.4);
              border-right: 1px solid rgba(168, 85, 247, 0.3);
            }

            .slice-d {
              left: 1080px;
              top: 0;
              width: 90px;
              height: 500px;
              background-position: calc(50% + 35px) calc(${v.bgPos.split(" ")[1]} - 15px);
              filter: contrast(1.45) brightness(1.2);
              border-left: 1.5px solid rgba(255, 255, 255, 0.5);
              border-right: 1px solid rgba(3, 225, 255, 0.4);
            }

            /* Horizontal Shift Band */
            .slice-h {
              position: absolute;
              left: 0;
              top: 310px;
              width: 100%;
              height: 24px;
              background-image: url('${v.bgData}');
              background-size: cover;
              background-position: calc(50% + 30px) calc(${v.bgPos.split(" ")[1]} - 6px);
              filter: contrast(1.3) brightness(1.15);
              border-top: 1px solid rgba(255, 255, 255, 0.45);
              border-bottom: 1px solid rgba(168, 85, 247, 0.35);
            }

            /* Header Title Layout */
            .header-content {
              position: absolute;
              top: 32px;
              left: 44px;
              right: 44px;
              z-index: 50;
            }

            .headline-row {
              display: flex;
              align-items: center;
              gap: 26px;
              width: 100%;
            }

            .brand-svg-logo {
              width: 86px;
              height: 68px;
              flex-shrink: 0;
              filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6));
            }

            .headline-text {
              font-family: ${v.fontFamily};
              font-size: ${v.fontSize}px;
              font-weight: 700;
              color: #FFFFFF;
              letter-spacing: ${v.letterSpacing};
              line-height: 0.95;
              text-transform: uppercase;
              flex: 1;
              white-space: nowrap;
              text-shadow: 0 4px 20px rgba(0, 0, 0, 0.85), 0 0 40px rgba(168, 85, 247, 0.4);
            }

            /* Sub-Row with Monospaced Metadata */
            .sub-meta-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-top: 18px;
              padding: 0 4px;
              font-family: 'Space Mono', monospace;
              font-size: 17px;
              font-weight: 700;
              color: #FFFFFF;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              text-shadow: 0 2px 8px rgba(0, 0, 0, 0.95);
            }

            .sub-item-left {
              text-align: left;
            }

            .sub-item-center {
              text-align: center;
            }

            .sub-item-right {
              text-align: right;
            }

            /* Overlay Glitch Artifact on Typography */
            .type-glitch-overlay {
              position: absolute;
              left: 500px;
              top: 25px;
              width: 70px;
              height: 120px;
              background: rgba(255, 255, 255, 0.15);
              mix-blend-mode: overlay;
              pointer-events: none;
              border-left: 1px solid rgba(255, 255, 255, 0.6);
            }
          </style>
        </head>
        <body>
          <div class="bg-layer"></div>
          <div class="duotone-grade"></div>
          
          <!-- Slit-scan vertical glitches -->
          <div class="glitch-slice slice-a"></div>
          <div class="glitch-slice slice-b"></div>
          <div class="glitch-slice slice-c"></div>
          <div class="glitch-slice slice-d"></div>
          <div class="slice-h"></div>
          <div class="top-ambient"></div>

          <!-- Main Header -->
          <div class="header-content">
            <div class="headline-row">
              ${
                v.logoType === "solana"
                  ? `<svg class="brand-svg-logo" viewBox="0 0 397 311" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="#FFFFFF"/>
                      <path d="M64.6 3.8C67 1.4 70.3 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="#FFFFFF"/>
                      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="#FFFFFF"/>
                    </svg>`
                  : `<svg class="brand-svg-logo" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M40 0 H88 A40 40 0 0 1 128 40 V88 A40 40 0 0 1 88 128 H10 A10 10 0 0 1 0 118 V40 A40 40 0 0 1 40 0 Z" fill="#FFFFFF"/>
                      <g transform="translate(64, 64)">
                        <circle cx="0" cy="0" r="32" fill="none" stroke="#07070D" stroke-width="8" />
                        <path d="M-32 0 A32 32 0 0 0 32 0 Z" fill="#07070D" />
                      </g>
                    </svg>`
              }
              <div class="headline-text">OPENSTOCK</div>
            </div>

            <div class="sub-meta-row">
              <div class="sub-item-left">${v.subLeft}</div>
              <div class="sub-item-center">${v.subCenter}</div>
              <div class="sub-item-right">${v.subRight}</div>
            </div>
          </div>

          <div class="type-glitch-overlay"></div>
        </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // 1. Standard 1500x500 export
    const out1500 = path.resolve(`public/logo/${v.id}-1500x500.png`);
    await page.screenshot({ path: out1500 });
    console.log(`Saved: ${v.id}-1500x500.png`);

    // 2. High-DPI Retina 3000x1000 export
    await page.setViewportSize({ width: 3000, height: 1000 });
    // Scale body for 3000x1000
    await page.evaluate(() => {
      document.body.style.transformOrigin = "top left";
      document.body.style.transform = "scale(2)";
    });
    const out3000 = path.resolve(`public/logo/${v.id}-3000x1000.png`);
    await page.screenshot({ path: out3000 });
    console.log(`Saved Retina: ${v.id}-3000x1000.png`);

    // Reset viewport for next iteration
    await page.setViewportSize({ width, height });
  }

  await browser.close();
  console.log("All X Cover variations generated successfully!");
}

run().catch(console.error);
