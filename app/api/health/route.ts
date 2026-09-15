import { NextResponse } from "next/server";
import { liveTradingEnabled } from "@/lib/trading";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "openstock",
    trading: liveTradingEnabled() ? "live" : "browse",
    timestamp: new Date().toISOString(),
  });
}
