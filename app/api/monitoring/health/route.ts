import { NextResponse } from "next/server";
import { monitoring } from "@/lib/monitoring";

export async function GET() {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    services: {
      jupiter: !!process.env.JUPITER_API_KEY,
      pyth: !!process.env.PYTH_HERMES_API_KEY,
      clawpump: !!process.env.CLAWPUMP_API_KEY,
      privy: !!process.env.PRIVY_APP_SECRET,
    },
    recentErrors: monitoring.getLogsByLevel("error").slice(-5),
    recentCritical: monitoring.getLogsByLevel("critical").slice(-5),
  };

  return NextResponse.json(health, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
