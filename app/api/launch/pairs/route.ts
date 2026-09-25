import { NextResponse } from "next/server";
import { getClawPumpPairs, VERIFIED_SOLANA_XSTOCKS_PAIRS } from "@/lib/clawpump";
import { resolveDbcConfigAddress } from "@/lib/meteora-dbc";

export async function GET() {
  try {
    const data = await getClawPumpPairs();
    // Stocks with a Meteora DBC PoolConfig configured on this deployment (verified on-chain per stock by /api/launch/venues).
    const meteoraReady = VERIFIED_SOLANA_XSTOCKS_PAIRS.filter((pair) =>
      resolveDbcConfigAddress({ quoteMint: pair.mint, pairedStockSymbol: pair.symbol })
    ).map((pair) => pair.symbol);
    // Meteora-only stocks must still be selectable when ClawPump does not list them.
    const listed = new Set(data.assets.map((asset) => asset.mint));
    const assets = [...data.assets, ...VERIFIED_SOLANA_XSTOCKS_PAIRS.filter((pair) => meteoraReady.includes(pair.symbol) && !listed.has(pair.mint))];
    return NextResponse.json({ ...data, assets, meteoraReady });
  } catch (error) {
    console.error("Error fetching pump pairs:", error);
    return NextResponse.json({ error: "Failed to fetch supported pairs" }, { status: 500 });
  }
}
