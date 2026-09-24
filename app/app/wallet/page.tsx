"use client";

import Link from "next/link";
import { useState } from "react";
import { AccountIdentity } from "@/components/account-identity";
import { AppFooterNav, AppNav } from "@/components/app-nav";
import { PortfolioDashboard } from "@/components/portfolio-dashboard";
import { shortWallet, useWallet } from "@/components/wallet-session";
import { isMobile } from "@/components/wallet-deeplink";

export default function WalletPage() {
  const { address, connecting, connect, connectEmail, disconnect, emailEnabled, canSign } = useWallet();

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
        <div className="settings-panel__icon" aria-hidden="true">
          <img src="/logo/openstock-icon-transparent.png" alt="" width={32} height={32} />
        </div>
        <div className="settings-panel__body">
          <h2>{address ? shortWallet(address) : "Not connected"}</h2>
          <p className="settings-panel__address">
            {address
              ? canSign
                ? "Solana Mainnet — ready to sign."
                : "Address restored. Connect Phantom or Solflare to sign launches and trades."
              : "Browse without a wallet. Connect Phantom or Solflare to trade or launch."}
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
            {isMobile() ? (
              <>
                <button 
                  className="button button--gradient" 
                  type="button" 
                  onClick={() => window.location.href = "https://phantom.app/ul/v1/browse?ref=" + encodeURIComponent(window.location.href)}
                >
                  Open in Phantom App
                </button>
                <button 
                  className="button button--light" 
                  type="button" 
                  onClick={() => window.location.href = "https://solflare.com/wallet"}
                >
                  Open in Solflare App
                </button>
                {emailEnabled ? (
                  <button className="button button--light" type="button" onClick={() => void onEmail()} disabled={connecting}>
                    <svg width="16" height="16" viewBox="0 0 24 24" style={{ marginRight: 6, verticalAlign: "middle" }}>
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    Google / Email Login
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <button className="button button--gradient" type="button" onClick={() => void onConnect()} disabled={connecting}>{connecting ? "Connecting" : "Connect Phantom / Solflare"}</button>
                {emailEnabled ? (
                  <button className="button button--light" type="button" onClick={() => void onEmail()} disabled={connecting}>
                    <svg width="16" height="16" viewBox="0 0 24 24" style={{ marginRight: 6, verticalAlign: "middle" }}>
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    Google / Email Login
                  </button>
                ) : null}
              </>
            )}
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
