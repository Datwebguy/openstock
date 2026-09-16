"use client";

import Link from "next/link";
import { useState } from "react";
import { AccountIdentity } from "@/components/account-identity";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { PortfolioDashboard } from "@/components/portfolio-dashboard";
import { shortWallet, useWallet } from "@/components/wallet-session";

export default function WalletPage() {
  const { address, connecting, connect, connectEmail, disconnect, emailEnabled } = useWallet();

  const [copied, setCopied] = useState(false);

  async function onConnect() {
    try { await connect(); } catch { /* wallet UI already showed the reason */ }
  }
  async function onEmail() {
    try { await connectEmail(); } catch { /* Privy modal handles errors */ }
  }
  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return <main className="page">
    <AppNav ctaHref="/app" ctaLabel="Market" />
    <div className="app-page container wallet-page">
      <header className="app-market-header history-header">
        <div><h1>Wallet</h1><p className="workspace-description">Non-custodial Solana holdings &amp; activity.</p></div>
      </header>
      <section className="panel settings-panel">
        <div className="settings-panel__icon" aria-hidden="true">◒</div>
        <div className="settings-panel__body">
          <h2>{address ? shortWallet(address) : "Not connected"}</h2>
          <p className="settings-panel__address">
            {address 
              ? "Solana Mainnet account." 
              : "Connect Phantom or Solflare."}
          </p>
        </div>
        {address ? (
          <div className="settings-panel__actions">
            <span className="settings-panel__state">Connected</span>
            <button className="button button--light" type="button" onClick={copyAddress} title="Copy wallet address">
              {copied ? "Copied!" : "Copy address"}
            </button>
            <a 
              className="button button--light" 
              href={`https://solscan.io/account/${address}`} 
              target="_blank" 
              rel="noreferrer"
            >
              Solscan ↗
            </a>
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
