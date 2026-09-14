"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AccountIdentity } from "@/components/account-identity";
import { AppFooterNav, AppNav } from "@/components/app-nav";

type WalletProvider = { publicKey?: { toString: () => string } | null; connect: () => Promise<{ publicKey?: { toString: () => string } | null }> };

export default function YouPage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [message, setMessage] = useState("No wallet connected.");
  useEffect(() => {
    const browserWindow = window as Window & { solana?: WalletProvider; solflare?: WalletProvider };
    const address = browserWindow.solana?.publicKey?.toString() ?? browserWindow.solflare?.publicKey?.toString() ?? null;
    if (address) { setWallet(address); setMessage("Connected wallet detected."); }
  }, []);
  async function connect() {
    const browserWindow = window as Window & { solana?: WalletProvider; solflare?: WalletProvider };
    const provider = browserWindow.solana ?? browserWindow.solflare;
    if (!provider) { setMessage("Install Phantom or Solflare to connect."); return; }
    try {
      const result = await provider.connect();
      const address = result.publicKey?.toString() ?? provider.publicKey?.toString() ?? null;
      if (address) { setWallet(address); setMessage("Connected for user-approved signatures only."); }
    } catch { setMessage("Wallet connection was cancelled."); }
  }
  return <main className="page">
<AppNav ctaLabel="Choose stock" />
    <div className="app-page container">
      <header className="app-market-header history-header"><div><div className="eyebrow">Wallet settings</div><h1>You stay in control.</h1></div><p>OpenStock never creates, stores, or controls a wallet. Your wallet approves every live signature.</p></header>
      <section className="panel settings-panel"><div className="settings-panel__icon">◒</div><div><div className="eyebrow">Connection</div><h2>{wallet ? wallet.slice(0, 6) + "…" + wallet.slice(-4) : "No wallet connected"}</h2><p>{message}</p><button className="button button--gradient" type="button" onClick={connect}>{wallet ? "Wallet connected" : "Connect wallet"}</button></div></section>
      <section className="settings-grid"><article className="panel"><div className="eyebrow">Portfolio</div><h2>See what you hold.</h2><p>Read your SOL, USDC, and xStock balances with live public prices in a separate portfolio view.</p><Link className="button button--light" href="/app/you/portfolio">Open portfolio</Link></article><article className="panel"><div className="eyebrow">Market watches</div><h2>Follow a level.</h2><p>Save price or liquidity watch rules for any supported xStock.</p><Link className="button button--light" href="/app/alerts">Manage watches</Link></article><AccountIdentity /><article className="panel"><div className="eyebrow">Signing boundary</div><h2>User-approved only.</h2><p>OpenStock can prepare a route, but it cannot sign or broadcast without an explicit approval from your connected wallet.</p></article></section>
    </div>
    <AppFooterNav />
  </main>;
}
