import type { Metadata } from "next";
import { LaunchDesk } from "@/components/launch-desk";

export const metadata: Metadata = {
  title: "Launch Token Pair — OpenStock × Meteora DBC",
  description: "Launch a token quoted in a tokenized stock on Meteora Dynamic Bonding Curve. Fees and DAMM v2 graduation are the on-chain PoolConfig.",
};

export default function AppLaunchPage() {
  return <LaunchDesk />;
}
