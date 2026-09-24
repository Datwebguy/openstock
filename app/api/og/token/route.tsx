import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getStockCompany } from "@/lib/tokenized-stock-wording";
import {
  clampAccentColor,
  extractDominantColor,
  isValidHex6,
  sanitizeHex6,
  DEFAULT_ACCENT_HEX,
} from "@/lib/og-color-extractor";
import curated25Data from "@/lib/solana-curated-25.json";

// We run in nodejs runtime so sharp color extraction and image processing run with high performance
export const runtime = "nodejs";

const curatedStocks: Record<string, { symbol: string; name: string; logo: string }> = curated25Data;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // 1. Parse parameters
  const rawSymbol = searchParams.get("symbol") || "TOKEN";
  const cleanSymbol = rawSymbol.startsWith("$") ? rawSymbol.slice(1).toUpperCase() : rawSymbol.toUpperCase();
  const stockParam = (searchParams.get("stock") || "NVDAx").trim();
  const logoParam = searchParams.get("logo") || "";
  const customColorParam = searchParams.get("c") || "";
  const variant = (searchParams.get("variant") || "launch").toLowerCase();
  const milestoneValue = searchParams.get("value") || "";

  // 2. Resolve stock information & fallback color
  const stockUpper = stockParam.toUpperCase();
  const stockConfig = getStockCompany(stockUpper);
  const matchedStockMeta = curatedStocks[stockUpper] || curatedStocks[stockUpper.endsWith("X") ? stockUpper : `${stockUpper}X`];
  const stockLogoUrl = matchedStockMeta?.logo || `https://xstocks-metadata.backed.fi/logos/tokens/${stockUpper.endsWith("X") ? stockUpper : `${stockUpper}x`}.png`;

  // 3. Resolve accent color with strict safety clamping
  let accentHex = DEFAULT_ACCENT_HEX;

  if (isValidHex6(customColorParam)) {
    // User explicitly customized the color
    const sanitized = sanitizeHex6(customColorParam);
    if (sanitized) {
      accentHex = clampAccentColor(sanitized).accentHex;
    }
  } else {
    // Auto color: extract vibrant color from token logo, fallback to stock brand color, then OpenStock purple
    const fallbackStockBrand = stockConfig.brandColor || DEFAULT_ACCENT_HEX;
    if (logoParam && logoParam.startsWith("http")) {
      accentHex = await extractDominantColor(logoParam, fallbackStockBrand);
    } else {
      accentHex = clampAccentColor(fallbackStockBrand).accentHex;
    }
  }

  const { bgHex, glowRgba, subtleGlowRgba } = clampAccentColor(accentHex);

  // Calculate dynamic hero font size so ticker never overflows 960px safe frame
  const tickerLength = cleanSymbol.length + 1; // including '$'
  let heroFontSize = 160;
  if (tickerLength >= 9) {
    heroFontSize = 110;
  } else if (tickerLength >= 7) {
    heroFontSize = 135;
  }

  // Generate clean monogram initial if token has no image
  const tokenInitial = cleanSymbol.slice(0, 2);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxSizing: "border-box",
          padding: "64px 120px", // Safe 80% center frame (margins: 120px left/right, 64px top/bottom)
          backgroundColor: bgHex,
          backgroundImage: `radial-gradient(circle at 50% 46%, ${glowRgba} 0%, rgba(6, 4, 12, 0.45) 45%, transparent 72%)`,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle background glow layer */}
        <div
          style={{
            position: "absolute",
            top: "220px",
            left: "300px",
            width: "600px",
            height: "220px",
            borderRadius: "50%",
            background: glowRgba,
            filter: "blur(70px)",
            opacity: 0.5,
          }}
        />

        {/* Top Header: OpenStock logo at top-left, small & neutral */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              opacity: 0.75,
            }}
          >
            {/* OpenStock Logo Mark */}
            <svg width="32" height="32" viewBox="0 0 64 64" fill="none">
              <path
                d="M20 0 H44 A20 20 0 0 1 64 20 V44 A20 20 0 0 1 44 64 H5 A5 5 0 0 1 0 59 V20 A20 20 0 0 1 20 0 Z"
                fill="#ffffff"
              />
              <circle cx="32" cy="32" r="14" fill="#07070D" />
              <path d="M18 32 A14 14 0 0 0 46 32 Z" fill="#ffffff" />
            </svg>
            <span
              style={{
                fontSize: "22px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#ffffff",
              }}
            >
              OpenStock
            </span>
          </div>

          {/* Top-right empty to keep focus entirely on the centerpiece */}
          <div style={{ display: "flex" }} />
        </div>

        {/* Centerpiece: Pair Visual + Large Hero Ticker */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          {/* Pair Visual: Two equal circles connected by accent multiplication sign */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Token Logo Circle */}
            <div
              style={{
                width: "110px",
                height: "110px",
                borderRadius: "55px",
                border: `2px solid ${accentHex}`,
                boxShadow: `0 0 24px ${subtleGlowRgba}`,
                backgroundColor: "#0d0a18",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {logoParam && logoParam.startsWith("http") ? (
                <img
                  src={logoParam}
                  alt={cleanSymbol}
                  width="110"
                  height="110"
                  style={{
                    width: "110px",
                    height: "110px",
                    objectFit: "cover",
                    borderRadius: "55px",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `linear-gradient(135deg, ${accentHex} 0%, #15102a 100%)`,
                    color: "#ffffff",
                    fontSize: "44px",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {tokenInitial}
                </div>
              )}
            </div>

            {/* Accent Connector Sign */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 28px",
                color: accentHex,
                fontSize: "38px",
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              ×
            </div>

            {/* Paired Stock Logo Circle */}
            <div
              style={{
                width: "110px",
                height: "110px",
                borderRadius: "55px",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
                backgroundColor: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <img
                src={stockLogoUrl}
                alt={stockParam}
                width="110"
                height="110"
                style={{
                  width: "110px",
                  height: "110px",
                  objectFit: "cover",
                  borderRadius: "55px",
                }}
              />
            </div>
          </div>

          {/* Hero Ticker: Bold type, at least 160px for standard tickers, white with accent glow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: `${heroFontSize}px`,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-0.04em",
              lineHeight: 1,
              marginTop: "24px",
              textShadow: `0 0 70px ${glowRgba}`,
            }}
          >
            ${cleanSymbol}
          </div>

          {/* Variant support: Milestone number if variant === "milestone" */}
          {variant === "milestone" && milestoneValue && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "44px",
                fontWeight: 800,
                color: accentHex,
                marginTop: "12px",
                letterSpacing: "-0.02em",
              }}
            >
              {milestoneValue}
            </div>
          )}
        </div>

        {/* Bottom Footer: Official Solana Logo Mark at bottom-right, 35% opacity */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              opacity: 0.35,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="36"
              height="36"
              fill="#ffffff"
            >
              <path d="m23.8764 18.0313-3.962 4.1393a.9201.9201 0 0 1-.306.2106.9407.9407 0 0 1-.367.0742H.4599a.4689.4689 0 0 1-.2522-.0733.4513.4513 0 0 1-.1696-.1962.4375.4375 0 0 1-.0314-.2545.4438.4438 0 0 1 .117-.2298l3.9649-4.1393a.92.92 0 0 1 .3052-.2102.9407.9407 0 0 1 .3658-.0746H23.54a.4692.4692 0 0 1 .2523.0734.4531.4531 0 0 1 .1697.196.438.438 0 0 1 .0313.2547.4442.4442 0 0 1-.1169.2297zm-3.962-8.3355a.9202.9202 0 0 0-.306-.2106.941.941 0 0 0-.367-.0742H.4599a.4687.4687 0 0 0-.2522.0734.4513.4513 0 0 0-.1696.1961.4376.4376 0 0 0-.0314.2546.444.444 0 0 0 .117.2297l3.9649 4.1394a.9204.9204 0 0 0 .3052.2102c.1154.049.24.0744.3658.0746H23.54a.469.469 0 0 0 .2523-.0734.453.453 0 0 0 .1697-.1961.4382.4382 0 0 0 .0313-.2546.4444.4444 0 0 0-.1169-.2297zM.46 6.7225h18.7815a.9411.9411 0 0 0 .367-.0742.9202.9202 0 0 0 .306-.2106l3.962-4.1394a.4442.4442 0 0 0 .117-.2297.4378.4378 0 0 0-.0314-.2546.453.453 0 0 0-.1697-.196.469.469 0 0 0-.2523-.0734H4.7596a.941.941 0 0 0-.3658.0745.9203.9203 0 0 0-.3052.2102L.1246 5.9687a.4438.4438 0 0 0-.1169.2295.4375.4375 0 0 0 .0312.2544.4512.4512 0 0 0 .1692.196.4689.4689 0 0 0 .2518.0739z" />
            </svg>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    }
  );
}
