import { NextResponse } from "next/server";
import { getClawPumpPairs } from "@/lib/clawpump";

export async function GET() {
  try {
    const data = await getClawPumpPairs();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching pump pairs:", error);
    return NextResponse.json(
      { error: "Failed to fetch supported pump pairs" },
      { status: 500 }
    );
  }
}
