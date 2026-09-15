"use client";

import Link from "next/link";
import { AccountIdentity } from "@/components/account-identity";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { PortfolioDashboard } from "@/components/portfolio-dashboard";
import { shortWallet, useWallet } from "@/components/wallet-session";

export default function WalletPage() {
  const { address, connecting, connect, connectEmail, disconnect, emailEnabled } = useWallet();

  async function onConnect() {
    try { await connect(); } catch { /* wallet UI already showed the reason */ }
  }
  async function onEmail() {
    try { await connectEmail(); } catch { /* Privy modal handles errors */ }
  }

  return <main className="page">
    <AppNav ctaHref="/app" ctaLabel="Market" />
    <div className="app-page container wallet-page">
      <header className="app-market-header history-header">
        <div><h1>Wallet</h1><p className="workspace-description">Your holdings and account, connected across the workspace.</p></div>
      </header>
      <section className="panel settings-panel">
        <div className="settings-panel__icon" aria-hidden="true">◒</div>
        <div className="settings-panel__body">
          <h2>{address ? shortWallet(address) : "Not connected"}</h2>
          <p className="settings-panel__address">{address ? "Same wallet across market, orders, and rules." : emailEnabled ? "Connect with Phantom, Solflare, or email." : "Connect with Phantom or Solflare to view your holdings."}</p>
          <small>OpenStock does not hold keys.</small>
        </div>
        {address ? (
          <div className="settings-panel__actions">
            <span className="settings-panel__state">Connected</span>
            <button className="button button--light" type="button" onClick={() => void disconnect()}>Disconnect</button>
          </div>
        ) : (
          <div className="settings-panel__actions">
            <button className="button button--gradient" type="button" onClick={() => void onConnect()} disabled={connecting}>{connecting ? "Connecting" : "Connect wallet"}</button>
            {emailEnabled ? <button className="button button--light" type="button" onClick={() => void onEmail()} disabled={connecting}>Email</button> : null}
          </div>
        )}
      </section>
      <PortfolioDashboard hideConnect />
      <section className="settings-grid">
        <article className="panel settings-card"><h2>Watches</h2><Link className="button button--light" href="/app/alerts">Manage</Link></article>
        <AccountIdentity />
      </section>
    </div>
    <AppFooterNav />
  </main>;
}
