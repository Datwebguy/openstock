import Link from "next/link";
import { MarketAlertInbox } from "@/components/market-alert-inbox";
import { AppFooterNav, AppNav } from "@/components/app-nav";

export default function AlertsInboxPage() {
  return <main className="page"><AppNav ctaHref="/app" ctaLabel="Market" /><div className="container app-page"><Link className="back-link" href="/app/alerts">← Market watches</Link><header className="app-market-header history-header"><div><div className="eyebrow">Alerts</div><h1>Triggered Watches</h1></div><p className="workspace-description">Automated price and liquidity notifications triggered on Solana.</p></header><MarketAlertInbox /></div><AppFooterNav /></main>;
}
