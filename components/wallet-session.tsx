"use client";

import { VersionedTransaction } from "@solana/web3.js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { privyConfigured } from "@/components/privy-root";
import { isMobile, connectPhantomMobile, connectSolflareMobile, detectMobileWallet } from "@/components/wallet-deeplink";

const STORAGE_KEY = "openstock:wallet";
const CHANGE_EVENT = "openstock:wallet-change";

type InjectedWallet = {
  publicKey?: { toString: () => string } | null;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString: () => string } | null }>;
  disconnect?: () => Promise<void>;
  signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }>;
  on?: (event: string, handler: (value?: { toString?: () => string } | string | null) => void) => void;
  off?: (event: string, handler: (value?: { toString?: () => string } | string | null) => void) => void;
};

export type WalletSession = {
  ready: boolean;
  address: string | null;
  connecting: boolean;
  emailEnabled: boolean;
  /** True when an injected Solana wallet can sign (Phantom/Solflare). Email/Google alone cannot. */
  canSign: boolean;
  connect: () => Promise<string | null>;
  connectEmail: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
};

const WalletContext = createContext<WalletSession | null>(null);

function injectedProvider(): InjectedWallet | null {
  if (typeof window === "undefined") return null;
  const current = window as Window & { solana?: InjectedWallet; phantom?: { solana?: InjectedWallet }; solflare?: InjectedWallet };
  return current.solana ?? current.phantom?.solana ?? current.solflare ?? null;
}

function readStored() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeStored(address: string | null) {
  try {
    if (address) localStorage.setItem(STORAGE_KEY, address);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* private mode */ }
}

export function WalletSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [canSign, setCanSign] = useState(false);
  const emailEnabled = privyConfigured();

  const refreshCanSign = useCallback(() => {
    const provider = injectedProvider();
    const live = provider?.publicKey?.toString?.() ?? null;
    setCanSign(Boolean(live && provider?.signTransaction));
  }, []);

  const apply = useCallback((next: string | null) => {
    setAddress(next);
    writeStored(next);
    refreshCanSign();
    if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [refreshCanSign]);

  useEffect(() => {
    let cancelled = false;
    const provider = injectedProvider();

    async function restore() {
      const stored = readStored();
      if (provider) {
        try {
          const trusted = await provider.connect({ onlyIfTrusted: true });
          const key = trusted.publicKey?.toString() ?? provider.publicKey?.toString() ?? null;
          if (!cancelled && key) {
            apply(key);
            setReady(true);
            return;
          }
        } catch { /* site is not yet trusted */ }
        const live = provider.publicKey?.toString() ?? null;
        if (!cancelled) apply(live ?? stored);
      } else if (!cancelled) {
        // Stored address without an injected signer = browse identity only
        apply(stored);
      }
      if (!cancelled) {
        refreshCanSign();
        setReady(true);
      }
    }

    void restore();

    const onAccount = (value?: { toString?: () => string } | string | null) => {
      if (value == null) { apply(null); return; }
      const key = typeof value === "string" ? value : value.toString?.() ?? injectedProvider()?.publicKey?.toString() ?? null;
      apply(key);
    };
    const onDisconnect = () => apply(null);
    const onChange = () => {
      const live = injectedProvider()?.publicKey?.toString() ?? readStored();
      setAddress(live);
      refreshCanSign();
    };
    provider?.on?.("accountChanged", onAccount);
    provider?.on?.("disconnect", onDisconnect);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      cancelled = true;
      provider?.off?.("accountChanged", onAccount);
      provider?.off?.("disconnect", onDisconnect);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, [apply, refreshCanSign]);

  const connect = useCallback(async () => {
    // Check if mobile first - use deep links for mobile wallet apps
    if (isMobile()) {
      const detectedWallet = detectMobileWallet();
      if (detectedWallet === "phantom") {
        connectPhantomMobile();
        return null;
      } else if (detectedWallet === "solflare") {
        connectSolflareMobile();
        return null;
      }
      // Default to Phantom deep link if no specific wallet detected
      connectPhantomMobile();
      return null;
    }
    
    const provider = injectedProvider();
    if (!provider) throw new Error("Install Phantom or Solflare to connect.");
    setConnecting(true);
    try {
      const result = await provider.connect();
      const key = result.publicKey?.toString() ?? provider.publicKey?.toString() ?? null;
      if (!key) throw new Error("Choose an account and retry.");
      apply(key);
      return key;
    } finally {
      setConnecting(false);
    }
  }, [apply]);

  const connectEmail = useCallback(async () => {
    if (!emailEnabled) throw new Error("Email login needs NEXT_PUBLIC_PRIVY_APP_ID.");
    const login = (window as Window & { __openstockPrivyLogin?: () => void }).__openstockPrivyLogin;
    if (!login) throw new Error("Email login is still starting. Try again in a moment.");
    login();
    // PrivyBridge writes openstock:wallet only when a Solana-linked account exists.
    return readStored();
  }, [emailEnabled]);

  const disconnect = useCallback(async () => {
    try { await injectedProvider()?.disconnect?.(); } catch { /* wallet may already be closed */ }
    try {
      (window as Window & { __openstockPrivyLogout?: () => void }).__openstockPrivyLogout?.();
    } catch { /* privy optional */ }
    try { localStorage.removeItem("openstock:email"); } catch { /* private mode */ }
    apply(null);
  }, [apply]);

  const signTransaction = useCallback(async (transaction: VersionedTransaction) => {
    const provider = injectedProvider();
    if (!provider?.signTransaction) {
      throw new Error("Connect Phantom or Solflare to sign. Email/Google login alone cannot approve Solana transactions.");
    }
    return provider.signTransaction(transaction);
  }, []);

  const signMessage = useCallback(async (message: Uint8Array) => {
    const provider = injectedProvider();
    if (!provider?.signMessage) {
      throw new Error("Connect Phantom or Solflare to verify. Email/Google login alone cannot sign messages.");
    }
    const signed = await provider.signMessage(message);
    return signed instanceof Uint8Array ? signed : signed.signature;
  }, []);

  const value = useMemo<WalletSession>(() => ({
    ready, address, connecting, emailEnabled, canSign, connect, connectEmail, disconnect, signTransaction, signMessage,
  }), [address, canSign, connect, connectEmail, connecting, disconnect, emailEnabled, ready, signMessage, signTransaction]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletSession {
  const session = useContext(WalletContext);
  if (!session) throw new Error("useWallet must be used inside WalletSessionProvider.");
  return session;
}

export function shortWallet(address: string | null) {
  return address ? address.slice(0, 4) + "…" + address.slice(-4) : null;
}
