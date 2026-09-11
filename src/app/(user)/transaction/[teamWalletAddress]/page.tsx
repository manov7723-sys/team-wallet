"use client";
/**
 * TransactionPage module - Displays and manages team wallet proposals.
 *
 * Provides a full proposal lifecycle interface including:
 * - Viewing all proposals (grouped by date)
 * - Filtering by status (pending, approved, executed, etc.)
 * - Searching proposals by action or proposer
 * - Voting (confirm/reject), executing, and cancelling proposals
 *
 * Integrates on-chain and API data for:
 * - Proposal details and status
 * - Token metadata and balances
 * - Proposal logs and transaction signatures
 *
 * Handles complex actions such as Jupiter swaps with pre-instructions,
 * associated token account creation, and address lookup tables.
 *
 * Utility functions:
 * - getTypeLabel(action: any): string
 * - getActionDetail(action: any, tokenMap?: Map<string, TokenInfo>): {label, value, address?}[]
 * - groupByDate(proposals: FullProposal[]): {date: string, items: FullProposal[]}[]
 *
 * Core handlers:
 * - handleVote(proposal: FullProposal, voteFor: boolean): Promise<void>
 * - handleExecute(proposal: FullProposal): Promise<void>
 * - handleCancel(proposal: FullProposal): Promise<void>
 *
 * @param {Object} params - Route params from Next.js
 * @param {string} params.teamWalletAddress - Team wallet public key
 *
 * @returns {JSX.Element} Transaction page UI with proposals list and actions
 */
import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  useAllProposals,
  useInvalidateAllProposals,
  type FullProposal,
} from "@/src/hooks/useAllProposals";
import { useTeamOnChain } from "@/src/hooks/useTeamOnChain";
import { useTransaction } from "@/src/hooks/useTransaction";
import {
  useProposalLogs,
  useSaveProposalLog,
  useTokens,
  useTeamTokenBalances,
  useProposalMintInfos,
} from "@/src/hooks/useApi";
import { useSyncMemberRole } from "@/src/hooks/useTeamHooks";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/src/providers/AuthProvider";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/src/hooks/useApiCore";
import type { TeamAccessData } from "@/src/lib/api";
import {
  buildVoteProposalIx,
  buildExecuteProposalIx,
  buildCancelProposalIx,
  prepareJupiterSwap,
} from "@/src/lib/web3";
import {
  getActionLabel,
  getActionType,
  timeAgo,
  timeLeft,
  formatDate,
} from "@/src/lib/proposalHelpers";
import { explorerAddressLink, explorerTxLink } from "@/src/lib/explorer";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Coins,
  Copy,
  ExternalLink,
  Loader2,
  Search,
  Shield,
  ShieldCheck,
  Timer,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/src/components/Button/ButtonVW";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Active", cls: "bg-info/20 text-info border-info/40" },
  approved: { label: "Ready", cls: "bg-success/20 text-success border-success/40" },
  executed: { label: "Executed", cls: "bg-success/20 text-success border-success/40" },
  rejected: { label: "Cancelled", cls: "bg-error/20 text-error border-error/40" },
  expired: { label: "Expired", cls: "bg-warning/20 text-warning border-warning/40" },
};

const TYPE_ICON: Record<string, any> = {
  transferSol: Coins,
  transferToken: Coins,
  swap: ArrowLeftRight,
  changeThreshold: Shield,
  addVoter: Users,
  removeVoter: Trash2,
  addContributor: ShieldCheck,
  removeContributor: Trash2,
  upgradeProgram: Code2,
  deleteProgram: Trash2,
  tokenMint: Zap,
  tokenBurn: Zap,
  tokenFreeze: ShieldCheck,
  tokenThaw: ShieldCheck,
  tokenSetMintAuthority: Shield,
  tokenSetFreezeAuthority: Shield,
  tokenUpdateMetadata: Code2,
};

