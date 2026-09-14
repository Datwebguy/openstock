import { NextResponse } from "next/server";

const JUPITER_API_BASE = process.env.JUPITER_SWAP_API_BASE ?? "https://api.jup.ag/swap/v2";

type ExecuteBody = {
  signedTransaction?: string;
  requestId?: string;
  lastValidBlockHeight?: number;
};

export async function POST(request: Request) {
  if (!process.env.JUPITER_API_KEY) {
    return NextResponse.json(
      { error: "Live trading is not configured yet. Add a Jupiter API key before enabling signed orders." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

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
  } catch {
    return NextResponse.json(
      { error: "The execution service could not be reached. No new signature was requested." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
