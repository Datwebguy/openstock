"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { shortWallet, useWallet } from "@/components/wallet-session";

type AppNavProps = {
  ctaHref?: string;
  ctaLabel?: string;
  hideCta?: boolean;
};

function WalletLink() {
  const { address, ready } = useWallet();
  const label = ready && address ? shortWallet(address) : "Wallet";
  const pathname = usePathname();
  return <Link href="/app/wallet" aria-current={pathname === "/app/wallet" ? "page" : undefined}>{label}</Link>;
}

export function AppNav({ ctaHref = "/app", ctaLabel = "Browse stocks", hideCta = false }: AppNavProps) {
  const pathname = usePathname();
  const primary = [["/app", "Market"], ["/launch", "Launch"], ["/app/analytics", "Analyze"], ["/app/automation", "Automate"], ["/app/activity", "Activity"]];
  const secondary = [["/app/news", "News"], ["/app/alerts", "Watches"], ["/app/alerts/inbox", "Alert inbox"], ["/app/actions", "Events"], ["/app/learn/multipliers", "Share adjustments"]];
  const active = (href: string) => pathname === href || (href === "/app" && pathname.startsWith("/app/asset/")) || (href === "/app/automation" && pathname.startsWith(href + "/"));
  return (
    <><nav className="nav workspace-nav" aria-label="OpenStock navigation">
      <Link className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">◒</span> OpenStock
      </Link>
      <div className="nav-links">
        {primary.map(([href, label]) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>{label}</Link>)}
        <WalletLink />
      </div>
      <div className="nav-tools">
        <ThemeToggle />
        {!hideCta ? <Link className="button button--gradient nav-cta" href={ctaHref}><span className="nav-cta__desktop">{ctaLabel}</span><span className="nav-cta__mobile">Browse</span></Link> : null}
      </div>
    </nav><nav className="workspace-utilities" aria-label="Research and monitoring">{secondary.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav></>
  );
}

export function AppFooterNav() {
  const pathname = usePathname();
  return (
    <nav className="footer-nav" aria-label="OpenStock sections">
      {[["/app", "Market"], ["/launch", "Launch"], ["/app/analytics", "Analyze"], ["/app/automation", "Automate"], ["/app/activity", "Activity"], ["/app/wallet", "Wallet"]].map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href || (href === "/app/automation" && pathname.startsWith(href + "/")) ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
