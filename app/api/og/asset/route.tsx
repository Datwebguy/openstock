import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "NVDAx").toUpperCase();
  const name = searchParams.get("name") || symbol.replace(/X$/, "") + " xStock";
  const price = searchParams.get("price");
  const session = searchParams.get("session") || "24/7 DEX";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          backgroundColor: "#070510",
          backgroundImage:
            "radial-gradient(circle at 80% 20%, rgba(153, 69, 255, 0.3), transparent 42%), radial-gradient(circle at 20% 80%, rgba(20, 241, 149, 0.22), transparent 45%)",
          fontFamily: "sans-serif",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                fontSize: "22px",
                fontWeight: 900,
                color: "#000",
              }}
            >
              OS
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.03em" }}>OPENSTOCK</span>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Tokenized equity desk · Solana
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
              fontWeight: 700,
            }}
          >
            <span>●</span> {session}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <span style={{ fontSize: "18px", color: "rgba(255,255,255,0.55)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Asset desk
          </span>
          <span style={{ fontSize: "64px", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>{symbol}</span>
          <span style={{ fontSize: "28px", color: "rgba(255,255,255,0.75)" }}>{name}</span>
          {price ? (
            <span style={{ fontSize: "40px", fontWeight: 800, color: "#14f195", marginTop: "8px" }}>{price}</span>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderRadius: "16px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontSize: "16px",
            fontWeight: 700,
          }}
        >
          <span>Evidence · Jupiter · Pyth · Meteora</span>
          <span style={{ color: "#9945ff" }}>joinopenstock.xyz</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
