"use client";

import { type ReactNode, useMemo } from "react";
import { rpcRelayUrl } from "@/lib/client-rpc";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-adapter-mobile";


export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  // Same-origin relay: public mainnet RPC rejects browser origins.
  const endpoint = useMemo(() => rpcRelayUrl(), []);

  // Solana Mobile Wallet Adapter (MWA) enables native mobile wallet apps
  // (Phantom, Solflare, etc. on Android / Solana Mobile / Seeker / Saga) to connect and
  // pop up the address selection sheet.
  // Standard desktop & extension wallets are automatically discovered via Wallet Standard.
  const wallets = useMemo(() => {
    if (typeof window === "undefined") return [];

    try {
      return [
        new SolanaMobileWalletAdapter({
          addressSelector: createDefaultAddressSelector(),
          appIdentity: {
            name: "OpenStock",
            uri: window.location.origin,
            icon: "/logo/openstock-icon-transparent.png",
          },
          authorizationResultCache: createDefaultAuthorizationResultCache(),
          chain: "solana:mainnet",
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        }),
      ];
    } catch {
      return [];
    }
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
