import { Suspense } from "react";
import Link from "next/link";
import { AnalyticsWorkspace } from "@/components/analytics-workspace";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { CURATED_SYMBOLS } from "@/lib/xstocks";

const names: Record<string, string> = { AAPLx: "Apple", AMZNx: "Amazon", GOOGLx: "Alphabet", NVDAx: "NVIDIA", TSLAx: "Tesla", METAx: "Meta", MSFTx: "Microsoft", COINx: "Coinbase", CRCLx: "Circle", SPYx: "SP500" };

export default function AnalyticsPage() {
  return (
    <main className="page">
      <AppNav ctaHref="/app" ctaLabel="Market" />
      <div className="container app-page">
        <header className="analytics-page-header">
          <div>
            <h1>Institutional Analytics</h1>
            <p className="workspace-description">On-chain pool depth, real-time tick engine, and oracle consensus on Solana.</p>
          </div>
        </header>
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading analytics terminal...</div>}>
          <AnalyticsWorkspace symbols={CURATED_SYMBOLS.map((symbol) => ({ symbol, name: names[symbol] ?? symbol }))} />
        </Suspense>
      </div>
      <AppFooterNav />
    </main>
  );
}
