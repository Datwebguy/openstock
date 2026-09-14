import Link from "next/link";

type AppNavProps = {
  ctaHref?: string;
  ctaLabel?: string;
  hideCta?: boolean;
};

export function AppNav({ ctaHref = "/app", ctaLabel = "Browse stocks", hideCta = false }: AppNavProps) {
  return (
    <nav className="nav" aria-label="OpenStock navigation">
      <Link className="brand" href="/">
        <span className="brand-mark">◒</span> OpenStock
      </Link>
      <div className="nav-links">
        <Link href="/app">Market</Link>
        <Link href="/app/analytics">Analyze</Link>
        <Link href="/app/automation">Automate</Link>
        <Link href="/app/activity">Activity</Link>
        <Link href="/app/you">You</Link>
      </div>
      {!hideCta ? <Link className="button button--gradient nav-cta" href={ctaHref}><span className="nav-cta__desktop">{ctaLabel}</span><span className="nav-cta__mobile">Browse</span></Link> : null}
    </nav>
  );
}

export function AppFooterNav() {
  return (
    <div className="footer-nav" aria-label="OpenStock sections">
      <Link href="/app">Market</Link>
      <Link href="/app/analytics">Analyze</Link>
      <Link href="/app/automation">Automate</Link>
      <Link href="/app/activity">Activity</Link>
      <Link href="/app/you">You</Link>
    </div>
  );
}
