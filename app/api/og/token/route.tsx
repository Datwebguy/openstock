import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const name = searchParams.get("name") || "Community Token";
  const symbol = (searchParams.get("symbol") || "TOKEN").toUpperCase();
  const stock = (searchParams.get("stock") || "AAPLx").toUpperCase();
  const fee = searchParams.get("fee") || "1.5";
  const venue = searchParams.get("venue") || "pumpfun";
  const venueLabel = venue === "pumpfun" ? "Pump.fun Curve" : "Meteora DLMM";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 70px",
          backgroundColor: "#070510",
          backgroundImage:
            "radial-gradient(circle at 85% 15%, rgba(153, 69, 255, 0.28), transparent 45%), radial-gradient(circle at 15% 85%, rgba(20, 241, 149, 0.22), transparent 45%)",
          fontFamily: "sans-serif",
          color: "#ffffff",
        }}
      >
        {/* Top Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #9945ff 0%, #14f195 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: "900",
                color: "#000",
              }}
            >
              OS
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "26px",
                  fontWeight: "800",
                  letterSpacing: "-0.03em",
                  color: "#ffffff",
                }}
              >
                OPENSTOCK
              </span>
              <span
                style={{
                  fontSize: "13px",
                  color: "rgba(255, 255, 255, 0.6)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Tokenized Equity Launchpad · Solana
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 18px",
              borderRadius: "999px",
              background: "rgba(20, 241, 149, 0.12)",
              border: "1px solid rgba(20, 241, 149, 0.35)",
              color: "#14f195",
              fontSize: "14px",
              fontWeight: "700",
            }}
          >
            <span>●</span> LIVE ON MAINNET
          </div>
        </div>

        {/* Center Spotlight */}
        <div style={{ display: "flex", alignItems: "center", gap: "36px" }}>
          {/* Dual Coin Artwork */}
          <div
            style={{
              display: "flex",
              position: "relative",
              width: "140px",
              height: "140px",
            }}
          >
            <div
              style={{
                width: "128px",
                height: "128px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #9945ff, #03e1ff, #14f195)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "42px",
                fontWeight: "800",
                color: "#ffffff",
                boxShadow: "0 16px 40px rgba(153, 69, 255, 0.4)",
              }}
            >
              ${symbol.slice(0, 3)}
            </div>
            <div
              style={{
                position: "absolute",
                right: "0",
                bottom: "0",
                width: "60px",
                height: "60px",
                borderRadius: "18px",
                background: "#ffffff",
                border: "3px solid #14f195",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#000000",
                fontSize: "13px",
                fontWeight: "900",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
              }}
            >
              {stock}
            </div>
          </div>

          {/* Token Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                fontSize: "48px",
                fontWeight: "900",
                letterSpacing: "-0.03em",
                color: "#ffffff",
                lineHeight: "1.1",
              }}
            >
              {name}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: "800",
                  color: "#9945ff",
                }}
              >
                ${symbol}
              </span>
              <span style={{ fontSize: "20px", color: "#14f195" }}>×</span>
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: "800",
                  color: "#14f195",
                }}
              >
                {stock}
              </span>
            </div>
            <span
              style={{
                fontSize: "17px",
                color: "rgba(255, 255, 255, 0.65)",
                maxWidth: "600px",
              }}
            >
              Paired directly against tokenized equity on Solana
            </span>
          </div>
        </div>

        {/* Bottom Specs Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 28px",
            borderRadius: "18px",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)" }}>
              EXECUTION VENUE
            </span>
            <span
              style={{
                fontSize: "17px",
                fontWeight: "700",
                color: "#03e1ff",
              }}
            >
              {venueLabel}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)" }}>
              CREATOR ROYALTY
            </span>
            <span
              style={{
                fontSize: "17px",
                fontWeight: "700",
                color: "#14f195",
              }}
            >
              {fee}% in {stock}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)" }}>
              COLLATERAL STANDARD
            </span>
            <span
              style={{
                fontSize: "17px",
                fontWeight: "700",
                color: "#ffffff",
              }}
            >
              SPL Token-2022
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)" }}>
              SETTLEMENT
            </span>
            <span
              style={{
                fontSize: "17px",
                fontWeight: "700",
                color: "#ffffff",
              }}
            >
              ~400ms Sub-Second
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
