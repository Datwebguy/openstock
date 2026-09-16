import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

const JUPITER_API_BASE = process.env.JUPITER_SWAP_API_BASE ?? "https://api.jup.ag/swap/v2";
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

type ExecuteBody = {
  signedTransaction?: string;
  requestId?: string;
  lastValidBlockHeight?: number;
};

export async function POST(request: Request) {
  let body: ExecuteBody;
  try {
    body = (await request.json()) as ExecuteBody;
  } catch {
    return NextResponse.json({ error: "The signed order could not be read." }, { status: 400 });
  }

  if (!body.signedTransaction || !body.requestId) {
    return NextResponse.json(
      { error: "The signed order is incomplete. Please review the trade and try again." },
      { status: 400 },
    );
  }

  try {
    if (process.env.JUPITER_API_KEY) {
      const response = await fetch(`${JUPITER_API_BASE}/execute`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": process.env.JUPITER_API_KEY,
        },
        body: JSON.stringify({
          signedTransaction: body.signedTransaction,
          requestId: body.requestId,
          ...(typeof body.lastValidBlockHeight === "number"
            ? { lastValidBlockHeight: body.lastValidBlockHeight }
            : {}),
        }),
        signal: AbortSignal.timeout(20_000),
      });

      const payload = await response.json().catch(() => ({ error: "Jupiter returned an unreadable response." }));
      return NextResponse.json(payload, {
        status: response.ok ? 200 : 502,
        headers: { "Cache-Control": "no-store" },
      });
    } else {
      // Direct broadcast to Solana RPC node
      const connection = new Connection(SOLANA_RPC_URL, "confirmed");
      const rawTransaction = Buffer.from(body.signedTransaction, "base64");
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      return NextResponse.json(
        {
          status: "Success",
          signature,
          txid: signature,
          explorerUrl: `https://solscan.io/tx/${signature}`,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "The execution service could not be reached.";
    return NextResponse.json(
      { error: errorMsg },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
