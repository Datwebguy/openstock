import Link from "next/link";
import { Suspense } from "react";
import { AutomationReview } from "@/components/automation-review";
import { AppFooterNav, AppNav } from "@/components/app-nav";

export default function AutomationReviewPage() {
  return <main className="page"><AppNav ctaHref="/app/automation" ctaLabel="Back to automation" /><Suspense fallback={<div className="container app-page"><section className="panel"><strong>Loading review…</strong></section></div>}><AutomationReview /></Suspense><AppFooterNav /></main>;
}
