import Link from "next/link";
import { PortfolioDashboard } from "@/components/portfolio-dashboard";
import { AppFooterNav, AppNav } from "@/components/app-nav";

export default function PortfolioPage() {
return <main className="page"><AppNav ctaHref="/app" ctaLabel="Market" /><div className="container app-page"><Link href="/app/you" className="back-link">← You</Link><header className="app-market-header history-header"><div><h1>Portfolio</h1></div></header><PortfolioDashboard /></div><AppFooterNav /></main>;
}
