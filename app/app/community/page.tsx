import type { Metadata } from "next";
import Link from "next/link";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { CommunityMarketHub } from "@/components/community-market-hub";
import { getCommunityTokens } from "@/lib/community-tokens";

export const metadata: Metadata = {
  title: "Community Stock Pairs & Memes — OpenStock × ClawPump",
  description: "Live registry of community memes and tokens paired against tokenized equities on Solana with bonding curves and Bubblemaps.",
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
              <span>Solana Mainnet · ClawPump &amp; Meteora DLMM</span>
            </div>
            <h1>Community Stock Pairs &amp; Memes</h1>
            <p>
              Community tokens paired directly against 25 real tokenized stocks. Live bonding curves, instant trading, and Bubblemaps cluster audits.
            </p>
          </div>
          <div className="workspace-heading__actions">
            <Link className="button button--gradient" href="/launch">
              Launch Token Pair ↗
            </Link>
            <Link className="workspace-pill-link workspace-pill-link--secondary" href="/app">
              25 Tokenized Equities ↗
            </Link>
          </div>
        </header>

        <CommunityMarketHub initialTokens={tokens} />
      </div>

      <AppFooterNav />
    </main>
  );
}
