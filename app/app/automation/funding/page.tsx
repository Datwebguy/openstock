import Link from "next/link";
import { Suspense } from "react";
import { AutomationFunding } from "@/components/automation-funding";
import { AppFooterNav, AppNav } from "@/components/app-nav";

export default function AutomationFundingPage() {
  return <main className="page"><AppNav ctaHref="/app/automation" ctaLabel="Back to automation" /><Suspense fallback={<div className="container app-page"><section className="panel"><strong>Loading funding review…</strong></section></div>}><AutomationFunding /></Suspense><AppFooterNav /></main>;
}
