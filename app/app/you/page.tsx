"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AccountIdentity } from "@/components/account-identity";
import { AppFooterNav, AppNav } from "@/components/app-nav";

type WalletProvider = { publicKey?: { toString: () => string } | null; connect: () => Promise<{ publicKey?: { toString: () => string } | null }> };

export default function YouPage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const browserWindow = window as Window & { solana?: WalletProvider; solflare?: WalletProvider };
    const address = browserWindow.solana?.publicKey?.toString() ?? browserWindow.solflare?.publicKey?.toString() ?? null;
    if (address) { setWallet(address); setMessage("Connected."); }
  }, []);
  async function connect() {
    const browserWindow = window as Window & { solana?: WalletProvider; solflare?: WalletProvider };
    const provider = browserWindow.solana ?? browserWindow.solflare;
    if (!provider) { setMessage("Install Phantom or Solflare to connect."); return; }
    try {
      const result = await provider.connect();
      const address = result.publicKey?.toString() ?? provider.publicKey?.toString() ?? null;
      if (address) { setWallet(address); setMessage("Connected."); }
    } catch { setMessage("Wallet connection was cancelled."); }
  }
  return <main className="page">
<AppNav ctaHref="/app" ctaLabel="Market" />
    <div className="app-page container you-page">
      <header className="app-market-header history-header you-page__header"><div><h1>You</h1></div></header>
      <section className="panel settings-panel">
        <div className="settings-panel__icon" aria-hidden="true">◒</div>
        <div className="settings-panel__body"><h2>Wallet</h2><p>{wallet ? wallet.slice(0, 6) + "…" + wallet.slice(-4) : "Not connected"}</p><small>OpenStock does not hold keys.</small>{message ? <small>{message}</small> : null}</div>
        <button className="button button--gradient" type="button" onClick={connect}>{wallet ? "Connected" : "Connect wallet"}</button>
      </section>
      <section className="settings-grid"><article className="panel settings-card"><h2>Holdings</h2><Link className="button button--light" href="/app/you/portfolio">Open</Link></article><article className="panel settings-card"><h2>Watches</h2><Link className="button button--light" href="/app/alerts">Manage</Link></article><AccountIdentity /></section>
    </div>
    <AppFooterNav />
  </main>;
}
