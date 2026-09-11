"use client";
/**
 * TokenList Component
 *
 * Displays all tokens managed by the active team and provides options
 * to create or import tokens based on user permissions.
 *
 * @component
 *
 * @returns {JSX.Element}
 * Main UI rendering including token grid, empty state, loading state,
 * and modals for token creation and import.
 *
 * This component acts as the entry point for token management within a team.
 * It fetches token metadata and balances, and renders a responsive grid
 * of token cards with key details.
 *
 * Features:
 * - Fetches team tokens from database
 * - Retrieves token balances for accurate supply display
 * - Displays token metadata (name, symbol, image, type)
 * - Supports Token-2022 extensions (transfer fee, non-transferable, interest-bearing)
 * - Provides navigation to token detail page
 *
 * Permissions:
 * - Only team owners and contributors can:
 *   - Create new tokens
 *   - Import existing tokens
 * - View-only users can browse token list
 *
 * UI States:
 * - Loading state with spinner
 * - Empty state with call-to-action (create/import)
 * - Token grid with responsive layout
 *
 * Helper Functions:
 * - `shortNumber`: Formats large numbers (K, M, B)
 * - `shortenAddress`: Truncates wallet/mint addresses
 * - `getSupply`: Calculates token supply from:
 *    - Live balance (preferred)
 *    - Fallback to initial supply from DB
 *
 * Token Card Details:
 * - Token image or placeholder icon
 * - Name, symbol, and shortened mint address
 * - Supply (formatted)
 * - Token type (fungible / NFT)
 * - Program type (Token-2022)
 * - Extension badges (if enabled)
 *
 * Modals:
 * - CreateTokenModal: For creating new tokens
 * - ImportTokenModal: For importing existing tokens
 */
import { useState } from "react";
import Link from "next/link";
import Button from "@/src/components/Button/ButtonVW";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import { useTokens, useTeamTokenBalances } from "@/src/hooks/useApi";
import CreateTokenModal from "@/src/components/CreateToken/CreateTokenModal";
import ImportTokenModal from "@/src/components/CreateToken/ImportTokenModal";
import { Coins, Download, ImageIcon, Key, PlusCircle, Shield } from "lucide-react";
import { useTranslations } from "next-intl";

function shortNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
}

export default function TokenList() {
  const { activeTeam } = useActiveTeam();
  const t = useTranslations("token");
  const { data: tokens, isLoading } = useTokens(activeTeam?.teamWalletAddress);
  const { data: balances } = useTeamTokenBalances(activeTeam?.teamWalletAddress);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const canManage = activeTeam?.isOwner || activeTeam?.isContributor;
  const shortenAddress = (addr: string, chars = 4) =>
    `${addr.slice(0, chars)}...${addr.slice(-chars)}`;

  const getSupply = (token: { mintAddress: string; decimals: number; initialSupply: string }) => {
    const bal = balances?.[token.mintAddress];
    if (bal) return shortNumber(bal.ui);
    const raw = BigInt(token.initialSupply || "0");
    if (raw === BigInt(0)) return "—";
    const dec = token.decimals || 0;
    const divisor = dec > 0 ? BigInt(10 ** dec) : BigInt(1);
    return shortNumber(Number(raw / divisor));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3>{t("Token Manager")}</h3>
          <p className="text-neutral-content mt-1 text-sm">
            {t("Create manage SPL tokens")}
            {activeTeam ? ` for ${activeTeam.name}` : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            
            <Button
              label={
                <>
                  <PlusCircle className="size-4.5" />
                  {t("Create Token")}
                </>
              }
              variant="primary"
              size="sm"
              onClick={() => setShowCreate(true)}
            />
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="loading loading-spinner loading-lg text-primary" />
        </div>
      )}

      {!isLoading && (!tokens || tokens.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Coins className="text-neutral-content/20 mb-4 size-12" />
          <p className="mb-1 text-lg font-semibold">{t("No tokens yet")}</p>
          <p className="text-neutral-content mb-6 max-w-sm text-sm">
            {canManage
              ? "Create a new Token-2022 token to manage it with your team."
              : "No tokens are managed by this team yet. Only owners and contributors can create tokens."}
          </p>
          {canManage && (
            <div className="flex gap-3">
              <Button
                label={
                  <>
                    <PlusCircle className="size-4.5" />
                    {t("Create Token")}
                  </>
                }
                variant="primary"
                size="sm"
                onClick={() => setShowCreate(true)}
              />
            </div>
          )}
        </div>
      )}

      {tokens && tokens.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tokens.map((token) => (
            <Link
              key={token.mintAddress}
              href={`/token/${token.mintAddress}`}
              className="bg-base-100 border-base-200 hover:border-primary/20 group rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="bg-base-200/80 border-base-300 group-hover:border-primary/30 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border transition-colors">
                  {token.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={token.imageUrl}
                      alt={token.symbol}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="text-neutral-content/30 h-7 w-7" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-lg font-bold">{token.name}</p>
                    {token.tokenType === "nft" && (
                      <span className="bg-accent/10 text-accent border-accent/20 rounded border px-1.5 py-0.5 text-xs font-bold">
                        {t("NFT")}
                      </span>
                    )}
                    {token.imported && (
                      <span className="bg-info/10 text-info border-info/20 rounded border px-1.5 py-0.5 text-xs font-bold">
                        {t("Imported")}
                      </span>
                    )}
                  </div>
                  <p className="text-neutral-content text-sm">
                    {token.symbol} ·{" "}
                    <span className="font-mono">{shortenAddress(token.mintAddress)}</span>
                  </p>
                </div>
              </div>

              <div className="border-base-200 mt-4 grid grid-cols-3 gap-3 border-t pt-4">
                <div>
                  <p className="text-neutral-content flex items-center gap-1">
                    <Coins className="size-5" />
                    {t("Supply")}
                  </p>
                  <p className="font-mono text-sm font-semibold">{getSupply(token)}</p>
                </div>
                <div>
                  <p className="text-neutral-content flex items-center gap-1">
                    <Key className="size-5" />
                    {t("Type")}
                  </p>
                  <span className="text-sm font-medium capitalize">{token.tokenType}</span>
                </div>
                <div>
                  <p className="text-neutral-content flex items-center gap-1">
                    <Shield className="size-5" />
                    {t("Program")}
                  </p>
                  <span className="text-sm font-medium">{t("Token 2022")}</span>
                </div>
              </div>

              {(token.extensions?.transferFee ||
                token.extensions?.nonTransferable ||
                token.extensions?.interestBearing) && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {token.extensions.transferFee && (
                    <span className="bg-accent/10 text-accent rounded px-1.5 py-0.5 text-xs font-medium">
                      {t("Transfer Fee")}
                    </span>
                  )}
                  {token.extensions.nonTransferable && (
                    <span className="bg-error/10 text-error rounded px-1.5 py-0.5 text-xs font-medium">
                      {t("Non Transferable")}
                    </span>
                  )}
                  {token.extensions.interestBearing && (
                    <span className="bg-info/10 text-info rounded px-1.5 py-0.5 text-xs font-medium">
                      {t("Interest Bearing")}
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <CreateTokenModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
      <ImportTokenModal isOpen={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