function getTypeLabel(action: any): string {
  const t = Object.keys(action)[0] || "unknown";
  const map: Record<string, string> = {
    transferSol: "Send",
    transferToken: "Send",
    swap: "Swap",
    changeThreshold: "Config",
    addVoter: "Add Voter",
    removeVoter: "Remove Voter",
    addContributor: "Add Contributor",
    removeContributor: "Remove Contributor",
    upgradeProgram: "Upgrade",
    deleteProgram: "Close",
    tokenMint: "Mint",
    tokenBurn: "Burn",
    tokenFreeze: "Freeze",
    tokenThaw: "Thaw",
    tokenSetMintAuthority: "Authority",
    tokenSetFreezeAuthority: "Authority",
    tokenUpdateMetadata: "Metadata",
  };
  return map[t] || "Action";
}

interface TokenInfo {
  decimals: number;
  symbol: string;
}

function getActionDetail(
  action: any,
  tokenMap?: Map<string, TokenInfo>
): { label: string; value: string; address?: string }[] {
  const a = action as any;
  const short = (addr: string) => (addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : "—");

  const fmtToken = (mintAddr: string, rawAmount: number | string) => {
    const info = tokenMap?.get(mintAddr);
    const dec = info?.decimals ?? 0;
    const sym = info?.symbol || "";
    const raw = typeof rawAmount === "string" ? Number(rawAmount) : rawAmount;
    if (dec === 0) return sym ? `${raw.toLocaleString()} ${sym}` : raw.toLocaleString();
    const human = raw / Math.pow(10, dec);
    const formatted =
      human % 1 === 0
        ? human.toLocaleString()
        : human.toLocaleString(undefined, { maximumFractionDigits: dec });
    return sym ? `${formatted} ${sym}` : formatted;
  };

  if (a.transferSol)
    return [
      { label: "Amount", value: `${(a.transferSol.amount / 1e9).toFixed(4)} SOL` },
      {
        label: "Recipient",
        value: short(a.transferSol.recipient),
        address: a.transferSol.recipient,
      },
    ];
  if (a.transferToken)
    return [
      { label: "Amount", value: fmtToken(a.transferToken.mint, a.transferToken.amount) },
      {
        label: "Recipient",
        value: short(a.transferToken.recipient),
        address: a.transferToken.recipient,
      },
      { label: "Mint", value: short(a.transferToken.mint), address: a.transferToken.mint },
    ];
  if (a.swap)
    return [
      { label: "From", value: short(a.swap.inputMint) },
      { label: "To", value: short(a.swap.outputMint) },
    ];
  if (a.changeThreshold)
    return [{ label: "Threshold", value: `${a.changeThreshold.newThreshold}` }];
  if (a.addVoter)
    return [{ label: "Voter", value: short(a.addVoter.voter), address: a.addVoter.voter }];
  if (a.removeVoter)
    return [{ label: "Voter", value: short(a.removeVoter.voter), address: a.removeVoter.voter }];
  if (a.addContributor)
    return [
      {
        label: "Contributor",
        value: short(a.addContributor.contributor),
        address: a.addContributor.contributor,
      },
    ];
  if (a.removeContributor)
    return [
      {
        label: "Contributor",
        value: short(a.removeContributor.contributor),
        address: a.removeContributor.contributor,
      },
    ];
  if (a.upgradeProgram)
    return [
      {
        label: "Program",
        value: short(a.upgradeProgram.programId),
        address: a.upgradeProgram.programId,
      },
    ];
  if (a.deleteProgram)
    return [
      {
        label: "Program",
        value: short(a.deleteProgram.programId),
        address: a.deleteProgram.programId,
      },
    ];
  if (a.tokenMint)
    return [
      { label: "Amount", value: fmtToken(a.tokenMint.mint, a.tokenMint.amount) },
      { label: "Mint", value: short(a.tokenMint.mint), address: a.tokenMint.mint },
      { label: "Recipient", value: short(a.tokenMint.recipient), address: a.tokenMint.recipient },
    ];
  if (a.tokenBurn)
    return [
      { label: "Amount", value: fmtToken(a.tokenBurn.mint, a.tokenBurn.amount) },
      { label: "Mint", value: short(a.tokenBurn.mint), address: a.tokenBurn.mint },
    ];
  if (a.tokenFreeze)
    return [
      { label: "Account", value: short(a.tokenFreeze.account), address: a.tokenFreeze.account },
      { label: "Mint", value: short(a.tokenFreeze.mint), address: a.tokenFreeze.mint },
    ];
  if (a.tokenThaw)
    return [
      { label: "Account", value: short(a.tokenThaw.account), address: a.tokenThaw.account },
      { label: "Mint", value: short(a.tokenThaw.mint), address: a.tokenThaw.mint },
    ];
  if (a.tokenSetMintAuthority)
    return [
      {
        label: "Mint",
        value: short(a.tokenSetMintAuthority.mint),
        address: a.tokenSetMintAuthority.mint,
      },
      {
        label: "New Auth",
        value: a.tokenSetMintAuthority.newAuthority
          ? short(a.tokenSetMintAuthority.newAuthority)
          : "Revoke",
      },
    ];
  if (a.tokenSetFreezeAuthority)
    return [
      {
        label: "Mint",
        value: short(a.tokenSetFreezeAuthority.mint),
        address: a.tokenSetFreezeAuthority.mint,
      },
      {
        label: "New Auth",
        value: a.tokenSetFreezeAuthority.newAuthority
          ? short(a.tokenSetFreezeAuthority.newAuthority)
          : "Revoke",
      },
    ];
  if (a.tokenUpdateMetadata)
    return [
      {
        label: "Mint",
        value: short(a.tokenUpdateMetadata.mint),
        address: a.tokenUpdateMetadata.mint,
      },
      { label: "Name", value: a.tokenUpdateMetadata.name },
      { label: "Symbol", value: a.tokenUpdateMetadata.symbol },
    ];
  return [];
}

