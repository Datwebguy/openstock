import { NextResponse } from "next/server";
import { getCommunityTokens } from "@/lib/community-tokens";
import { queryOnChainDbcProgress } from "@/lib/meteora-dbc";

export const revalidate = 15;

export async function GET() {
  try {
    const tokens = await getCommunityTokens();
    const dbc = tokens.filter((t) => t.venue === "meteora" && t.poolAddress);
    const progress = await Promise.all(
      dbc.map(async (token) => {
        const onChain = token.poolAddress ? await queryOnChainDbcProgress(token.poolAddress) : null;
        return {
          mint: token.mint,
          symbol: token.symbol,
          name: token.name,
          pairedStockSymbol: token.pairedStockSymbol,
          poolAddress: token.poolAddress,
          source: token.source ?? "discovered",
          status: token.status,
          progress: onChain,
          isGraduated: onChain !== null && onChain >= 100,
          explorerUrl: token.explorerUrl,
          poolUrl: token.meteoraUrl || token.pumpUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: progress.length,
      openstockLaunches: progress.filter((p) => p.source === "openstock").length,
      pools: progress,
    });
  } catch (err) {
    console.error("DBC pool stream failed:", err);
    return NextResponse.json({ error: "Failed to read DBC pools." }, { status: 500 });
  }
}
