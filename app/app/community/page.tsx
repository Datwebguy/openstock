import type { Metadata } from "next";
import Link from "next/link";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { CommunityMarketHub } from "@/components/community-market-hub";
import { getCommunityTokens } from "@/lib/community-tokens";
import curatedSymbols from "@/lib/curated-symbols.json";

export const metadata: Metadata = {
  title: "Community Stock Pairs — OpenStock × Meteora DBC",
  description: "OpenStock Meteora DBC launches plus existing Solana pools quoted directly in tokenized stocks.",
};

export default async function CommunityMarketPage() {
  const tokens = await getCommunityTokens();

  return (
    <main className="page">
      <AppNav ctaHref="/launch" ctaLabel="Launch Pair" />

      <div className="container app-page">
        <header className="workspace-heading">
          <div className="workspace-heading__body">
            <div className="workspace-kicker">
              <span className="live-dot" aria-hidden="true" />
              <span>Solana mainnet · pools quoted in xStocks</span>
            </div>
            <h1>Stock-quoted launches</h1>
            <p>
              OpenStock Meteora DBC launches first, then existing DexScreener pools that trade directly against an xStock. Curve progress is read from Solana; prices and volume come from DexScreener.
            </p>
          </div>
          <div className="workspace-heading__actions">
            <Link className="button button--gradient" href="/launch">
              Launch on Meteora DBC ↗
            </Link>
            <Link className="workspace-pill-link workspace-pill-link--secondary" href="/launch/presets">
              DBC presets ↗
            </Link>
            <Link className="workspace-pill-link workspace-pill-link--secondary" href="/app">
              {curatedSymbols.length} tokenized stocks ↗
            </Link>
          </div>
        </header>

        <CommunityMarketHub initialTokens={tokens} />
      </div>

      <AppFooterNav />
    </main>
  );
}
