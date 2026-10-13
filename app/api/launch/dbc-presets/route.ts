import { NextResponse } from "next/server";
import { getDbcPresetCatalog } from "@/lib/dbc-catalog";

export const revalidate = 60;

export async function GET() {
  try {
    const catalog = await getDbcPresetCatalog();
    return NextResponse.json({
      success: true,
      ...catalog,
      builder: {
        createPool: { method: "POST", path: "/api/launch/meteora", body: { mode: "prepare" } },
        confirmPool: { method: "POST", path: "/api/launch/meteora", body: { mode: "confirm" } },
        curveProgress: { method: "GET", path: "/api/migration/meteora?poolAddress=" },
        migrate: { method: "POST", path: "/api/migration/meteora", body: { mode: "prepare" } },
        livePools: { method: "GET", path: "/api/launch/dbc-pools" },
        venues: { method: "GET", path: "/api/launch/venues?symbol=NVDAx" },
      },
      notes: [
        "Quote token is the xStock, not SOL or USDC.",
        "migrationThresholdUi is in quote-token units. graduationUsd uses the live Jupiter price of that stock, so USD FDV moves with the equity.",
        "Migrated liquidity is permanently locked on DAMM v2 (partnerPermanentLockedLiquidityPercentage = 100).",
      ],
    });
  } catch (err) {
    console.error("DBC preset catalog failed:", err);
    return NextResponse.json({ error: "Failed to read DBC presets from chain." }, { status: 500 });
  }
}
