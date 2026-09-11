"use client";
/**
 * @component UserHeaderVW
 *
 * Sticky top navigation bar for all authenticated pages.
 *
 * Renders the Team Wallet logo, a mobile sidebar toggle, a notification
 * bell badge showing pending proposal count (linking to the transaction
 * page), the connected wallet address with one-click copy, and a
 * sign-out button. Falls back to a "Connect Wallet" link for
 * unauthenticated users viewing public transaction pages.
 *
 * @dependencies
 * - `useWallet`             — connected wallet public key
 * - `useAuth`               — session state, user profile, and logout
 * - `useActiveTeam`         — active team address for notification link routing
 * - `usePendingVoteCount`   — count of proposals awaiting the user's vote
 */

import { Bars3Icon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import Button from "../Button/ButtonVW";
import { Copy, Check, Bell, LogOut, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/src/providers/AuthProvider";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import { usePendingVoteCount } from "@/src/hooks/usePendingProposals";
import { useTranslations } from "next-intl";

interface TopBarProps {
  setMobileOpen: (v: boolean) => void;
}

const UserHeaderVW = ({ setMobileOpen }: TopBarProps) => {
  const [copied, setCopied] = useState(false);
  const { publicKey } = useWallet();
  const t = useTranslations("header");
  const { user, isAuthenticated, logout } = useAuth();
  const { activeTeam } = useActiveTeam();
  const pendingCount = usePendingVoteCount(activeTeam?.teamWalletAddress);

  const walletAddress = publicKey?.toBase58() || "";
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : "";

  const handleCopy = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <header
      className="border-border bg-base-100 sticky top-0 z-30 flex h-16 items-center justify-between border-b px-6 max-sm:px-3"
      aria-label="Dashboard header"
    >
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-4 max-sm:gap-0">
          <Button
            label={<Bars3Icon className="size-6 max-sm:size-5" />}
            variant="ghost"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden"
            size="xs"
            aria-label="Open navigation menu"
          />
          <h1>
            <Image
              src="/images/TW-logo.png"
              alt="Team Wallet"
              width={150}
              height={44}
              className="max-md:w-36"
              style={{ height: "auto" }}
            />
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && pendingCount > 0 && (
            <Link
              href={activeTeam ? `/transaction/${activeTeam.teamWalletAddress}` : "/transaction"}
              className="border-glass-border bg-secondary/50 hover:bg-secondary relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors"
              aria-label={`${pendingCount} pending proposals`}
            >
              <Bell className="text-base-content size-4.5" aria-hidden="true" />
              <span
                className="bg-primary text-primary-content absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-xs leading-none font-bold"
                aria-hidden="true"
              >
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            </Link>
          )}

          {isAuthenticated && walletAddress ? (
            <>
              <div className="border-glass-border bg-secondary/50 flex items-center gap-2 rounded-xl border px-4 py-2.5 max-md:p-2">
                <span
                  className="bg-success h-2 w-2 animate-pulse rounded-full"
                  aria-hidden="true"
                />
                <div className="flex flex-col">
                  {user?.name && (
                    <span className="text-base-content text-sm leading-tight font-medium">
                      {user.name}
                    </span>
                  )}
                  <span
                    className={`text-neutral-content font-mono leading-tight ${user?.name ? "text-xs" : "text-base-content text-sm font-medium"}`}
                  >
                    {shortAddress}
                  </span>
                </div>
                <Button
                  label={
                    copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />
                  }
                  variant="ghost"
                  size="xs"
                  className="text-neutral-content hover:text-primary transition-colors"
                  onClick={handleCopy}
                  aria-label={copied ? "Address copied" : "Copy wallet address"}
                />
              </div>
              <Button
                label={<LogOut className="size-3.5" />}
                variant="error"
                size="sm"
                onClick={logout}
                className="btn-outline"
                aria-label="Log out"
              />
            </>
          ) : (
            <Link
              href="/"
              className="bg-primary text-primary-content inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:brightness-110"
            >
              <Wallet className="size-4.5" />
              {t("Connect Wallet")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default UserHeaderVW;
