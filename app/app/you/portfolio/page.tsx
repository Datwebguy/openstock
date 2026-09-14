import Link from "next/link";
import { PortfolioDashboard } from "@/components/portfolio-dashboard";
import { AppFooterNav, AppNav } from "@/components/app-nav";

export default function PortfolioPage() {
return <main className="page"><AppNav /><div className="container app-page"><Link href="/app/you" className="back-link">← Wallet settings</Link><header className="app-market-header history-header"><div><div className="eyebrow">Portfolio</div><h1>Know what you hold.</h1></div><p>A read-only view of your Solana wallet, current xStock value, and the data needed before performance can be measured honestly.</p></header><PortfolioDashboard /></div><AppFooterNav /></main>;
}
