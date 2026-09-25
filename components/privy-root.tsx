"use client";

import { type ReactNode, useEffect, useState } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmu7rgvjs00va0ekwi16117xy";

export function privyConfigured(): boolean {
  return Boolean(PRIVY_APP_ID && PRIVY_APP_ID.trim().length > 5);
}

function PrivyBridge() {
  const { login, logout, authenticated, user } = usePrivy();

  useEffect(() => {
    if (typeof window === "undefined") return;

    (window as Window & { __openstockPrivyLogin?: () => void }).__openstockPrivyLogin = () => {
      login();
    };

    (window as Window & { __openstockPrivyLogout?: () => void }).__openstockPrivyLogout = () => {
      void logout();
    };

    if (authenticated && user) {
      // Only promote a Solana-capable wallet into the shared session.
      const solanaAcc = user.linkedAccounts?.find(
        (a) => a.type === "wallet" && (a as { chainType?: string }).chainType === "solana"
      ) as { address?: string } | undefined;

      const walletAddress = solanaAcc?.address;
      if (walletAddress) {
        // View-only in the wallet session: this embedded wallet is not wired to sign OpenStock transactions.
        localStorage.setItem("openstock:privy-wallet", walletAddress);
        window.dispatchEvent(new Event("openstock:wallet-change"));
      } else if (user.email?.address) {
        // Email/Google identity only — do not invent a signing wallet address.
        localStorage.setItem("openstock:email", user.email.address);
      }
    }
  }, [login, logout, authenticated, user]);

  return null;
}

export function OptionalPrivyProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !privyConfigured()) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["google", "email", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#9945FF",
          logo: "/logo/openstock-icon-transparent.png",
          showWalletLoginFirst: false,
        },
      }}
    >
      <PrivyBridge />
      {children}
    </PrivyProvider>
  );
}
