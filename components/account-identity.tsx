"use client";

import { useEffect, useState } from "react";
import bs58 from "bs58";
import { shortWallet, useWallet } from "@/components/wallet-session";

export function AccountIdentity() {
  const { address, connect, signMessage } = useWallet();
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/account", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { account?: { wallet?: string } | null }) => {
        if (data.account?.wallet && data.account.wallet === address) setVerified(true);
      })
      .catch(() => undefined);
  }, [address]);

  async function verify() {
    setBusy(true);
    try {
      const walletAddress = address ?? await connect();
      if (!walletAddress) throw new Error("Connect a wallet first.");
      const challenge = await fetch("/api/account/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet: walletAddress }) }).then((response) => response.json() as Promise<{ message?: string; error?: string }>);
      if (!challenge.message) throw new Error(challenge.error ?? "Verification unavailable. Retry.");
      const signature = await signMessage(new TextEncoder().encode(challenge.message));
      const result = await fetch("/api/account/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet: walletAddress, signature: bs58.encode(signature) }) }).then((response) => response.json() as Promise<{ account?: unknown; error?: string }>);
      if (!result.account) throw new Error(result.error ?? "Verification failed. Retry.");
      setVerified(true);
      setMessage("Verified.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification cancelled.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel settings-card settings-card--verify">
    <div>
      <h2>Wallet Signature</h2>
      <p>{verified && address ? "Signature verified. Alerts & automation unlocked." : address ? "Optional one-click signature to sync cloud alerts." : "Connect wallet to sync alerts."}</p>
    </div>
    <button className="button button--light" type="button" onClick={() => void verify()} disabled={busy || verified}>{busy ? "Verifying..." : verified ? "Verified ✓" : address ? "Sign to verify" : "Connect wallet"}</button>
  </section>;
}
