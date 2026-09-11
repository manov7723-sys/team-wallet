"use client";
/**
 * @component HeaderVW
 *
 * Public navigation header for unauthenticated (guest) pages.
 *
 * Renders the Team Wallet logo and a context-aware right-side control:
 * - Not connected → "Connect Wallet" button opening the wallet modal
 * - Connected but no session → "Sign In" button triggering login()
 * - Authenticated → wallet address pill + logout button
 * Shows a loading spinner while auth state is resolving.
 *
 * @dependencies
 * - `useWallet`      — connected wallet state and public key
 * - `useWalletModal` — programmatic wallet selector modal trigger
 * - `useAuth`        — session state, login, logout, and user profile
 */

import Image from "next/image";
import Link from "next/link";
import Button from "../Button/ButtonVW";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "@/src/providers/AuthProvider";
import { LogOut, Shield, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";

export default function HeaderVW() {
  const { connected, publicKey } = useWallet();
  const t = useTranslations("header");
  const { setVisible } = useWalletModal();
  const { isAuthenticated, isLoading, logout, login, user } = useAuth();

  const shortenAddress = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  return (
    <nav
      className="navbar bg-base-100 sticky top-0 z-20 px-6 shadow-sm max-sm:px-3"
      aria-label="Main navigation"
    >
      <div className="container mx-auto flex items-center">
        <h1 className="navbar-start">
          <Link href="/" aria-label="Team Wallet home">
            <Image src="/images/TW-logo.png" width={200} height={77} alt="Team Wallet Logo" />
          </Link>
        </h1>
        <div className="navbar-end flex items-center gap-2">
          {isLoading ? (
            <div
              className="loading loading-spinner loading-sm text-primary"
              role="status"
              aria-label="Loading"
            />
          ) : isAuthenticated && connected && publicKey ? (
            <>
              <div className="border-base-200 bg-base-200/50 flex items-center gap-2 rounded-xl border px-3 py-2">
                <span
                  className="bg-success h-2 w-2 animate-pulse rounded-full"
                  aria-hidden="true"
                />
                <div className="flex flex-col">
                  {user?.name && (
                    <span className="text-sm leading-tight font-medium">{user.name}</span>
                  )}
                  <span
                    className={`text-neutral-content font-mono leading-tight ${user?.name ? "text-xs" : "text-base-content text-sm font-medium"}`}
                  >
                    {shortenAddress(publicKey.toBase58())}
                  </span>
                </div>
              </div>
              <Button
                label={<LogOut className="size-4.5" />}
                variant="ghost"
                size="sm"
                className="rounded-xl"
                onClick={logout}
                aria-label="Log out"
              />
            </>
          ) : connected && !isAuthenticated ? (
            <Button
              label={
                <>
                  <Shield className="size-4.5" />
                  {t("Sign In")}
                </>
              }
              variant="primary"
              size="sm"
              className="rounded-xl px-4"
              onClick={() => login()}
            />
          ) : (
            <Button
              label={
                <>
                  <Wallet className="size-4.5" />
                  {t("Connect Wallet")}
                </>
              }
              variant="primary"
              size="sm"
              className="rounded-xl px-4"
              onClick={() => setVisible(true)}
            />
          )}
        </div>
      </div>
    </nav>
  );
}
