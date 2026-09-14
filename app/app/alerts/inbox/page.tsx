import Link from "next/link";
import { MarketAlertInbox } from "@/components/market-alert-inbox";
import { AppFooterNav, AppNav } from "@/components/app-nav";

export default function AlertsInboxPage() {
  return <main className="page"><AppNav ctaLabel="Choose stock" /><div className="container app-page"><Link className="back-link" href="/app/alerts">← Market watches</Link><header className="app-market-header history-header"><div><div className="eyebrow">Alert inbox</div><h1>See what crossed your level.</h1></div><p>Alerts are evaluated while OpenStock is open. Open the stock to review price, liquidity, and issuer context before making a trade.</p></header><MarketAlertInbox /></div><AppFooterNav /></main>;
}
