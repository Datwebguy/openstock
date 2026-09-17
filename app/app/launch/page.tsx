import type { Metadata } from "next";
import { LaunchDesk } from "@/components/launch-desk";

export const metadata: Metadata = {
  title: "Launch Token Pair — OpenStock × ClawPump",
  description: "Create an independent community token and launch it directly paired against a tokenized stock on Solana.",
};

export default function AppLaunchPage() {
  return <LaunchDesk />;
}
