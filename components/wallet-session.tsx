"use client";

import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  useWallet as useSolanaAdapterWallet,
  type Wallet,
} from "@solana/wallet-adapter-react";
import type { WalletName } from "@solana/wallet-adapter-base";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { privyConfigured } from "@/components/privy-root";

/** Written by the Privy bridge for email/Google users with an embedded wallet. View-only here: it cannot sign. */
export const PRIVY_WALLET_KEY = "openstock:privy-wallet";
const CHANGE_EVENT = "openstock:wallet-change";

type AnyTransaction = Transaction | VersionedTransaction;

type InjectedWallet = {
  publicKey?: { toString: () => string } | null;
  isConnected?: boolean;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString: () => string } | null } | void>;
  disconnect?: () => Promise<void>;
  signTransaction?: <T extends AnyTransaction>(transaction: T) => Promise<T>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }>;
  on?: (event: string, handler: (value?: { toString?: () => string } | string | null) => void) => void;
  off?: (event: string, handler: (value?: { toString?: () => string } | string | null) => void) => void;
};

export type WalletSession = {
  ready: boolean;
  /** Address of a live, signing-capable wallet — or a view-only Privy wallet (then canSign is false). */
  address: string | null;
  connecting: boolean;
  emailEnabled: boolean;
  /** True only when the connected wallet can sign transactions. Email/Google sessions cannot. */
  canSign: boolean;
  connect: (walletName?: string) => Promise<string | null>;
  connectEmail: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
  /** Signs a legacy or versioned transaction with the wallet that owns `address`. */
  signAnyTransaction: <T extends AnyTransaction>(transaction: T) => Promise<T>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;

  connected: boolean;
  publicKey: PublicKey | null;
  wallet: Wallet | null;
  wallets: Wallet[];
  select: (walletName: WalletName | null) => void;
  isWalletModalOpen: boolean;
  openWalletModal: () => void;
  closeWalletModal: () => void;
  switchAccount: () => Promise<void>;
};

const WalletContext = createContext<WalletSession | null>(null);

type InjectedWindow = {
  solana?: InjectedWallet & { isPhantom?: boolean };
  phantom?: { solana?: InjectedWallet };
  solflare?: InjectedWallet;
  backpack?: InjectedWallet;
  okxwallet?: { solana?: InjectedWallet };
  coinbaseSolana?: InjectedWallet;
};

/** The injected provider for a specific wallet — never "whatever window.solana happens to be". */
function injectedProviderFor(walletId: string): InjectedWallet | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as InjectedWindow;
  switch (walletId.toLowerCase()) {
    case "phantom":
      return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null);
    case "solflare":
      return w.solflare ?? null;
    case "backpack":
      return w.backpack ?? null;
    case "okx":
    case "okx wallet":
      return w.okxwallet?.solana ?? null;
    case "coinbase":
    case "coinbase wallet":
      return w.coinbaseSolana ?? null;
    default:
      return null;
  }
}

function readPrivyWallet(): string | null {
  try {
    return localStorage.getItem(PRIVY_WALLET_KEY);
  } catch {
    return null;
  }
}

