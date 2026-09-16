import { Suspense } from "react";
import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import { PortfolioDesk } from "@/components/portfolio-desk";
import "./portfolio.css";

export const metadata: Metadata = {
  title: "Portfolio & Creator Royalties — OpenStock",
  description: "Track your tokenized US equity holdings and claim accrued creator royalties in quote stocks from your launched token pairs on Solana.",
};

export default function PortfolioPage() {
  return (
    <main className="portfolio-page">
      <AppNav ctaHref="/launch" ctaLabel="+ Launch Pair" />
      <Suspense
        fallback={
          <div className="portfolio-container" style={{ padding: "64px 0", textAlign: "center", color: "var(--os-muted)" }}>
            Loading portfolio desk...
          </div>
        }
      >
        <PortfolioDesk />
      </Suspense>
    </main>
  );
}
