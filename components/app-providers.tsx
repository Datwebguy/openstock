"use client";

import { type ReactNode } from "react";
import { WalletSessionProvider } from "@/components/wallet-session";
import { OptionalPrivyProvider } from "@/components/privy-root";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <OptionalPrivyProvider>
      <WalletSessionProvider>{children}</WalletSessionProvider>
    </OptionalPrivyProvider>
  );
}
