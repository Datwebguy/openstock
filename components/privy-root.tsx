"use client";

import { type ReactNode, useEffect } from "react";
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
      // Find linked Solana wallet or embedded wallet
      const solanaAcc = user.linkedAccounts?.find(
        (a) => a.type === "wallet" && (a as { chainType?: string }).chainType === "solana"
      ) as { address?: string } | undefined;

      const walletAddress = solanaAcc?.address || user.wallet?.address;
      if (walletAddress) {
        localStorage.setItem("openstock:wallet", walletAddress);
        window.dispatchEvent(new Event("openstock:wallet-change"));
      } else if (user.email?.address) {
        // If logged in via email/google without a native wallet yet, save identity for session
        localStorage.setItem("openstock:email", user.email.address);
      }
    }
  }, [login, logout, authenticated, user]);

  return null;
}

export function OptionalPrivyProvider({ children }: { children: ReactNode }) {
  if (!privyConfigured()) {
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
