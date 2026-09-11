"use client";
/**
 * TokenDetail Component
 *
 * Displays detailed information about a specific token and enables
 * on-chain governance actions such as minting, burning, transferring,
 * freezing, thawing, and authority management via proposals.
 *
 * @component
 *
 * @param {Object} props - Component props
 * @param {Promise<{ mintAddress: string }>} props.params - Route params containing token mint address
 *
 * @returns {JSX.Element}
 * Main UI rendering including token metadata, balances, authorities,
 * and action controls with proposal-based execution.
 *
 *
 * This component integrates on-chain Solana data with off-chain database
 * metadata to provide a complete token management interface.
 *
 * Features:
 * - Fetches token mint data (supply, decimals, authorities) from blockchain
 * - Retrieves team token balance and frozen state using associated token accounts
 * - Displays token metadata (name, symbol, image, extensions)
 * - Calculates locked balances based on pending proposals
 * - Dynamically enables/disables actions based on:
 *   - User role (owner/contributor)
 *   - Authority ownership (mint/freeze authority)
 *   - Token state (frozen/unfrozen)
 *   - Pending proposal conflicts
 *
 * Actions (Proposal-based):
 * - Mint tokens to treasury or custom address
 * - Burn tokens from team balance
 * - Transfer tokens to another wallet
 * - Freeze / thaw token account
 * - Transfer or revoke mint authority
 * - Transfer or revoke freeze authority
 *
 * Validation & Safety:
 * - Prevents duplicate or conflicting proposals
 * - Restricts actions when token account is frozen
 * - Validates wallet addresses and numeric inputs
 * - Ensures sufficient balance before burn/send
 * - Tracks optimistic UI state for pending actions
 *
 * State Management:
 * - Uses React Query for on-chain and balance fetching
 * - Uses custom hooks for proposals and transaction handling
 * - Maintains modal state for different token actions
 * - Handles optimistic blocking for singular operations
 *
 * Blockchain Interaction:
 * - Builds proposal instructions using `buildCreateProposalIx`
 * - Executes transactions via wallet adapter
 * - Syncs UI after confirmation by invalidating proposal queries
 *
 *  On-chain state for secure multi-sig token management.
 */
