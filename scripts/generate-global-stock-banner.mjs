import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function run() {
  console.log("Launching Chromium via Playwright...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const width = 1500;
  const height = 500;
  await page.setViewportSize({ width, height });

  const bgPath = path.resolve("public/logo/nyse_bg_2.jpg");
  const bgBase64 = fs.readFileSync(bgPath).toString("base64");
  const bgDataUrl = `data:image/jpeg;base64,${bgBase64}`;

  // User-specified exact logo file: public/logo/openstock-icon-transparent.png
  const logoPath = path.resolve("public/logo/openstock-icon-transparent.png");
  const logoBase64 = fs.readFileSync(logoPath).toString("base64");
  const logoDataUrl = `data:image/png;base64,${logoBase64}`;

  const stockLogos = {
    apple: "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.56-.69.95-1.64.84-2.61-.85.04-1.85.57-2.43 1.26-.52.6-.97 1.57-.85 2.51.94.07 1.88-.47 2.44-1.16z",
    nvidia: "M12.016 1.705a10.29 10.29 0 0 0-3.328.607c-.438.163-.859.366-1.266.602l.668 1.488a8.88 8.88 0 0 1 3.926-.801c3.82 0 6.633 2.766 6.633 6.477 0 2.227-1.094 4.086-2.922 5.023l.773 1.574c2.473-1.254 3.945-3.758 3.945-6.597 0-4.707-3.66-8.371-8.43-8.371zm-4.73 2.77c-.504.383-.957.836-1.348 1.344l1.199 1.137c.297-.375.641-.707 1.02-.988zm-2.035 2.281c-.34.469-.613.988-.816 1.547l1.457.707c.148-.41.348-.797.598-1.148zm-1.094 2.445a6.45 6.45 0 0 0-.258 1.828c0 .762.133 1.492.375 2.176l1.508-.668a4.99 4.99 0 0 1-.289-1.508c0-.523.09-.996.246-1.426zm.555 3.754c.285.547.668 1.031 1.129 1.43l1.109-1.23a4.7 4.7 0 0 1-.84-1.07zm1.883 2.195c.504.398 1.078.711 1.707.91l.57-1.516a4.8 4.8 0 0 1-1.258-.672zm2.59.98c.594.137 1.219.207 1.852.207a6.6 6.6 0 0 0 4.195-1.492l-1.09-1.258a4.95 4.95 0 0 1-3.105 1.148 4.9 4.9 0 0 1-1.387-.199z",
    tesla: "M12 2.5a.6.6 0 0 0-.17.02C8.36 3.53 4.2 6.03.02 11.23l2.25 1.95c3.08-3.76 6.08-5.32 8.78-5.74v14.07h2.02V7.44c2.7.42 5.7 1.98 8.78 5.74l2.25-1.95C19.92 6.03 15.76 3.53 12.29 2.52a.6.6 0 0 0-.29-.02zM12 0a18.3 18.3 0 0 0-8.6 2.05l.98 2.05a16.2 16.2 0 0 1 7.62-1.8c2.8 0 5.4.67 7.62 1.8l.98-2.05A18.3 18.3 0 0 0 12 0z",
    google: "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z",
    meta: "M12 3.68c-5.83 0-8.9 4.35-8.9 8.32 0 4.96 4.3 8.32 8.9 8.32 4.07 0 6.42-2.18 7.62-3.89l-2.07-1.4c-.9.99-2.6 2.39-5.55 2.39-3.23 0-6.1-2.47-6.1-5.42 0-3.37 3.07-5.42 6.1-5.42 2.65 0 4.47 1.25 5.53 2.39l2.09-1.4C18.42 5.86 16.07 3.68 12 3.68z",
    amazon: "M2.4 16.2c2.9 2.15 7.05 3.45 11.35 3.45 2.7 0 5.85-.75 8.35-2.2.38-.22.1-.66-.32-.46-2.4 1.28-5.5 2.05-8.03 2.05-3.75 0-7.45-1.2-10.3-3.25-.28-.2-.52.16-.05.41z M20.7 15.35c-.2-.24-.55-.1-.72.1l-.1.95c0 .7.16 1.45.5 2 .1.16.02.22.2.12 1.4-.4 2.45-1.05 3.35-1.85.14-.12.04-.26-.1-.24-.85.55-1.9 1.15-3.15 1.45.02-.55-.02-1.35-.08-2.53z",
    coinbase: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13z"
  };

  const template = (style) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@800;900&family=Orbitron:wght@800;900&family=Space+Mono:wght@700&family=Syncopate:wght@700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
            background: #07070D;
            position: relative;
          }

          /* Architectural Classical Facade */
          .bg-layer {
            position: absolute;
            inset: 0;
            background-image: url('${bgDataUrl}');
            background-size: cover;
            background-position: center 46%;
            filter: contrast(1.26) brightness(0.96) saturate(1.18);
          }

          /* Electric Solana Violet / Purple Duotone Grading */
          .duotone-grade {
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, 
              rgba(168, 85, 247, 0.40) 0%, 
              rgba(147, 51, 234, 0.28) 40%, 
              rgba(126, 34, 206, 0.48) 100%
            );
            mix-blend-mode: color;
            pointer-events: none;
          }

          /* Top Sky Ambient Gradient for Razor-Sharp Text Legibility */
          .top-ambient {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 220px;
            background: linear-gradient(180deg, rgba(7, 7, 13, 0.55) 0%, rgba(7, 7, 13, 0.18) 75%, transparent 100%);
            pointer-events: none;
            z-index: 20;
          }

          /* Slit-Scan Vertical Glitch Slices (placed behind frieze & text) */
          .glitch-slice {
            position: absolute;
            background-image: url('${bgDataUrl}');
            background-size: cover;
            pointer-events: none;
            z-index: 5;
          }

          .slice-1 {
            left: 210px;
            top: 0;
            width: 50px;
            height: 500px;
            background-position: calc(50% - 20px) 44%;
            filter: contrast(1.4) brightness(1.22);
            border-left: 1px solid rgba(255, 255, 255, 0.4);
            border-right: 1px solid rgba(168, 85, 247, 0.4);
          }

          .slice-2 {
            left: 510px;
            top: 0;
            width: 75px;
            height: 500px;
            background-position: calc(50% + 24px) 48%;
            filter: contrast(1.45) brightness(1.28);
            border-left: 1.5px solid rgba(255, 255, 255, 0.55);
            border-right: 1.5px solid rgba(3, 225, 255, 0.6);
          }

          .slice-3 {
            left: 770px;
            top: 0;
            width: 60px;
            height: 500px;
            background-position: calc(50% - 28px) 43%;
            filter: contrast(1.35) brightness(1.2);
            border-left: 1px solid rgba(255, 255, 255, 0.4);
            border-right: 1px solid rgba(168, 85, 247, 0.35);
          }

          .slice-4 {
            left: 1080px;
            top: 0;
            width: 85px;
            height: 500px;
            background-position: calc(50% + 32px) 49%;
            filter: contrast(1.4) brightness(1.2);
            border-left: 1.5px solid rgba(255, 255, 255, 0.5);
            border-right: 1.5px solid rgba(3, 225, 255, 0.4);
          }

          .slice-h {
            position: absolute;
            left: 0;
            top: 320px;
            width: 100%;
            height: 24px;
            background-image: url('${bgDataUrl}');
            background-size: cover;
            background-position: calc(50% + 30px) 44%;
            filter: contrast(1.35) brightness(1.15);
            border-top: 1px solid rgba(255, 255, 255, 0.45);
            border-bottom: 1px solid rgba(168, 85, 247, 0.35);
            z-index: 6;
          }

          /* Frieze Banner: GLOBAL STOCK EXCHANGE */
          .frieze-banner {
            position: absolute;
            left: 310px;
            top: 198px;
            width: 880px;
            height: 42px;
            background: linear-gradient(180deg, rgba(30, 20, 50, 0.88) 0%, rgba(15, 10, 25, 0.95) 100%);
            border-top: 2px solid rgba(255, 255, 255, 0.4);
            border-bottom: 2px solid rgba(0, 0, 0, 0.85);
            box-shadow: 0 4px 18px rgba(0, 0, 0, 0.8), inset 0 0 15px rgba(168, 85, 247, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 22;
          }

          /* Mask lower architrave residual text */
          .architrave-mask {
            position: absolute;
            left: 350px;
            top: 314px;
            width: 800px;
            height: 18px;
            background: linear-gradient(180deg, rgba(20, 10, 35, 0.95) 0%, rgba(10, 5, 20, 0.98) 100%);
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            border-bottom: 1px solid rgba(0, 0, 0, 0.6);
            z-index: 10;
          }

          .frieze-text {
            font-family: 'Cinzel', serif;
            font-size: 23px;
            font-weight: 900;
            letter-spacing: 0.38em;
            color: #F8FAFC;
            text-shadow: 0 2px 4px #000, 0 0 12px rgba(168, 85, 247, 0.8);
            transform: scaleY(0.92);
          }

          /* ========================================================= */
          /* REAL STOCK LOGOS: WRONG TAGS / GRAFFITI ON THE PILLARS   */
          /* ========================================================= */
          .pillar-tag {
            position: absolute;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            z-index: 18;
            pointer-events: none;
            transform-origin: center center;
          }

          ${
            style === "spray"
              ? `
            /* Raw Street Spray Stencil Style */
            .pillar-tag {
              filter: drop-shadow(0 0 10px rgba(3, 225, 255, 0.7));
            }
            .tag-symbol {
              width: 36px;
              height: 36px;
              fill: #FFFFFF;
              filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.9));
            }
            .tag-label {
              font-family: 'Space Mono', monospace;
              font-size: 13px;
              font-weight: 900;
              letter-spacing: 0.2em;
              color: #FFFFFF;
              text-shadow: 0 0 8px #03E1FF, 0 0 16px #A855F7;
              padding: 2px 6px;
              border-top: 1.5px solid #03E1FF;
              border-bottom: 1.5px solid #A855F7;
            }
          `
              : `
            /* DeFi Cyberpunk Stencil Decal Style */
            .pillar-tag {
              background: rgba(7, 7, 13, 0.65);
              border: 1.5px dashed rgba(3, 225, 255, 0.85);
              border-radius: 6px;
              padding: 6px 10px;
              box-shadow: 0 0 14px rgba(3, 225, 255, 0.45), inset 0 0 8px rgba(3, 225, 255, 0.2);
              backdrop-filter: blur(1.5px);
            }
            .stencil-purple {
              border-color: rgba(168, 85, 247, 0.9);
              box-shadow: 0 0 14px rgba(168, 85, 247, 0.55), inset 0 0 8px rgba(168, 85, 247, 0.25);
            }
            .tag-symbol {
              width: 30px;
              height: 30px;
              fill: #FFFFFF;
              filter: drop-shadow(0 0 6px rgba(3, 225, 255, 0.8));
            }
            .tag-label {
              font-family: 'Space Mono', monospace;
              font-size: 12.5px;
              font-weight: 800;
              letter-spacing: 0.15em;
              color: #FFFFFF;
              text-shadow: 0 0 8px rgba(168, 85, 247, 0.9), 0 2px 4px #000;
              margin-top: 2px;
            }
          `
          }

          /* Tag Column Alignments */
          .tag-aapl { left: 320px; top: 275px; transform: rotate(-3deg); }
          .tag-nvda { left: 452px; top: 360px; transform: rotate(2.5deg); }
          .tag-tsla { left: 595px; top: 265px; transform: rotate(-2deg); }
          .tag-msft { left: 742px; top: 375px; transform: rotate(3deg); }
          .tag-googl { left: 885px; top: 275px; transform: rotate(-2.5deg); }
          .tag-amzn { left: 1025px; top: 365px; transform: rotate(2deg); }
          .tag-meta { left: 180px; top: 370px; transform: rotate(-4deg); }
          .tag-coin { left: 1180px; top: 285px; transform: rotate(3deg); }

          /* ========================================================= */
          /* HEADER ROW: EXACT OPENSTOCK LOGO ICON + TITLE + SUB-BAR   */
          /* ========================================================= */
          .header-bar {
            position: absolute;
            top: 28px;
            left: 44px;
            right: 44px;
            z-index: 50;
          }

          .brand-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
          }

          .title-group {
            display: flex;
            align-items: center;
            gap: 22px;
          }

          /* Exact OpenStock Circular Ledger Logo (openstock-icon-transparent.png) */
          .openstock-brand-logo {
            width: 86px;
            height: 86px;
            object-fit: contain;
            flex-shrink: 0;
            border-radius: 50%;
            filter: drop-shadow(0 4px 20px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 25px rgba(3, 225, 255, 0.45));
          }

          .brand-title {
            font-family: 'Syncopate', 'Orbitron', sans-serif;
            font-size: 102px;
            font-weight: 700;
            color: #FFFFFF;
            letter-spacing: 0.14em;
            line-height: 0.95;
            text-transform: uppercase;
            text-shadow: 0 4px 24px rgba(0, 0, 0, 0.95), 0 0 50px rgba(168, 85, 247, 0.5);
          }

          /* Transparent Solana Logo Watermark as requested */
          .solana-watermark {
            width: 76px;
            height: 60px;
            opacity: 0.32;
            mix-blend-mode: screen;
            filter: drop-shadow(0 2px 10px rgba(0, 0, 0, 0.8));
          }

          /* Metadata Sub-Bar (openstock.app removed) */
          .sub-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 14px;
            padding: 0 4px;
            font-family: 'Space Mono', monospace;
            font-size: 16.5px;
            font-weight: 700;
            color: #FFFFFF;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.95);
          }

          .sub-item-left { text-align: left; }
          .sub-item-right {
            text-align: right;
            color: #F1F5F9;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .sub-item-right .mini-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #14F195;
            box-shadow: 0 0 10px #14F195;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="bg-layer"></div>
        <div class="duotone-grade"></div>
        
        <!-- Frieze Banner: GLOBAL STOCK EXCHANGE -->
        <div class="frieze-banner">
          <div class="frieze-text">GLOBAL STOCK EXCHANGE</div>
        </div>
        <div class="architrave-mask"></div>

        <!-- Slit-Scan Vertical Slices -->
        <div class="glitch-slice slice-1"></div>
        <div class="glitch-slice slice-2"></div>
        <div class="glitch-slice slice-3"></div>
        <div class="glitch-slice slice-4"></div>
        <div class="slice-h"></div>
        <div class="top-ambient"></div>

        <!-- Real Stock Logo Tags on the Pillars -->
        <div class="pillar-tag tag-aapl">
          <svg class="tag-symbol" viewBox="0 0 24 24"><path d="${stockLogos.apple}"/></svg>
          <div class="tag-label">$AAPL</div>
        </div>

        <div class="pillar-tag tag-nvda stencil-purple">
          <svg class="tag-symbol" viewBox="0 0 24 24"><path d="${stockLogos.nvidia}"/></svg>
          <div class="tag-label">$NVDA</div>
        </div>

        <div class="pillar-tag tag-tsla">
          <svg class="tag-symbol" viewBox="0 0 24 24"><path d="${stockLogos.tesla}"/></svg>
          <div class="tag-label">$TSLA</div>
        </div>

        <div class="pillar-tag tag-msft stencil-purple">
          <svg class="tag-symbol" viewBox="0 0 24 24">
            <rect x="3" y="3" width="8.2" height="8.2" fill="#FFFFFF"/>
            <rect x="12.8" y="3" width="8.2" height="8.2" fill="#FFFFFF"/>
            <rect x="3" y="12.8" width="8.2" height="8.2" fill="#FFFFFF"/>
            <rect x="12.8" y="12.8" width="8.2" height="8.2" fill="#FFFFFF"/>
          </svg>
          <div class="tag-label">$MSFT</div>
        </div>

        <div class="pillar-tag tag-googl">
          <svg class="tag-symbol" viewBox="0 0 24 24"><path d="${stockLogos.google}"/></svg>
          <div class="tag-label">$GOOGL</div>
        </div>

        <div class="pillar-tag tag-amzn stencil-purple">
          <svg class="tag-symbol" viewBox="0 0 24 24"><path d="${stockLogos.amazon}"/></svg>
          <div class="tag-label">$AMZN</div>
        </div>

        <div class="pillar-tag tag-meta">
          <svg class="tag-symbol" viewBox="0 0 24 24"><path d="${stockLogos.meta}"/></svg>
          <div class="tag-label">$META</div>
        </div>

        <div class="pillar-tag tag-coin stencil-purple">
          <svg class="tag-symbol" viewBox="0 0 24 24"><path d="${stockLogos.coinbase}"/></svg>
          <div class="tag-label">$COIN</div>
        </div>

        <!-- Header Bar -->
        <div class="header-bar">
          <div class="brand-row">
            <div class="title-group">
              <!-- Exact specified logo: openstock-icon-transparent.png -->
              <img class="openstock-brand-logo" src="${logoDataUrl}" alt="OpenStock" />
              
              <h1 class="brand-title">OPENSTOCK</h1>
            </div>

            <!-- Transparent Solana Logo Watermark as requested -->
            <svg class="solana-watermark" viewBox="0 0 397 311" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="#FFFFFF"/>
              <path d="M64.6 3.8C67 1.4 70.3 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="#FFFFFF"/>
              <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="#FFFFFF"/>
            </svg>
          </div>

          <div class="sub-bar">
            <div class="sub-item-left">TOKENIZED EQUITIES · 24/7</div>
            <div class="sub-item-right">
              <span class="mini-dot"></span>
              GLOBAL STOCK EXCHANGE · ON-CHAIN
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const brainDir = "C:/Users/DELL/.gemini/antigravity-cli/brain/86ab74c3-80f9-4f28-b8d1-a9fc5147759d";

  function saveBuffer(buffer, filename) {
    const pub = path.resolve("public/logo", filename);
    const brn = path.join(brainDir, filename);
    try { fs.writeFileSync(pub, buffer); } catch (e) { console.warn(`Warning writing to ${pub}:`, e.message); }
    try { fs.writeFileSync(brn, buffer); } catch (e) { console.warn(`Warning writing to ${brn}:`, e.message); }
  }

  try {
    console.log("Generating Stencil Decal Style 1500x500...");
    await page.setContent(template("stencil"), { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const buf1500 = await page.screenshot();
    saveBuffer(buf1500, "openstock-global-stock-exchange-1500x500.png");
    saveBuffer(buf1500, "openstock-global-stock-exchange-v3-1500x500.png");

    console.log("Generating Stencil Decal Style 3000x1000 Retina...");
    await page.setViewportSize({ width: 3000, height: 1000 });
    await page.evaluate(() => {
      document.body.style.transformOrigin = "top left";
      document.body.style.transform = "scale(2)";
    });
    await page.waitForTimeout(500);
    const buf3000 = await page.screenshot();
    saveBuffer(buf3000, "openstock-global-stock-exchange-3000x1000.png");
    saveBuffer(buf3000, "openstock-global-stock-exchange-v3-3000x1000.png");

    console.log("Generating Raw Street Spray Style 1500x500...");
    await page.setViewportSize({ width: 1500, height: 500 });
    await page.setContent(template("spray"), { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const bufSpray1500 = await page.screenshot();
    saveBuffer(bufSpray1500, "openstock-global-spray-tags-1500x500.png");
    saveBuffer(bufSpray1500, "openstock-global-spray-tags-v3-1500x500.png");

    console.log("All Global Stock Exchange X Banners generated and copied successfully!");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Error generating banners:", err);
  process.exit(1);
});