function groupByDate(proposals: FullProposal[]): { date: string; items: FullProposal[] }[] {
  const groups = new Map<string, FullProposal[]>();
  for (const p of proposals) {
    const label = (() => {
      const now = new Date();
      const created = new Date(p.createdAt * 1000);
      if (now.toDateString() === created.toDateString()) return "Today";
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (yesterday.toDateString() === created.toDateString()) return "Yesterday";
      return created.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    })();
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(p);
  }
  return Array.from(groups.entries()).map(([date, items]) => ({ date, items }));
}

const TABS = ["all", "pending", "approved", "executed", "rejected", "expired"] as const;
type Tab = (typeof TABS)[number];

export default function TransactionPage() {
  const params = useParams();
  const teamWalletAddress = params.teamWalletAddress as string;
  const { publicKey } = useWallet();
  const t = useTranslations("transaction");
  const { isAuthenticated } = useAuth();
  const { data: proposals, isLoading } = useAllProposals(teamWalletAddress);
  const { data: onChain } = useTeamOnChain(teamWalletAddress);
  const tx = useTransaction();
  const invalidate = useInvalidateAllProposals();
  const { data: proposalLogs } = useProposalLogs(teamWalletAddress);
  const saveProposalLog = useSaveProposalLog();
  const syncMemberRole = useSyncMemberRole();
  const { data: tokens } = useTokens(teamWalletAddress);

  const { data: tokenBalances } = useTeamTokenBalances(teamWalletAddress);

  const proposalMints = useMemo(() => {
    if (!proposals) return [];
    const mints = new Set<string>();
    for (const p of proposals) {
      const a = p.action as any;
      if (a?.transferToken?.mint) mints.add(a.transferToken.mint);
      if (a?.tokenMint?.mint) mints.add(a.tokenMint.mint);
      if (a?.tokenBurn?.mint) mints.add(a.tokenBurn.mint);
    }
    return [...mints];
  }, [proposals]);

  const { data: proposalMintInfos } = useProposalMintInfos(proposalMints);

  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notifDismissed, setNotifDismissed] = useState(false);

  const tokenMap = useMemo(() => {
    const map = new Map<string, TokenInfo>();
    if (tokenBalances) {
      for (const [mint, balance] of Object.entries(tokenBalances)) {
        map.set(mint, { decimals: balance.decimals, symbol: "" });
      }
    }
    if (proposalMintInfos) {
      for (const [mint, info] of proposalMintInfos.entries()) {
        if (!map.has(mint)) {
          map.set(mint, { decimals: info.decimals, symbol: "" });
        }
      }
    }
    if (tokens) {
      for (const t of tokens) {
        map.set(t.mintAddress, { decimals: t.decimals, symbol: t.symbol });
      }
    }
    return map;
  }, [tokens, tokenBalances, proposalMintInfos]);

  const sigMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (proposalLogs) {
      for (const log of proposalLogs) map[log.proposalKey] = log.signature;
    }
    return map;
  }, [proposalLogs]);

  const walletAddress = publicKey?.toBase58() || "";
  const isOwner = onChain?.owner === walletAddress;
  const isVoter = onChain?.voters.includes(walletAddress) || false;
  const threshold = onChain?.voteThreshold || 2;
  const short = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  const actionableCount = useMemo(() => {
    if (!proposals || !walletAddress) return 0;
    return proposals.filter((p) => {
      if (p.status !== "pending") return false;
      const myIdx = p.snapshotVoters.indexOf(walletAddress);
      return myIdx !== -1 && !p.votersVoted.includes(myIdx);
    }).length;
  }, [proposals, walletAddress]);

  const filtered = useMemo(() => {
    if (!proposals) return [];
    return proposals.filter((p) => {
      if (activeTab !== "all" && p.status !== activeTab) return false;
      if (search) {
        const q = search.toLowerCase();
        const actionLabel = getActionLabel(p.action).toLowerCase();
        const actionType = getActionType(p.action).toLowerCase();

        if (
          !actionLabel.includes(q) &&
          !actionType.includes(q) &&
          !p.proposer.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [proposals, activeTab, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const tabCounts = useMemo(() => {
    if (!proposals) return {} as Record<Tab, number>;
    const c: Record<string, number> = { all: proposals.length };
    for (const t of TABS) if (t !== "all") c[t] = 0;
    for (const p of proposals) c[p.status] = (c[p.status] || 0) + 1;
    return c as Record<Tab, number>;
  }, [proposals]);

  const handleVote = async (proposal: FullProposal, voteFor: boolean) => {
    const provider = tx.getProvider();
    if (!provider) return;
    const { instructions } = await buildVoteProposalIx(
      provider,
      new PublicKey(proposal.publicKey),
      new PublicKey(teamWalletAddress),
      voteFor
    );
    await tx.execute(instructions, {
      accountKeys: [new PublicKey(teamWalletAddress)],
      successMessage: voteFor ? "Confirmed!" : "Rejected!",
      onConfirmed: async () => {
        await invalidate();
      },
    });
  };

  const handleExecute = async (proposal: FullProposal) => {
    const provider = tx.getProvider();
    if (!provider) return;

    let swapData: Buffer | null = null;
    let jupiterAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];
    let swapALTs: any[] = [];
    const preIxs: TransactionInstruction[] = [];

    const action = proposal.action as any;
    if (action.swap) {
      try {
        toast.info(t("Fetching Jupiter swap route"));
        const teamPDA = new PublicKey(teamWalletAddress);
        const jupResult = await prepareJupiterSwap(provider.connection, teamPDA, action.swap);

        if (!jupResult.swapData || jupResult.swapData.length === 0) {
          toast.error(t("Jupiter returned empty swap data No route available"));
          return;
        }

        swapData = jupResult.swapData;
        jupiterAccounts = jupResult.jupiterAccounts;
        swapALTs = jupResult.addressLookupTableAccounts;

        const outputMint = new PublicKey(action.swap.outputMint);
        const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } =
          await import("@solana/spl-token");
        const outputAta = await getAssociatedTokenAddress(outputMint, teamPDA, true);
        try {
          await provider.connection.getTokenAccountBalance(outputAta);
        } catch {
          preIxs.push(
            createAssociatedTokenAccountInstruction(
              provider.wallet.publicKey,
              outputAta,
              teamPDA,
              outputMint
            )
          );
        }

        const inputMint = new PublicKey(action.swap.inputMint);
        const SOL = "So11111111111111111111111111111111111111112";
        if (inputMint.toBase58() !== SOL) {
          const inputAta = await getAssociatedTokenAddress(inputMint, teamPDA, true);
          try {
            await provider.connection.getTokenAccountBalance(inputAta);
          } catch {
            preIxs.push(
              createAssociatedTokenAccountInstruction(
                provider.wallet.publicKey,
                inputAta,
                teamPDA,
                inputMint
              )
            );
          }
        }
      } catch (err: any) {
        toast.error(
          t("jupiterSwapFailed", {
            message: err.message,
          })
        );
        return;
      }
    }

    const { instructions: executeIxs } = await buildExecuteProposalIx(
      provider,
      new PublicKey(proposal.publicKey),
      new PublicKey(teamWalletAddress),
      proposal.action,
      swapData,
      jupiterAccounts
    );

    const allInstructions = [...preIxs, ...executeIxs];

    await tx.execute(allInstructions, {
      accountKeys: [new PublicKey(teamWalletAddress)],
      computeUnits: action.swap ? 400_000 : undefined,
      addressLookupTableAccounts: swapALTs.length > 0 ? swapALTs : undefined,
      successMessage: "Executed!",
      onConfirmed: async (sig) => {
        await saveProposalLog
          .mutateAsync({
            teamWalletAddress,
            proposalKey: proposal.publicKey,
            signature: sig,
          })
          .catch(() => {});

        if (proposal.action && "changeThreshold" in proposal.action) {
          const newThreshold = (proposal.action as any).changeThreshold.newThreshold as number;

          qc.setQueryData<TeamAccessData>(queryKeys.teamAccess, (old) => {
            if (!old) return old;
            return {
              ...old,
              teams: old.teams.map((t) =>
                t.teamWalletAddress === teamWalletAddress ? { ...t, threshold: newThreshold } : t
              ),
            };
          });

          qc.invalidateQueries({ queryKey: ["teamOnChain", teamWalletAddress] });
        }

        const isMemberAction =
          proposal.action &&
          ("addVoter" in proposal.action ||
            "removeVoter" in proposal.action ||
            "addContributor" in proposal.action ||
            "removeContributor" in proposal.action);

        if (isMemberAction) {
          const a = proposal.action as any;
          const memberAction = a.addVoter
            ? "addVoter"
            : a.removeVoter
              ? "removeVoter"
              : a.addContributor
                ? "addContributor"
                : "removeContributor";
          const memberKey =
            a.addVoter?.voter ||
            a.removeVoter?.voter ||
            a.addContributor?.contributor ||
            a.removeContributor?.contributor;

          if (memberKey) {
            await syncMemberRole
              .mutateAsync({
                address: teamWalletAddress,
                input: { key: memberKey, action: memberAction },
              })
              .catch(() => {});
          }

          await new Promise((r) => setTimeout(r, 2000));
          await qc.invalidateQueries({ queryKey: ["teamOnChain", teamWalletAddress] });
          await qc.refetchQueries({ queryKey: ["teamOnChain", teamWalletAddress] });
        }

        await invalidate();
      },
    });
  };

  const handleCancel = async (proposal: FullProposal) => {
    const provider = tx.getProvider();
    if (!provider) return;
    const { instructions } = await buildCancelProposalIx(
      provider,
      new PublicKey(proposal.publicKey),
      new PublicKey(teamWalletAddress)
    );
    await tx.execute(instructions, {
      accountKeys: [new PublicKey(teamWalletAddress)],
      successMessage: "Cancelled!",
      onConfirmed: async () => {
        await invalidate();
      },
    });
  };

  const canAct = (p: FullProposal) => p.proposer === walletAddress || isOwner;

  const renderRow = (p: FullProposal) => {
    const actionType = getActionType(p.action);
    const Icon = TYPE_ICON[actionType] || Zap;
    const badge = STATUS_BADGE[p.status] || STATUS_BADGE.pending;
    const details = getActionDetail(p.action, tokenMap);
    const isExpanded = expandedId === p.publicKey;
    const myIdx = p.snapshotVoters.indexOf(walletAddress);
    const hasVoted = myIdx !== -1 && p.votersVoted.includes(myIdx);
    const canVote =
      isAuthenticated && p.status === "pending" && isVoter && myIdx !== -1 && !hasVoted;
    const canExec = isAuthenticated && p.status === "approved" && p.proposer === walletAddress;
    const canCancel =
      isAuthenticated &&
      canAct(p) &&
      ((p.status === "pending" && !hasVoted) || p.status === "approved");
    const isPending = p.status === "pending" || p.status === "approved";
    const progressPct = Math.min(Math.round((p.votesFor / threshold) * 100), 100);

    return (
      <div key={p.publicKey}>
        <div
          onClick={() => setExpandedId(isExpanded ? null : p.publicKey)}
          className={`hover:bg-base-200/60 flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-all ${isExpanded ? "bg-base-200/40" : ""}`}
        >
          <div className="flex items-center gap-3 max-sm:gap-0">
            <div className="bg-base-200 border-base-300 flex h-9 w-9 items-center justify-center rounded-xl border">
              <Icon className="text-neutral-content size-4.5" />
            </div>
            <div className="min-w-0 max-sm:w-13.75">
              <p className="truncate text-sm font-semibold">{getTypeLabel(p.action)}</p>
              <p className="text-neutral-content text-xs">{t("Type")}</p>
            </div>
          </div>

          {details.slice(0, 2).map((d, i) => (
            <div key={i} className="min-w-0 flex-1">
              {d.address ? (
                <a
                  href={explorerAddressLink(d.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary inline-flex items-center gap-2 text-sm font-medium hover:underline"
                >
                  <div className="truncate max-sm:max-w-15">{d.value}</div>
                  <ExternalLink className="size-4 opacity-60" />
                </a>
              ) : (
                <p className="truncate text-sm font-medium">{d.value}</p>
              )}
              <p className="text-neutral-content text-xs">{d.label}</p>
            </div>
          ))}
          {details.length < 2 && <div className="flex-1" />}
          {details.length < 1 && <div className="flex-1" />}

          <div className="min-w-0 shrink-0 text-right max-sm:w-10">
            <p className="truncate text-sm">{timeAgo(p.createdAt)}</p>
            <p className="text-neutral-content text-xs">{t("Time")}</p>
          </div>

          <div className="text-right">
            <span
              className={`inline-block rounded-lg border px-2.5 py-1 text-xs font-bold ${badge.cls} truncate max-sm:max-w-12.5`}
            >
              {badge.label}
            </span>
          </div>

          <div className="flex justify-center">
            {isExpanded ? (
              <ChevronUp className="text-neutral-content/40 size-4.5" />
            ) : (
              <ChevronDown className="text-neutral-content/40 size-4.5" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 py-4 max-sm:p-2.5">
            <div className="border-base-300 bg-base-200/30 overflow-hidden rounded-xl border">
              <div className="px-4 pt-4 pb-3">
                <p className="text-primary mb-3 text-xs font-bold tracking-widest uppercase">
                  {t("Info")}
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1 max-sm:gap-3">
                  <div className="flex items-center gap-6 max-sm:justify-between">
                    <span className="text-neutral-content flex w-20 shrink-0 items-center gap-1.5 text-sm">
                      <User className="size-5" />
                      {t("Author")}
                    </span>
                    <a
                      href={explorerAddressLink(p.proposer)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-1 font-mono text-sm hover:underline"
                    >
                      {short(p.proposer)}
                      <ExternalLink className="size-4 opacity-60" />
                    </a>
                  </div>
                  <div className="flex items-center gap-6 max-sm:justify-between">
                    <span className="text-neutral-content flex w-24 shrink-0 items-center gap-1.5 text-sm">
                      <CalendarClock className="size-5" />
                      {t("Created on")}
                    </span>
                    <span className="text-sm">{formatDate(p.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-6 max-sm:justify-between">
                    <span className="text-neutral-content flex w-20 shrink-0 items-center gap-1.5 text-sm">
                      <Timer className="size-5" />
                      {p.status === "executed"
                        ? "Executed"
                        : p.status === "rejected"
                          ? p.cancelled
                            ? "Cancelled"
                            : "Rejected"
                          : "Expires"}
                    </span>
                    <span className="text-sm">
                      {p.status === "executed" && p.approvedAt > 0
                        ? formatDate(p.approvedAt)
                        : p.status === "rejected"
                          ? p.cancelled
                            ? "Cancelled by proposer/owner"
                            : "Rejected — insufficient votes to pass"
                          : p.status === "expired"
                            ? `Expired · ${formatDate(p.expiresAt)}`
                            : `${timeLeft(p.expiresAt)} · ${formatDate(p.expiresAt)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 max-sm:justify-between">
                    <span className="text-neutral-content flex w-24 shrink-0 items-center gap-1.5 text-sm">
                      <Zap className="size-5" />
                      {t("Action")}
                    </span>
                    <span className="truncate text-xs">{getActionLabel(p.action)}</span>
                  </div>
                </div>
              </div>

              <div className="border-base-300 border-t px-4 pt-4 pb-3">
                <p className="text-primary mb-3 text-xs font-bold tracking-widest uppercase">
                  {t("Results")}
                </p>
                <div className="mb-3 flex items-end gap-6 max-sm:justify-between">
                  <div className="text-center">
                    <p
                      className={`text-2xl leading-none font-black ${p.votesFor > 0 ? "text-success" : "text-base-content/15"}`}
                    >
                      {p.votesFor}
                    </p>
                    <p className="text-neutral-content mt-1 text-xs">{t("Confirmed")}</p>
                  </div>
                  <div className="text-center">
                    <p
                      className={`text-2xl leading-none font-black ${p.votesAgainst > 0 ? "text-error" : "text-base-content/15"}`}
                    >
                      {p.votesAgainst}
                    </p>
                    <p className="text-neutral-content mt-1 text-xs">{t("Rejected")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-info text-2xl leading-none font-black">
                      {p.votesFor}/{threshold}
                    </p>
                    <p className="text-neutral-content mt-1 text-xs">{t("Threshold")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-content w-16 shrink-0 text-xs">
                    {t("Progress")}
                  </span>
                  <div className="bg-base-300 h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        p.status === "executed"
                          ? "bg-success"
                          : p.status === "rejected"
                            ? "bg-error"
                            : p.votesFor >= threshold
                              ? "bg-success"
                              : "bg-info"
                      }`}
                      style={{ width: `${p.status === "executed" ? 100 : progressPct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs font-semibold">
                    {p.status === "executed" ? "100" : progressPct}%
                  </span>
                </div>

                {p.status === "executed" && (
                  <div className="bg-success/10 border-success/20 mt-3 flex items-center justify-between gap-3 rounded-lg border p-2.5">
                    <div className="flex items-center gap-2">
                      <Check className="text-success size-4.5 shrink-0" />
                      <p className="text-success text-xs font-medium">
                        {t("Proposal executed successfully")}
                        {p.approvedAt > 0 ? ` on ${formatDate(p.approvedAt)}` : ""}
                      </p>
                    </div>
                    {sigMap[p.publicKey] && (
                      <a
                        href={explorerTxLink(sigMap[p.publicKey])}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="bg-success/20 text-success hover:bg-success/30 border-success/30 inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all"
                      >
                        {t("View on Explorer")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
                {p.status === "rejected" && (
                  <div className="bg-error/10 border-error/20 mt-3 flex items-center gap-2 rounded-lg border p-2.5">
                    <X className="text-error size-4.5 shrink-0" />
                    <p className="text-error text-xs font-medium">
                      {p.cancelled
                        ? t("Proposal was cancelled")
                        : `${t("Proposal rejected")} — ${p.votesAgainst} ${t("votes against")} (${p.votesFor}/${threshold} ${t("approvals")})`}
                    </p>
                  </div>
                )}
                {p.status === "expired" && (
                  <div className="bg-warning/10 border-warning/20 mt-3 flex items-center gap-2 rounded-lg border p-2.5">
                    <Timer className="text-warning size-4.5 shrink-0" />
                    <p className="text-warning text-xs font-medium">
                      {t("Proposal expired without reaching threshold")} ({p.votesFor}/{threshold}{" "}
                      {t("votes")})
                    </p>
                  </div>
                )}
              </div>

              {isPending && (
                <div className="border-base-300 space-y-3 border-t px-4 py-3">
                  {tx.isError && tx.error && (
                    <div className="bg-error/10 border-error/20 flex items-start gap-2.5 rounded-xl border p-3">
                      <AlertTriangle className="text-error mt-0.5 size-4.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-error text-xs font-semibold">
                          {t("Transaction Failed")}
                        </p>
                        <p className="text-error/70 mt-0.5 text-xs">{tx.error}</p>
                      </div>

                      <Button
                        label={<X className="size-4" />}
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          tx.reset();
                        }}
                        className="btn-square"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3">
                    {tx.isProcessing && (
                      <div className="text-primary mr-auto flex items-center gap-2 text-xs">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {tx.isSigning
                          ? "Confirm in wallet..."
                          : tx.isConfirming
                            ? "Confirming..."
                            : "Building..."}
                      </div>
                    )}

                    {canCancel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(p);
                        }}
                        className="border-base-300 hover:bg-error/10 hover:border-error/30 hover:text-error rounded-xl border px-5 py-2 text-xs font-semibold transition-all"
                        disabled={tx.isProcessing}
                      >
                        {t("Cancel")}
                      </button>
                    )}

                    {canVote && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(p, false);
                          }}
                          className="border-base-300 hover:bg-error/10 hover:border-error/30 hover:text-error rounded-xl border px-5 py-2 text-xs font-semibold transition-all"
                          disabled={tx.isProcessing}
                        >
                          {t("Reject")}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(p, true);
                          }}
                          className="bg-primary text-primary-content rounded-xl px-5 py-2 text-xs font-semibold transition-all hover:brightness-110"
                          disabled={tx.isProcessing}
                        >
                          {t("Confirm")}
                        </button>
                      </>
                    )}

                    {canExec && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExecute(p);
                        }}
                        className="bg-success text-success-content rounded-xl px-5 py-2 text-xs font-semibold transition-all hover:brightness-110"
                        disabled={tx.isProcessing}
                      >
                        {t("Execute")}
                      </button>
                    )}

                    {hasVoted && !canExec && (
                      <span className="text-success flex items-center gap-1.5 text-xs font-semibold">
                        <Check className="h-3.5 w-3.5" />
                        {t("You voted")}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-2xl font-bold">{t("Transactions")}</h3>
        <div className="flex items-center gap-2">
          <span className="text-neutral-content bg-base-200 border-base-300 rounded-lg border px-2.5 py-1 font-mono">
            {short(teamWalletAddress)}
          </span>

          <Button
            label={<Copy size={12} />}
            variant="ghost"
            size="xs"
            className="btn-square"
            onClick={() => {
              navigator.clipboard.writeText(teamWalletAddress);
              toast.success(t("Copied"));
            }}
          />
        </div>
      </div>

      {actionableCount > 0 && !notifDismissed && (
        <div className="bg-info/10 border-info/20 mt-4 flex items-center justify-between rounded-xl border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Bell className="text-info size-4.5" />
            <p className="text-sm">
              {actionableCount} {t("proposal")}
              {actionableCount > 1 ? "s" : ""} {t("waiting for your vote")}
            </p>
          </div>
          <button onClick={() => setNotifDismissed(true)} className="hover:bg-base-200 rounded p-1">
            <X className="text-neutral-content h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="border-base-300 mt-5 flex flex-wrap items-center gap-1 border-b">
        {TABS.map((tab) => {
          const count = tabCounts[tab] || 0;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors ${isActive ? "border-primary text-primary" : "text-neutral-content hover:text-base-content border-transparent"}`}
            >
              {tab === "all" ? "All" : tab}
              {count > 0 && (
                <span
                  className={`ml-1.5 text-xs ${isActive ? "text-primary" : "text-neutral-content"}`}
                >
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="relative mt-4">
        <Search className="text-neutral-content absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-base-200/60 border-base-300 focus:border-primary/40 placeholder:text-neutral-content/40 h-10 w-full rounded-xl border pr-10 pl-10 text-sm transition-colors outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute top-1/2 right-3 -translate-y-1/2"
          >
            <X className="text-neutral-content h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="loading loading-spinner loading-lg text-primary" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Clock className="text-neutral-content/20 mb-3 h-10 w-10" />
          <p className="text-neutral-content/50">{t("No transactions found")}</p>
        </div>
      )}

      {!isLoading && grouped.length > 0 && (
        <div className="mt-5 space-y-5">
          {grouped.map((group) => (
            <div key={group.date}>
              <p className="text-neutral-content mb-2 px-1 text-xs font-semibold">{group.date}</p>
              <div className="glass-card divide-base-200 divide-y overflow-hidden rounded-2xl">
                {group.items.map(renderRow)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
