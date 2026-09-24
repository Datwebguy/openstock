"use client";

import { PublicKey, VersionedTransaction } from "@solana/web3.js";
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
  useState,
  type ReactNode,
} from "react";
import { privyConfigured } from "@/components/privy-root";
import {
  isInAppBrowser,
  isMobile,
  openPhantomMobile,
  openSolflareMobile,
  openMobileWallet,
} from "@/components/wallet-deeplink";

const STORAGE_KEY = "openstock:wallet";
const CHANGE_EVENT = "openstock:wallet-change";

type InjectedWallet = {
  publicKey?: { toString: () => string; toBase58?: () => string } | null;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey?: { toString: () => string; toBase58?: () => string } | null;
  }>;
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
  connect: (walletName?: string) => Promise<string | null>;
  connectEmail: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;

  // Rich Solana Wallet Adapter properties
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

function injectedProvider(): InjectedWallet | null {
  if (typeof window === "undefined") return null;
  const current = window as unknown as {
    solana?: InjectedWallet;
    phantom?: { solana?: InjectedWallet };
    solflare?: InjectedWallet;
    backpack?: InjectedWallet;
  };
  return current.solana ?? current.phantom?.solana ?? current.solflare ?? current.backpack ?? null;
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(address: string | null): void {
  try {
    if (address) localStorage.setItem(STORAGE_KEY, address);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export function WalletSessionProvider({ children }: { children: ReactNode }) {
  const adapter = useSolanaAdapterWallet();
  const [mounted, setMounted] = useState(false);
  const [storedAddress, setStoredAddress] = useState<string | null>(null);
  const [localConnecting, setLocalConnecting] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const emailEnabled = privyConfigured();

  // Track client hydration
  useEffect(() => {
    setMounted(true);
    setStoredAddress(readStored());
  }, []);

  // Compute live active address: preference is active adapter public key, then fallback to stored
  const adapterAddress = useMemo(() => {
    return adapter.publicKey?.toBase58() ?? null;
  }, [adapter.publicKey]);

  const activeAddress = adapterAddress || storedAddress;

  // Persist active address to localStorage and dispatch change event
  useEffect(() => {
    if (!mounted) return;
    if (adapterAddress) {
      writeStored(adapterAddress);
      setStoredAddress(adapterAddress);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  }, [adapterAddress, mounted]);

  // Listen to external wallet changes & native accountChanged event
  useEffect(() => {
    if (!mounted) return;

    const onStorageOrCustomChange = () => {
      const stored = readStored();
      setStoredAddress(stored);
    };

    const provider = injectedProvider();
    const onAccount = (value?: { toString?: () => string } | string | null) => {
      if (value == null) {
        setStoredAddress(null);
        writeStored(null);
      } else {
        const key = typeof value === "string" ? value : value.toString?.() ?? null;
        setStoredAddress(key);
        writeStored(key);
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    };

    const onDisconnect = () => {
      setStoredAddress(null);
      writeStored(null);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    };

    provider?.on?.("accountChanged", onAccount);
    provider?.on?.("disconnect", onDisconnect);
    window.addEventListener(CHANGE_EVENT, onStorageOrCustomChange);
    window.addEventListener("storage", onStorageOrCustomChange);

    return () => {
      provider?.off?.("accountChanged", onAccount);
      provider?.off?.("disconnect", onDisconnect);
      window.removeEventListener(CHANGE_EVENT, onStorageOrCustomChange);
      window.removeEventListener("storage", onStorageOrCustomChange);
    };
  }, [mounted]);

  // Determine if the user can sign transactions
  const canSign = useMemo(() => {
    if (!activeAddress) return false;
    if (adapter.connected && Boolean(adapter.signTransaction)) return true;
    const provider = injectedProvider();
    return Boolean(provider?.publicKey && provider?.signTransaction);
  }, [activeAddress, adapter.connected, adapter.signTransaction]);

  const openWalletModal = useCallback(() => {
    setIsWalletModalOpen(true);
  }, []);

  const closeWalletModal = useCallback(() => {
    setIsWalletModalOpen(false);
  }, []);

  // Universal Connect handler
  const connect = useCallback(async (walletName?: string): Promise<string | null> => {
    setLocalConnecting(true);
    try {
      if (walletName) {
        // Find matching wallet in adapter
        const matched = adapter.wallets.find(
          (w) => w.adapter.name.toLowerCase() === walletName.toLowerCase()
        );
        if (matched) {
          adapter.select(matched.adapter.name);
          await adapter.connect();
          const key = adapter.publicKey?.toBase58() ?? null;
          if (key) {
            writeStored(key);
            setStoredAddress(key);
            return key;
          }
        }
      }

      // If adapter already has a selected wallet, attempt connect
      if (adapter.wallet) {
        await adapter.connect();
        const key = adapter.publicKey?.toBase58() ?? null;
        if (key) {
          writeStored(key);
          setStoredAddress(key);
          return key;
        }
      }

      // Try injected provider directly
      const provider = injectedProvider();
      if (provider) {
        const res = await provider.connect();
        const key = res.publicKey?.toString?.() ?? provider.publicKey?.toString?.() ?? null;
        if (key) {
          writeStored(key);
          setStoredAddress(key);
          window.dispatchEvent(new Event(CHANGE_EVENT));
          return key;
        }
      }

      // If not connected and no direct provider, pop up modal to choose
      setIsWalletModalOpen(true);
      return null;
    } finally {
      setLocalConnecting(false);
    }
  }, [adapter]);

  const connectEmail = useCallback(async (): Promise<string | null> => {
    if (!emailEnabled) throw new Error("Email login needs NEXT_PUBLIC_PRIVY_APP_ID.");
    const login = (window as Window & { __openstockPrivyLogin?: () => void }).__openstockPrivyLogin;
    if (!login) throw new Error("Email login is still starting. Try again in a moment.");
    login();
    return readStored();
  }, [emailEnabled]);

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      if (adapter.connected) {
        await adapter.disconnect();
      }
    } catch {
      /* ignore */
    }

    try {
      const provider = injectedProvider();
      await provider?.disconnect?.();
    } catch {
      /* ignore */
    }

    try {
      (window as Window & { __openstockPrivyLogout?: () => void }).__openstockPrivyLogout?.();
    } catch {
      /* ignore */
    }

    writeStored(null);
    setStoredAddress(null);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [adapter]);

  // Switch Account handler: prompts the user to select another address
  const switchAccount = useCallback(async (): Promise<void> => {
    await disconnect();
    // Re-open wallet selection modal so user can choose or re-authenticate
    setIsWalletModalOpen(true);
  }, [disconnect]);

  const signTransaction = useCallback(async (transaction: VersionedTransaction): Promise<VersionedTransaction> => {
    if (adapter.connected && adapter.signTransaction) {
      return adapter.signTransaction(transaction);
    }

    const provider = injectedProvider();
    if (provider?.signTransaction) {
      return provider.signTransaction(transaction);
    }

    throw new Error(
      "Connect a Solana wallet (Phantom, Solflare, etc.) to approve transactions. Email or guest sessions cannot sign."
    );
  }, [adapter.connected, adapter.signTransaction]);

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (adapter.connected && adapter.signMessage) {
      return adapter.signMessage(message);
    }

    const provider = injectedProvider();
    if (provider?.signMessage) {
      const res = await provider.signMessage(message);
      return res instanceof Uint8Array ? res : res.signature;
    }

    throw new Error(
      "Connect a Solana wallet (Phantom, Solflare, etc.) to verify signature. Email or guest sessions cannot sign."
    );
  }, [adapter.connected, adapter.signMessage]);

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
    signMessage,

    // Rich Solana Wallet Adapter features
    connected: adapter.connected || Boolean(activeAddress),
    publicKey: adapter.publicKey,
    wallet: adapter.wallet,
    wallets: adapter.wallets,
    select: adapter.select,
    isWalletModalOpen,
    openWalletModal,
    closeWalletModal,
    switchAccount,
  }), [
    mounted,
    activeAddress,
    adapter.connecting,
    adapter.connected,
    adapter.publicKey,
    adapter.wallet,
    adapter.wallets,
    adapter.select,
    localConnecting,
    emailEnabled,
    canSign,
    connect,
    connectEmail,
    disconnect,
    signTransaction,
    signMessage,
    isWalletModalOpen,
    openWalletModal,
    closeWalletModal,
    switchAccount,
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
