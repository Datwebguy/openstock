import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { isSolanaAddress } from "@/lib/solana";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

type Holder = { owner: string; tokenAccount: string; uiAmount: number; pct: number };

/** Largest holders of a mint, read from Solana (top 20 token accounts, resolved to their owners). */
export async function GET(request: Request) {
  const mint = new URL(request.url).searchParams.get("mint") ?? "";
  if (!isSolanaAddress(mint)) return NextResponse.json({ error: "Invalid mint." }, { status: 400 });
  try {
    const connection = new Connection(RPC, "confirmed");
    const mintKey = new PublicKey(mint);
    const [largest, supply] = await Promise.all([
      connection.getTokenLargestAccounts(mintKey),
      connection.getTokenSupply(mintKey),
    ]);
    const totalUi = supply.value.uiAmount ?? 0;
    const accounts = largest.value.slice(0, 20);
    const infos = await connection.getMultipleParsedAccounts(accounts.map((a) => a.address));
    const holders: Holder[] = accounts.map((account, index) => {
      const parsed = infos.value[index]?.data as { parsed?: { info?: { owner?: string } } } | undefined;
      const uiAmount = account.uiAmount ?? 0;
      return {
        owner: parsed?.parsed?.info?.owner ?? account.address.toBase58(),
        tokenAccount: account.address.toBase58(),
        uiAmount,
        pct: totalUi > 0 ? (uiAmount / totalUi) * 100 : 0,
      };
    });
    const top10Pct = holders.slice(0, 10).reduce((sum, holder) => sum + holder.pct, 0);
    return NextResponse.json(
      { mint, supplyUi: totalUi, holders, top10Pct, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.warn("token-holders failed", mint, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Holder data is unavailable right now." }, { status: 502 });
  }
}
