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
        <header className="workspace-heading">
          <div className="workspace-heading__body">
            <div className="workspace-kicker">
              <span className="live-dot" aria-hidden="true" />
              <span>Solana mainnet · pools, price sources, reserves</span>
            </div>
            <h1>Stock Analytics</h1>
            <p>Real price history, Meteora pools, the oracle cross-check and issuer reserves for each xStock.</p>
          </div>
          <div className="workspace-heading__actions">
            <Link className="workspace-pill-link" href="/app">
              {CURATED_SYMBOLS.length} stocks desk ↗
            </Link>
            <Link className="workspace-pill-link workspace-pill-link--secondary" href="/app/community">
              Memes &amp; Pairs ↗
            </Link>
            <Link className="workspace-pill-link workspace-pill-link--secondary" href="/launch">
              Pair &amp; Launch ↗
            </Link>
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
