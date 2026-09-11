"use client";
/**
 * @component Providers
 *
 * Composes all React context providers in the correct nesting order:
 * ReactQuery → Wallet → Auth → ActiveTeam.
 * Wrap the page tree with this once at the root layout level.
 */
import WalletProvider from "@/src/providers/WalletProvider";
import AuthProvider from "@/src/providers/AuthProvider";
import ReactQueryProvider from "@/src/providers/ReactQueryProvider";
import ActiveTeamProvider from "@/src/providers/ActiveTeamProvider";
import { type ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ReactQueryProvider>
      <WalletProvider>
        <AuthProvider>
          <ActiveTeamProvider>{children}</ActiveTeamProvider>
        </AuthProvider>
      </WalletProvider>
    </ReactQueryProvider>
  );
}
