import type { Metadata } from "next";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { DbcPresetDesk } from "@/components/dbc-preset-desk";
import "@/app/launch/launch.css";

export const metadata: Metadata = {
  title: "Meteora DBC Presets — OpenStock",
  description: "Live Meteora Dynamic Bonding Curve PoolConfigs quoted in tokenized stocks, with DAMM v2 graduation terms read from chain.",
};

export default function DbcPresetsPage() {
  return (
    <main className="launch-page">
      <AppNav ctaHref="/launch" ctaLabel="Launch" />
      <DbcPresetDesk />
      <AppFooterNav />
    </main>
  );
}