export function WalletSessionProvider({ children }: { children: ReactNode }) {
  const adapter = useSolanaAdapterWallet();
  const [mounted, setMounted] = useState(false);
  const [injectedAddress, setInjectedAddress] = useState<string | null>(null);
  const injectedRef = useRef<InjectedWallet | null>(null);
  const [privyAddress, setPrivyAddress] = useState<string | null>(null);
  const [localConnecting, setLocalConnecting] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const emailEnabled = privyConfigured();

  useEffect(() => {
    setMounted(true);
    setPrivyAddress(readPrivyWallet());
    const onChange = () => setPrivyAddress(readPrivyWallet());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  // Track account switches / disconnects on a directly-connected injected provider.
  useEffect(() => {
    const provider = injectedRef.current;
    if (!provider || !injectedAddress) return;
    const onAccount = (value?: { toString?: () => string } | string | null) => {
      const key = value == null ? null : typeof value === "string" ? value : value.toString?.() ?? null;
      setInjectedAddress(key);
      if (!key) injectedRef.current = null;
    };
    const onDisconnect = () => {
      setInjectedAddress(null);
      injectedRef.current = null;
    };
    provider.on?.("accountChanged", onAccount);
    provider.on?.("disconnect", onDisconnect);
    return () => {
      provider.off?.("accountChanged", onAccount);
      provider.off?.("disconnect", onDisconnect);
    };
  }, [injectedAddress]);

  const adapterAddress = adapter.connected ? adapter.publicKey?.toBase58() ?? null : null;
  const signerAddress = adapterAddress ?? injectedAddress;
  const activeAddress = signerAddress ?? privyAddress;
  const canSign = Boolean(signerAddress) && (adapterAddress ? Boolean(adapter.signTransaction) : Boolean(injectedRef.current?.signTransaction));

  const connect = useCallback(async (walletName?: string): Promise<string | null> => {
    setLocalConnecting(true);
    try {
      if (walletName) {
        const matched = adapter.wallets.find(
          (w) =>
            w.adapter.name.toLowerCase() === walletName.toLowerCase() ||
            w.adapter.name.toLowerCase().includes(walletName.toLowerCase())
        );
        if (matched && (matched.readyState === "Installed" || matched.readyState === "Loadable")) {
          adapter.select(matched.adapter.name);
          // Connect the chosen adapter directly — calling the provider's connect() in the same tick as
          // select() would act on the previously selected wallet.
          await matched.adapter.connect();
          return matched.adapter.publicKey?.toBase58() ?? null;
        }
        const provider = injectedProviderFor(walletName);
        if (provider) {
          const res = await provider.connect();
          const key = (res && res.publicKey?.toString()) ?? provider.publicKey?.toString() ?? null;
          injectedRef.current = provider;
          setInjectedAddress(key);
          return key;
        }
        throw new Error(`${walletName} is not installed in this browser.`);
      }

      if (adapter.wallet && !adapter.connected) {
        await adapter.wallet.adapter.connect();
        return adapter.wallet.adapter.publicKey?.toBase58() ?? null;
      }
      if (signerAddress) return signerAddress;
      setIsWalletModalOpen(true);
      return null;
    } finally {
      setLocalConnecting(false);
    }
  }, [adapter, signerAddress]);

  const connectEmail = useCallback(async (): Promise<string | null> => {
    if (!emailEnabled) throw new Error("Email login is not configured.");
    const login = (window as Window & { __openstockPrivyLogin?: () => void }).__openstockPrivyLogin;
    if (!login) throw new Error("Email login is still starting. Try again in a moment.");
    login();
    return readPrivyWallet();
  }, [emailEnabled]);

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      if (adapter.connected) await adapter.disconnect();
    } catch {
      /* ignore */
    }
    try {
      await injectedRef.current?.disconnect?.();
    } catch {
      /* ignore */
    }
    injectedRef.current = null;
    setInjectedAddress(null);
    try {
      (window as Window & { __openstockPrivyLogout?: () => void }).__openstockPrivyLogout?.();
      localStorage.removeItem(PRIVY_WALLET_KEY);
      localStorage.removeItem("openstock:wallet");
    } catch {
      /* ignore */
    }
    setPrivyAddress(null);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [adapter]);

  const switchAccount = useCallback(async (): Promise<void> => {
    await disconnect();
    setIsWalletModalOpen(true);
  }, [disconnect]);

  const signAnyTransaction = useCallback(async <T extends AnyTransaction>(transaction: T): Promise<T> => {
    if (adapterAddress && adapter.signTransaction) return adapter.signTransaction(transaction);
    const provider = injectedRef.current;
    if (injectedAddress && provider?.signTransaction) return provider.signTransaction(transaction);
    throw new Error(
      privyAddress
        ? "Email and Google sessions can browse but not sign. Connect Phantom, Solflare, or another Solana wallet."
        : "Connect a Solana wallet to approve this transaction."
    );
  }, [adapter, adapterAddress, injectedAddress, privyAddress]);

  const signTransaction = useCallback(
    (transaction: VersionedTransaction) => signAnyTransaction(transaction),
    [signAnyTransaction]
  );

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (adapterAddress && adapter.signMessage) return adapter.signMessage(message);
    const provider = injectedRef.current;
    if (injectedAddress && provider?.signMessage) {
      const res = await provider.signMessage(message);
      return res instanceof Uint8Array ? res : res.signature;
    }
    throw new Error("Connect a Solana wallet that can sign messages.");
  }, [adapter, adapterAddress, injectedAddress]);

  const value = useMemo<WalletSession>(() => ({
    ready: mounted,
    address: activeAddress,
    connecting: adapter.connecting || localConnecting,
    emailEnabled,
    canSign,
    connect,
    connectEmail,
    disconnect,
    signTransaction,
    signAnyTransaction,
    signMessage,
    connected: Boolean(signerAddress),
    publicKey: signerAddress ? new PublicKey(signerAddress) : null,
    wallet: adapter.wallet,
    wallets: adapter.wallets,
    select: adapter.select,
    isWalletModalOpen,
    openWalletModal: () => setIsWalletModalOpen(true),
    closeWalletModal: () => setIsWalletModalOpen(false),
    switchAccount,
  }), [
    mounted, activeAddress, signerAddress, adapter.connecting, adapter.wallet, adapter.wallets, adapter.select,
    localConnecting, emailEnabled, canSign, connect, connectEmail, disconnect, signTransaction, signAnyTransaction,
    signMessage, isWalletModalOpen, switchAccount,
  ]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletSession {
  const session = useContext(WalletContext);
  if (!session) throw new Error("useWallet must be used inside WalletSessionProvider.");
  return session;
}

export function shortWallet(address: string | null): string | null {
  return address ? address.slice(0, 4) + "…" + address.slice(-4) : null;
}