import { use, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Button from "@/src/components/Button/ButtonVW";
import Input from "@/src/components/Input/InputVW";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import { useTokens } from "@/src/hooks/useApi";
import { useTransaction } from "@/src/hooks/useTransaction";
import { usePendingProposals } from "@/src/hooks/usePendingProposals";
import { useInvalidateAllProposals } from "@/src/hooks/useAllProposals";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { buildCreateProposalIx, type ProposalAction } from "@/src/lib/web3";
import { explorerAddressLink } from "@/src/lib/explorer";
import {
  ArrowLeft,
  Coins,
  Copy,
  ExternalLink,
  Flame,
  ImageIcon,
  Key,
  Loader2,
  Lock,
  Send,
  Shield,
  Snowflake,
  Unlock,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

type ModalType =
  | "mint"
  | "burn"
  | "send"
  | "freeze"
  | "thaw"
  | "transferMintAuth"
  | "transferFreezeAuth"
  | null;

interface OnChainMint {
  supply: string;
  decimals: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  isToken2022: boolean;
}

export default function TokenDetail({ params }: { params: Promise<{ mintAddress: string }> }) {
  const { mintAddress } = use(params);
  const t = useTranslations("token");
  const router = useRouter();
  const { activeTeam } = useActiveTeam();
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const tx = useTransaction();
  const invalidateProposals = useInvalidateAllProposals();
  const { data: tokens } = useTokens(activeTeam?.teamWalletAddress);

  const tokenDb = useMemo(
    () => tokens?.find((t) => t.mintAddress === mintAddress),
    [tokens, mintAddress]
  );
  const teamAddress = activeTeam?.teamWalletAddress || "";

  const { data: onChain, isLoading: mintLoading } = useQuery<OnChainMint | null>({
    queryKey: ["mintOnChain", mintAddress],
    queryFn: async () => {
      const pk = new PublicKey(mintAddress);
      let mintData: any;
      let isToken2022 = true;
      try {
        mintData = await getMint(connection, pk, "confirmed", TOKEN_2022_PROGRAM_ID);
      } catch {
        mintData = await getMint(connection, pk, "confirmed", TOKEN_PROGRAM_ID);
        isToken2022 = false;
      }
      return {
        supply: mintData.supply.toString(),
        decimals: mintData.decimals,
        mintAuthority: mintData.mintAuthority?.toBase58() || null,
        freezeAuthority: mintData.freezeAuthority?.toBase58() || null,
        isToken2022,
      };
    },
    enabled: !!mintAddress,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  const { data: teamTokenBalance } = useQuery<{ raw: string; ui: number; frozen: boolean } | null>({
    queryKey: ["teamTokenBalance", teamAddress, mintAddress],
    queryFn: async () => {
      if (!teamAddress) return null;
      const mintPk = new PublicKey(mintAddress);
      const teamPDA = new PublicKey(teamAddress);
      const programId = onChain?.isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      const ata = await getAssociatedTokenAddress(mintPk, teamPDA, true, programId);
      try {
        const info = await connection.getParsedAccountInfo(ata);
        const parsed = (info.value?.data as any)?.parsed?.info;
        if (!parsed) return { raw: "0", ui: 0, frozen: false };
        return {
          raw: parsed.tokenAmount?.amount || "0",
          ui: parsed.tokenAmount?.uiAmount || 0,
          frozen: parsed.state === "frozen",
        };
      } catch {
        return { raw: "0", ui: 0, frozen: false };
      }
    },
    enabled: !!teamAddress && !!mintAddress && !!onChain,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  const { data: pendingProposals } = usePendingProposals(teamAddress);

  const lockedAmount = useMemo(() => {
    if (!pendingProposals) return BigInt(0);
    let locked = BigInt(0);
    for (const p of pendingProposals) {
      const a = p.action as any;
      if (a.tokenBurn && a.tokenBurn.mint === mintAddress) {
        locked += BigInt(a.tokenBurn.amount);
      }
      if (a.transferToken && a.transferToken.mint === mintAddress) {
        locked += BigInt(a.transferToken.amount);
      }
      if (a.swap && a.swap.inputMint === mintAddress) {
        locked += BigInt(a.swap.amountIn);
      }
    }
    return locked;
  }, [pendingProposals, mintAddress]);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [formValue, setFormValue] = useState("");
  const [formValue2, setFormValue2] = useState("");
  const [formValue3, setFormValue3] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [addressError, setAddressError] = useState("");

  const [optimisticBlocked, setOptimisticBlocked] = useState<Set<ModalType>>(new Set());

  const pendingActionTypes = useMemo((): Set<ModalType> => {
    const blocked = new Set<ModalType>(optimisticBlocked);
    if (!pendingProposals) return blocked;
    for (const p of pendingProposals) {
      const a = p.action as any;
      if (a.tokenMint && a.tokenMint.mint === mintAddress) blocked.add("mint");
      if (a.tokenBurn && a.tokenBurn.mint === mintAddress) blocked.add("burn");
      if (a.transferToken && a.transferToken.mint === mintAddress) blocked.add("send");
      if (a.tokenFreeze && a.tokenFreeze.mint === mintAddress) blocked.add("freeze");
      if (a.tokenThaw && a.tokenThaw.mint === mintAddress) blocked.add("thaw");
      if (a.tokenSetMintAuthority && a.tokenSetMintAuthority.mint === mintAddress)
        blocked.add("transferMintAuth");
      if (a.tokenSetFreezeAuthority && a.tokenSetFreezeAuthority.mint === mintAddress)
        blocked.add("transferFreezeAuth");
    }
    return blocked;
  }, [pendingProposals, mintAddress, optimisticBlocked]);
  const SINGULAR_ACTIONS = new Set<ModalType>([
    "freeze",
    "thaw",
    "transferMintAuth",
    "transferFreezeAuth",
  ]);

  const labelMap: Record<NonNullable<ModalType>, string> = {
    mint: "Mint",
    burn: "Burn",
    send: "Send",
    freeze: "Freeze",
    thaw: "Thaw",
    transferMintAuth: "Transfer Mint Authority",
    transferFreezeAuth: "Transfer Freeze Authority",
  };
  const CONFLICTS: Partial<Record<NonNullable<ModalType>, ModalType[]>> = {
    mint: ["transferMintAuth", "thaw"],
    burn: ["transferMintAuth"],
    send: [],
    freeze: ["send", "transferFreezeAuth", "mint", "burn", "thaw"],
    thaw: ["thaw", "mint", "transferFreezeAuth"],
    transferMintAuth: ["mint", "thaw", "transferMintAuth"],
    transferFreezeAuth: ["thaw", "transferFreezeAuth", "mint"],
  };

  const getConflict = (action: NonNullable<ModalType>): string | null => {
    const isFrozen = teamTokenBalance?.frozen ?? false;
    if (action !== "freeze" && !isFrozen && pendingActionTypes.has("freeze")) {
      return labelMap["freeze"];
    }
    for (const conflict of CONFLICTS[action] ?? []) {
      if (pendingActionTypes.has(conflict)) return labelMap[conflict!];
    }
    return null;
  };

  useEffect(() => {
    if (optimisticBlocked.size > 0) {
      setOptimisticBlocked(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingProposals]);

  useEffect(() => {
    if (!mintLoading && !tokenDb && activeTeam) {
      router.replace("/token");
    }
  }, [mintLoading, tokenDb, activeTeam, router]);
  useEffect(() => {
    if (teamTokenBalance?.frozen) {
      setOptimisticBlocked((prev) => {
        if (!prev.has("freeze")) return prev;
        const next = new Set(prev);
        next.delete("freeze");
        return next;
      });
    } else {
      setOptimisticBlocked((prev) => {
        if (!prev.has("thaw")) return prev;
        const next = new Set(prev);
        next.delete("thaw");
        return next;
      });
    }
  }, [teamTokenBalance?.frozen]);

  const hasMintAuth = onChain?.mintAuthority === teamAddress;
  const hasFreezeAuth = onChain?.freezeAuthority === teamAddress;
  const canPropose = activeTeam?.isOwner || activeTeam?.isContributor;
  const decimals = onChain?.decimals ?? tokenDb?.decimals ?? 0;
  const short = (addr: string, chars = 4) => `${addr.slice(0, chars)}...${addr.slice(-chars)}`;

  const totalBalanceRaw = BigInt(teamTokenBalance?.raw || "0");
  const availableRaw = totalBalanceRaw > lockedAmount ? totalBalanceRaw - lockedAmount : BigInt(0);
  const hasLocked = lockedAmount > BigInt(0);

  const formatRaw = (raw: bigint | string): string => {
    const n = typeof raw === "string" ? BigInt(raw) : raw;
    if (decimals === 0) return n.toLocaleString();
    const divisor = BigInt(10 ** decimals);
    const whole = n / divisor;
    const frac = n % divisor;
    if (frac === BigInt(0)) return whole.toLocaleString();
    return `${whole.toLocaleString()}.${frac.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
  };

  if (!tokenDb && !mintLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <ImageIcon className="text-neutral-content/30 h-16 w-16" />
        <h2 className="text-xl font-semibold">{t("Token not found")}</h2>
        <p className="text-neutral-content text-sm">
          {t("This token is not managed by your team")}
        </p>
        <Button label="Back to tokens" variant="outline" onClick={() => router.push("/token")} />
      </div>
    );
  }

  const displayName = tokenDb?.name || mintAddress.slice(0, 8);
  const displaySymbol = tokenDb?.symbol || "???";
  const displayImage = tokenDb?.imageUrl;

  const actions: { id: ModalType; label: string; icon: any; desc: string; color: string }[] = [];

  if (canPropose) {
    if (hasMintAuth)
      actions.push({
        id: "mint",
        label: "Mint",
        icon: Coins,
        desc: "Mint new tokens",
        color: "text-success",
      });
    actions.push({
      id: "burn",
      label: "Burn",
      icon: Flame,
      desc: "Burn tokens from treasury",
      color: "text-error",
    });
    actions.push({
      id: "send",
      label: "Send",
      icon: Send,
      desc: "Transfer tokens to address",
      color: "text-info",
    });

    if (hasFreezeAuth) {
      const isFrozen = teamTokenBalance?.frozen ?? false;
      if (isFrozen) {
        actions.push({
          id: "thaw",
          label: "Thaw",
          icon: Unlock,
          desc: "Unfreeze team token account",
          color: "text-accent",
        });
      } else {
        actions.push({
          id: "freeze",
          label: "Freeze",
          icon: Snowflake,
          desc: "Freeze team token account",
          color: "text-warning",
        });
      }
    }

    if (hasMintAuth)
      actions.push({
        id: "transferMintAuth",
        label: "Transfer Mint Auth",
        icon: Key,
        desc: "Transfer or revoke",
        color: "text-warning",
      });
    if (hasFreezeAuth)
      actions.push({
        id: "transferFreezeAuth",
        label: "Transfer Freeze Auth",
        icon: Shield,
        desc: "Transfer or revoke",
        color: "text-warning",
      });
  }

  const handleAction = async () => {
    if (!publicKey || !activeTeam) return;
    if (!canPropose) {
      toast.error(t("Only owners and contributors can create proposals"));
      return;
    }
    const provider = tx.getProvider();
    if (!provider) return;

    const mint = new PublicKey(mintAddress);
    const teamPDA = new PublicKey(teamAddress);
    let action: ProposalAction;

    try {
      switch (activeModal) {
        case "mint": {
          const amountStr = formValue.trim();
          if (!amountStr) {
            toast.error(t("Amount is required"));
            return;
          }
          const [whole, fraction = ""] = amountStr.split(".");
          const paddedFrac = fraction.padEnd(decimals, "0").slice(0, decimals);
          const rawAmount =
            BigInt(whole || "0") * BigInt(10) ** BigInt(decimals) + BigInt(paddedFrac || "0");
          if (rawAmount <= BigInt(0)) {
            toast.error(t("Amount must be greater than 0"));
            return;
          }
          const recipient = formValue2.trim() ? new PublicKey(formValue2.trim()) : teamPDA;
          action = { tokenMint: { mint, amount: new anchor.BN(rawAmount.toString()), recipient } };
          break;
        }
        case "burn": {
          const rawAmount = BigInt(
            Math.floor(parseFloat(formValue || "0") * Math.pow(10, decimals))
          );
          if (rawAmount <= BigInt(0)) {
            toast.error(t("Amount must be greater than 0"));
            return;
          }
          if (rawAmount > availableRaw) {
            toast.error(
              t("exceedsBalance", {
                amount: formatRaw(availableRaw),
                symbol: displaySymbol,
              })
            );
            return;
          }
          action = { tokenBurn: { mint, amount: new anchor.BN(rawAmount.toString()) } };
          break;
        }
        case "send": {
          const rawAmount = BigInt(
            Math.floor(parseFloat(formValue || "0") * Math.pow(10, decimals))
          );
          if (rawAmount <= BigInt(0)) {
            toast.error(t("Amount must be greater than 0"));
            return;
          }
          if (rawAmount > availableRaw) {
            toast.error(
              t("exceedsBalance", {
                amount: formatRaw(availableRaw),
                symbol: displaySymbol,
              })
            );
            return;
          }
          if (!formValue2.trim()) {
            toast.error(t("Recipient address is required"));
            return;
          }
          const recipient = new PublicKey(formValue2.trim());
          action = {
            transferToken: { amount: new anchor.BN(rawAmount.toString()), recipient, mint },
          };
          break;
        }
        case "freeze": {
          const programId = onChain?.isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
          const teamAta = await getAssociatedTokenAddress(mint, teamPDA, true, programId);
          action = { tokenFreeze: { mint, account: teamAta } };
          break;
        }
        case "thaw": {
          const programId = onChain?.isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
          const teamAta = await getAssociatedTokenAddress(mint, teamPDA, true, programId);
          action = { tokenThaw: { mint, account: teamAta } };
          break;
        }
        case "transferMintAuth": {
          const newAuth = formValue.trim() ? new PublicKey(formValue.trim()) : null;
          action = { tokenSetMintAuthority: { mint, newAuthority: newAuth } };
          break;
        }
        case "transferFreezeAuth": {
          const newAuth = formValue.trim() ? new PublicKey(formValue.trim()) : null;
          action = { tokenSetFreezeAuthority: { mint, newAuthority: newAuth } };
          break;
        }
        default:
          return;
      }

      const { instructions } = await buildCreateProposalIx(provider, teamPDA, action);

      const singularActions: ModalType[] = [
        "freeze",
        "thaw",
        "transferMintAuth",
        "transferFreezeAuth",
      ];
      if (singularActions.includes(activeModal)) {
        setOptimisticBlocked((prev) => new Set([...prev, activeModal as ModalType]));
      }

      const result = await tx.execute(instructions, {
        accountKeys: [teamPDA],
        successMessage: "Proposal created!",
        onConfirmed: () => invalidateProposals(),
      });

      if (result?.success) {
        setActiveModal(null);
        setFormValue("");
        setFormValue2("");
        setFormValue3("");
        setActionStatus("");
        setAddressError("");
      } else {
        setOptimisticBlocked((prev) => {
          const next = new Set(prev);
          next.delete(activeModal as ModalType);
          return next;
        });
      }
    } catch (err: any) {
      setOptimisticBlocked((prev) => {
        const next = new Set(prev);
        next.delete(activeModal as ModalType);
        return next;
      });
      if (err?.message?.includes("User rejected")) return;
      toast.error(err.message || t("Failed to create proposal"));
      setActionStatus("");
    }
  };

  const availableDisplay = formatRaw(availableRaw);
  const getModalConfig = () => {
    switch (activeModal) {
      case "mint":
        return {
          title: "Mint Tokens",
          requiresInput: true,
          fields: [
            {
              label: "Amount",
              placeholder: `Amount (${displaySymbol})`,
              key: "1",
              type: "number" as const,
            },
            {
              label: "Recipient (optional)",
              placeholder: "Wallet address (empty = treasury)",
              key: "2",
            },
          ],
        };
      case "burn":
        return {
          title: "Burn Tokens",
          requiresInput: true,
          fields: [
            {
              label: "Amount",
              placeholder: `Amount to burn (${displaySymbol})`,
              key: "1",
              type: "number" as const,
            },
          ],
          info: `Available: ${availableDisplay} ${displaySymbol}`,
        };
      case "send":
        return {
          title: "Send Tokens",
          requiresInput: true,
          fields: [
            {
              label: "Amount",
              placeholder: `Amount (${displaySymbol})`,
              key: "1",
              type: "number" as const,
            },
            { label: "Recipient", placeholder: "Recipient wallet address", key: "2" },
          ],
          info: `Available: ${availableDisplay} ${displaySymbol}`,
        };
      case "freeze":
        return {
          title: "Freeze Token Account",
          requiresInput: false,
          fields: [] as any[],
          info: "This will freeze the team's token account, preventing any transfers until thawed.",
        };
      case "thaw":
        return {
          title: "Thaw Token Account",
          requiresInput: false,
          fields: [] as any[],
          info: "This will unfreeze the team's token account, allowing transfers again.",
        };
      case "transferMintAuth":
        return {
          title: "Transfer Mint Authority",
          requiresInput: false,
          fields: [
            { label: "New Authority", placeholder: "Address (empty = revoke forever)", key: "1" },
          ],
          warning: !formValue.trim()
            ? "Leaving this empty will permanently revoke mint authority."
            : undefined,
        };
      case "transferFreezeAuth":
        return {
          title: "Transfer Freeze Authority",
          requiresInput: false,
          fields: [
            { label: "New Authority", placeholder: "Address (empty = revoke forever)", key: "1" },
          ],
          warning: !formValue.trim()
            ? "Leaving this empty will permanently revoke freeze authority."
            : undefined,
        };
      default:
        return null;
    }
  };

  const modal = activeModal ? getModalConfig() : null;
  const statusMsg =
    actionStatus ||
    (tx.isBuilding
      ? "Building..."
      : tx.isSigning
        ? "Confirm in wallet..."
        : tx.isConfirming
          ? "Confirming..."
          : "");

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/token")}
        className="text-neutral-content hover:text-base-content flex items-center gap-2 text-sm transition-colors"
      >
        <ArrowLeft className="size-4.5" />
        {t("Back to tokens")}
      </button>

      <div className="glass-card rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-5">
          <div className="bg-base-200/80 border-base-300 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border">
            {displayImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayImage} alt={displaySymbol} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="text-neutral-content/30 h-10 w-10" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold">{displayName}</h2>
              <span className="badge badge-lg badge-outline font-mono">{displaySymbol}</span>
              {tokenDb?.tokenType === "nft" && (
                <span className="bg-accent/10 text-accent border-accent/20 rounded border px-1.5 py-0.5 text-xs font-bold">
                  {t("NFT")}
                </span>
              )}
              {tokenDb?.imported && (
                <span className="bg-info/10 text-info border-info/20 rounded border px-1.5 py-0.5 text-xs font-bold">
                  {t("Imported")}
                </span>
              )}
            </div>
            <p className="text-neutral-content mt-1 text-sm">
              {t("Managed by")} {activeTeam?.name || "team"}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="glass-card rounded-xl p-4">
            <p className="text-neutral-content mb-1">
              {hasLocked ? "Available Balance" : "Balance"}
            </p>
            <p className="text-xl font-bold">
              {teamTokenBalance ? formatRaw(availableRaw) : "..."}
            </p>
            {hasLocked && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-content">Total</span>
                  <span className="font-mono">{formatRaw(totalBalanceRaw)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-content flex items-center gap-1">
                    <Lock className="text-warning h-3 w-3" />
                    {t("In proposals")}
                  </span>
                  <span className="text-warning font-mono">-{formatRaw(lockedAmount)}</span>
                </div>
              </div>
            )}
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-neutral-content mb-1">{t("Total Supply")}</p>
            <p className="text-lg font-semibold">{onChain ? formatRaw(onChain.supply) : "..."}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-neutral-content mb-1">{t("Program")}</p>
            <p className="font-semibold">{onChain?.isToken2022 ? "Token-2022" : "SPL Token"}</p>
            {tokenDb?.tokenType !== "nft" && (
              <p className="text-neutral-content mt-1 text-xs">
                {t("Decimals")} {decimals}
              </p>
            )}
          </div>
        </div>

        <div className="glass-card mt-4 rounded-xl p-4">
          <p className="text-neutral-content mb-1">{t("Mint Address")}</p>
          <div className="flex min-w-0 items-center gap-1.5 max-sm:w-57.5">
            <span className="truncate font-mono text-sm">{mintAddress}</span>

            <Button
              label={<Copy size={12} />}
              variant="ghost"
              size="xs"
              className="btn-square"
              onClick={() => {
                navigator.clipboard.writeText(mintAddress);
                toast.success("Copied");
              }}
            />
            <a
              href={explorerAddressLink(mintAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-content hover:text-primary shrink-0"
            >
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="glass-card flex items-center justify-between rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Key
                className={`h-5 w-5 ${hasMintAuth ? "text-success" : onChain?.mintAuthority ? "text-warning" : "text-neutral-content/40"}`}
              />
              <div>
                <p className="text-sm font-medium">{t("Mint Authority")}</p>
                <p className="text-neutral-content font-mono text-xs">
                  {onChain?.mintAuthority
                    ? hasMintAuth
                      ? "Team Wallet"
                      : short(onChain.mintAuthority)
                    : "Revoked"}
                </p>
              </div>
            </div>
            <span
              className={`badge badge-sm ${hasMintAuth ? "badge-success" : onChain?.mintAuthority ? "badge-warning" : "badge-ghost"}`}
            >
              {hasMintAuth ? "Active" : onChain?.mintAuthority ? "External" : "Revoked"}
            </span>
          </div>
          <div className="glass-card flex items-center justify-between rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Shield
                className={`h-5 w-5 ${hasFreezeAuth ? "text-warning" : onChain?.freezeAuthority ? "text-warning" : "text-neutral-content/40"}`}
              />
              <div>
                <p className="text-sm font-medium">{t("Freeze Authority")}</p>
                <p className="text-neutral-content font-mono text-xs">
                  {onChain?.freezeAuthority
                    ? hasFreezeAuth
                      ? "Team Wallet"
                      : short(onChain.freezeAuthority)
                    : "None"}
                </p>
              </div>
            </div>
            <span
              className={`badge badge-sm ${hasFreezeAuth ? "badge-warning" : onChain?.freezeAuthority ? "badge-warning" : "badge-ghost"}`}
            >
              {hasFreezeAuth ? "Active" : onChain?.freezeAuthority ? "External" : "None"}
            </span>
          </div>
        </div>

        {tokenDb?.extensions &&
          (tokenDb.extensions.transferFee ||
            tokenDb.extensions.nonTransferable ||
            tokenDb.extensions.interestBearing) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tokenDb.extensions.transferFee && (
                <span className="bg-accent/10 text-accent border-accent/20 rounded-lg border px-2.5 py-1 text-xs font-medium">
                  {t("Transfer Fee")} {(tokenDb.extensions.transferFee.bps / 100).toFixed(2)}%
                </span>
              )}
              {tokenDb.extensions.nonTransferable && (
                <span className="bg-error/10 text-error border-error/20 rounded-lg border px-2.5 py-1 text-xs font-medium">
                  {tokenDb.tokenType === "nft" ? "Soulbound" : "Non-Transferable"}
                </span>
              )}
              {tokenDb.extensions.interestBearing && (
                <span className="bg-info/10 text-info border-info/20 rounded-lg border px-2.5 py-1 text-xs font-medium">
                  {t("Interest")} {tokenDb.extensions.interestBearing.rate}% APR
                </span>
              )}
            </div>
          )}
      </div>
      <div>
        <h3 className="mb-3 text-base font-semibold">{t("Token Actions")}</h3>
        <p className="text-neutral-content mb-4 text-sm">
          {canPropose
            ? "All actions create proposals requiring team approval."
            : "Only owners and contributors can create proposals."}
        </p>
        {actions.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {actions.map((a) => {
              const Icon = a.icon;
              const isFrozen = teamTokenBalance?.frozen ?? false;
              const frozenBlocked = isFrozen && a.id !== "thaw";
              const isBlocked =
                !frozenBlocked && SINGULAR_ACTIONS.has(a.id) && pendingActionTypes.has(a.id);
              const conflictLabel = !frozenBlocked && !isBlocked ? getConflict(a.id!) : null;
              const isNonTransferable = tokenDb?.extensions?.nonTransferable;
              const isDisabled =
                frozenBlocked ||
                isBlocked ||
                !!conflictLabel ||
                (a.id === "send" && isNonTransferable);
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    if (frozenBlocked) {
                      toast.error("Token account is frozen. Thaw it first.", {
                        toastId: "frozen-blocked",
                      });
                      return;
                    }
                    if (isBlocked) return;
                    if (conflictLabel) {
                      toast.error(
                        `A "${conflictLabel}" proposal is pending. Execute or cancel it first.`,
                        { toastId: "proposal-conflict" }
                      );
                      return;
                    }
                    setActiveModal(a.id);
                    tx.reset();
                    setFormValue("");
                    setFormValue2("");
                    setFormValue3("");
                    setActionStatus("");
                    setAddressError("");
                  }}
                  disabled={isDisabled}
                  title={
                    frozenBlocked
                      ? "Token account is frozen. Thaw it first."
                      : isBlocked
                        ? "A proposal for this action is already pending. It will unlock once members approve, reject, or it expires."
                        : conflictLabel
                          ? `A "${conflictLabel}" proposal is pending. Execute or cancel it first.`
                          : undefined
                  }
                  className={`glass-card group rounded-xl border p-4 text-left transition-all ${
                    isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Icon
                      className={`h-6 w-6 ${isDisabled ? "text-neutral-content/40" : a.color} ${
                        !isDisabled ? "transition-transform group-hover:scale-110" : ""
                      }`}
                    />
                    {isBlocked && <span className="badge badge-xs badge-warning">Pending</span>}
                    {conflictLabel && <span className="badge badge-xs badge-error">Blocked</span>}
                    {frozenBlocked && <span className="badge badge-xs badge-info">Frozen</span>}
                  </div>
                  <h6 className="font-semibold">{a.label}</h6>
                  <p className="text-neutral-content mt-0.5">
                    {frozenBlocked
                      ? "Account is frozen"
                      : isBlocked
                        ? "Proposal pending approval"
                        : conflictLabel
                          ? `Blocked by ${conflictLabel}`
                          : a.desc}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="border-base-200 bg-base-200/20 rounded-xl border p-6 text-center">
            <p className="text-neutral-content text-sm">
              {!canPropose
                ? "You need owner or contributor access to perform token actions."
                : "No actions available — authorities may have been revoked or transferred."}
            </p>
          </div>
        )}
      </div>
      {activeModal && modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="token-action-title"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setActiveModal(null)}
          />
          <div className="bg-base-100 border-base-200 relative w-full max-w-md space-y-4 rounded-2xl border p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 id="token-action-title" className="text-lg font-bold">
                {modal.title}
              </h3>

              <Button
                label={<X className="size-4" />}
                size="xs"
                aria-label="Close modal"
                onClick={() => setActiveModal(null)}
                className="btn-square"
              />
            </div>
            <div className="bg-base-200/40 border-base-300 flex items-center gap-3 rounded-xl border p-3">
              {displayImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayImage} alt={displaySymbol} className="h-8 w-8 rounded-full" />
              ) : (
                <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                  {displaySymbol[0]}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold">{displaySymbol}</p>
                <p className="text-neutral-content text-xs">{displayName}</p>
              </div>
            </div>

            {modal.fields.map((field, i) => (
              <div key={field.key}>
                <Input
                  label={field.label}
                  placeholder={field.placeholder}
                  type={(field as any).type || "text"}
                  value={i === 0 ? formValue : i === 1 ? formValue2 : formValue3}
                  onChange={(e) => {
                    let value = e.target.value;

                    if (activeModal === "mint" && i === 0) {
                      value = value.replace(/[^\d.]/g, "");
                      const decimalCount = (value.match(/\./g) || []).length;
                      if (decimalCount > 1) return;
                      const [whole, fraction = ""] = value.split(".");
                      if (fraction.length > decimals) return;
                      if (whole.length > 9) return;
                    }

                    if (i === 0) {
                      setFormValue(value);
                    } else if (i === 1) {
                      setFormValue2(value);
                      if (value.trim() === "") {
                        setAddressError("");
                      } else {
                        try {
                          new PublicKey(value.trim());
                          setAddressError("");
                        } catch {
                          setAddressError(t("Invalid Solana address"));
                        }
                      }
                    } else {
                      setFormValue3(value);
                    }
                  }}
                  required
                />
                {i === 1 && addressError && (
                  <p className="text-error mt-1 text-xs">{addressError}</p>
                )}
              </div>
            ))}

            {(modal as any).info && (
              <div className="bg-base-200/40 border-base-300 flex items-center gap-2 rounded-xl border p-2.5">
                <Coins className="text-neutral-content h-3.5 w-3.5 shrink-0" />
                <p className="text-neutral-content font-mono text-xs">{(modal as any).info}</p>
              </div>
            )}

            {(modal as any).warning && (
              <div className="bg-error/5 border-error/20 flex items-start gap-2 rounded-xl border p-3">
                <Lock className="text-error mt-0.5 size-4.5 shrink-0" />
                <p className="text-error text-xs">{(modal as any).warning}</p>
              </div>
            )}

            <p className="text-neutral-content text-xs">
              {t("This creates a proposal requiring team approval before execution")}
            </p>

            {statusMsg && (
              <div className="bg-primary/5 border-primary/20 flex items-center gap-2 rounded-xl border p-3">
                <Loader2 className="text-primary size-4.5 animate-spin" />
                <p className="text-sm">{statusMsg}</p>
              </div>
            )}
            {tx.isError && tx.error && (
              <div className="bg-error/5 border-error/20 flex items-start gap-2 rounded-xl border p-3">
                <p className="text-error flex-1 text-sm">{tx.error}</p>
                <button
                  onClick={() => tx.reset()}
                  className="text-error/50 hover:text-error shrink-0"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                label="Cancel"
                variant="outline"
                fullWidth
                onClick={() => setActiveModal(null)}
                disabled={tx.isProcessing || !!actionStatus}
                className="flex-1"
              />
              <Button
                label="Create Proposal"
                variant="primary"
                fullWidth
                onClick={handleAction}
                disabled={(modal.requiresInput && !formValue) || tx.isProcessing || !!actionStatus}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
