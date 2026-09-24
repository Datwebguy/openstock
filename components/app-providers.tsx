"use client";

import { type ReactNode } from "react";
import { SolanaWalletProvider } from "@/components/solana-wallet-provider";
import { WalletSessionProvider, useWallet } from "@/components/wallet-session";
import { OptionalPrivyProvider } from "@/components/privy-root";
import { WalletSelectModal } from "@/components/wallet-select-modal";

function GlobalWalletModal() {
  const { isWalletModalOpen, closeWalletModal } = useWallet();
  return <WalletSelectModal isOpen={isWalletModalOpen} onClose={closeWalletModal} />;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SolanaWalletProvider>
      <OptionalPrivyProvider>
        <WalletSessionProvider>
          {children}
          <GlobalWalletModal />
        </WalletSessionProvider>
      </OptionalPrivyProvider>
    </SolanaWalletProvider>
  );
}
