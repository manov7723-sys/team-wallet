"use client";
/**
 * Dashboard Component
 *
 * @param {Object} props - No explicit props are required for this component.
 *
 * @returns {JSX.Element}
 * - Returns the main dashboard view for the active team wallet.
 * - Fetches and combines on-chain and database data using custom hooks.
 * - Retrieves token balances, proposals, programs, and member details.
 * - Builds token metadata map from external (Jupiter) and internal sources.
 * - Calculates locked token amounts based on pending proposals.
 * - Derives available and locked balances for each token.
 * - Separates NFTs from fungible tokens using decimals logic.
 * - Computes USD value of tokens using price data.
 * - Filters and categorizes proposals (pending, approved, executed).
 * - Extracts recent proposals and maps them with transaction signatures.
 * - Determines team structure (owner, voters, contributors).
 * - Calculates overall stats like balance, members, NFTs, and programs.
 * - Formats data (addresses, numbers, timestamps) for display.
 * - Enables navigation to treasury, members, programs, and transactions.
 * - Integrates translations for multi-language support.
 */
import { useMemo } from "react";
import {
  ChevronRight,
  Clock,
  Code2,
  Coins,
  Copy,
  Crown,
  ExternalLink,
  ImageIcon,
  ShieldCheck,
  ThumbsUp,
  Users,
  Wallet,
  Zap,
  Activity,
  AlertTriangle,
  Check,
  Plus,
} from "lucide-react";
import Button from "@/src/components/Button/ButtonVW";
import TokenImg from "@/src/components/TokenImg/TokenImg";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import { useTeamTokenBalances, useTokens } from "@/src/hooks/useTokenHooks";
import { useJupiterTokenList } from "@/src/hooks/useTradeHooks";
import { useTeamOnChain } from "@/src/hooks/useTeamOnChain";
import { useAllProposals } from "@/src/hooks/useAllProposals";
import { useProposalLogs } from "@/src/hooks/useProposalLogHooks";
import { usePrograms } from "@/src/hooks/useProgramHooks";
import { usePendingProposals } from "@/src/hooks/usePendingProposals";
import { buildTokenMap, sortHoldings, SOL_MINT, type JupiterToken } from "@/src/lib/jupiter";
import { getActionLabel, timeAgo } from "@/src/lib/proposalHelpers";
import { explorerTxLink } from "@/src/lib/explorer";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

const short = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`;
const shortNum = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : n % 1 === 0
        ? String(n)
        : n.toFixed(2);

const shortSol = (n: number) => {
  if (n === 0) return "0";
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(4);
};

export default function Dashboard() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const { activeTeam } = useActiveTeam();
  const teamAddress = activeTeam?.teamWalletAddress || "";

  const { data: balances } = useTeamTokenBalances(teamAddress || undefined);
  const { data: jupiterTokens } = useJupiterTokenList();
  const { data: teamOnChain } = useTeamOnChain(teamAddress || undefined);
  const { data: allProposals } = useAllProposals(teamAddress || undefined);
  const { data: proposalLogs } = useProposalLogs(teamAddress || undefined);
  const { data: programs } = usePrograms(teamAddress || undefined);
  const { data: dbTokens } = useTokens(teamAddress || undefined);
  const { data: pendingProposals } = usePendingProposals(teamAddress || undefined);

  const tokenMap = useMemo(
    () => (jupiterTokens ? buildTokenMap(jupiterTokens) : new Map<string, JupiterToken>()),
    [jupiterTokens]
  );
  const dbTokenMap = useMemo(() => {
    const m = new Map<string, { name: string; symbol: string; imageUrl: string }>();
    if (dbTokens)
      for (const t of dbTokens)
        m.set(t.mintAddress, { name: t.name, symbol: t.symbol, imageUrl: t.imageUrl });
    return m;
  }, [dbTokens]);

  const sigMap = useMemo(() => {
    const m: Record<string, string> = {};
    if (proposalLogs) for (const l of proposalLogs) m[l.proposalKey] = l.signature;
    return m;
  }, [proposalLogs]);

  const lockedByMint = useMemo(() => {
    const map = new Map<string, bigint>();
    if (!pendingProposals) return map;
    const add = (mint: string, amount: string | number) => {
      map.set(mint, (map.get(mint) || BigInt(0)) + BigInt(amount));
    };
    for (const p of pendingProposals) {
      const a = p.action as any;
      if (a.transferSol) add(SOL_MINT, a.transferSol.amount);
      if (a.transferToken) add(a.transferToken.mint, a.transferToken.amount);
      if (a.tokenBurn) add(a.tokenBurn.mint, a.tokenBurn.amount);
      if (a.swap) add(a.swap.inputMint, a.swap.amountIn);
    }
    return map;
  }, [pendingProposals]);

  const { tokenHoldings, nftList, solLocked, solAvailable } = useMemo(() => {
    if (!balances)
      return {
        tokenHoldings: [],
        nftList: [] as {
          mint: string;
          name: string;
          symbol: string;
          image: string | null;
          amount: number;
        }[],
        solBalance: 0,
        solLocked: 0,
        solAvailable: 0,
      };
    const tokens: {
      mint: string;
      symbol: string;
      name: string;
      logo: string | null;
      decimals: number;
      balance: number;
      available: number;
      lockedUi: number;
      price: number;
      usdValue: number;
    }[] = [];
    const nfts: {
      mint: string;
      name: string;
      symbol: string;
      image: string | null;
      amount: number;
    }[] = [];

    for (const [mint, bal] of Object.entries(balances)) {
      const dbToken = dbTokenMap.get(mint);
      const jupToken = tokenMap.get(mint);

      if (bal.decimals === 0) {
        nfts.push({
          mint,
          name: dbToken?.name || jupToken?.name || mint.slice(0, 4) + "..." + mint.slice(-4),
          symbol: dbToken?.symbol || jupToken?.symbol || "NFT",
          image: dbToken?.imageUrl || jupToken?.logoURI || null,
          amount: parseInt(bal.raw),
        });
        continue;
      }

      const lockedRaw = lockedByMint.get(mint) || BigInt(0);
      const lockedUi = Number(lockedRaw) / Math.pow(10, bal.decimals);
      const rentReserve = bal.rentReserve || 0;
      const available = Math.max(0, bal.ui - lockedUi - rentReserve);
      const price = jupToken?.usdPrice || 0;
      tokens.push({
        mint,
        symbol:
          dbToken?.symbol ||
          jupToken?.symbol ||
          (mint === SOL_MINT ? "SOL" : mint.slice(0, 4) + "..."),
        name: dbToken?.name || jupToken?.name || (mint === SOL_MINT ? "Solana" : "Unknown Token"),
        logo: dbToken?.imageUrl || jupToken?.logoURI || null,
        decimals: bal.decimals,
        balance: bal.ui,
        available,
        lockedUi,
        price,
        usdValue: bal.ui * price,
      });
    }
    const sorted = sortHoldings(tokens);
    const solEntry = tokens.find((t) => t.mint === SOL_MINT);
    return {
      tokenHoldings: sorted,
      nftList: nfts,
      solBalance: solEntry?.balance || 0,
      solLocked: solEntry?.lockedUi || 0,
      solAvailable: solEntry?.available || 0,
    };
  }, [balances, tokenMap, dbTokenMap, lockedByMint]);

  const pendingCount = allProposals?.filter((p) => p.status === "pending").length || 0;
  const approvedCount = allProposals?.filter((p) => p.status === "approved").length || 0;
  const executedCount = allProposals?.filter((p) => p.status === "executed").length || 0;
  const activeProposals =
    allProposals
      ?.filter((p) => p.status === "pending" || p.status === "approved")
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5) || [];
  const executedProposals =
    allProposals
      ?.filter((p) => p.status === "executed")
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5) || [];
  const threshold = teamOnChain?.voteThreshold || 1;

  const owner = teamOnChain?.owner || "";
  const voters = teamOnChain?.voters || [];
  const contributors = teamOnChain?.contributors || [];

  const uniqueMemberCount = new Set([...voters, ...contributors]).size;

  const stats = [
    {
      label: "SOL Balance",
      value: shortSol(solAvailable),
      sub: solLocked > 0 ? `${shortSol(solLocked)} locked` : "None locked",
      icon: Wallet,
      color: "text-black",
      bg: "bg-black/10",
    },
    {
      label: "Proposals",
      value: shortNum(allProposals?.length || 0),
      sub: `${pendingCount} pending · ${executedCount} executed`,
      icon: Activity,
      color: "text-info",
      bg: "bg-info/10",
    },
    {
      label: "Members",
      value: shortNum(uniqueMemberCount),
      sub: `${voters.length} voters · ${contributors.length} contributors`,
      icon: Users,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Programs",
      value: shortNum(programs?.length || 0),
      sub: `Managed by team`,
      icon: Code2,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "NFTs",
      value: shortNum(nftList.length),
      sub: "In treasury",
      icon: ImageIcon,
      color: "text-error",
      bg: "bg-error/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold">{t("Dashboard")}</h3>
        <p className="text-neutral-content mt-0.5">
          {activeTeam?.name || "Team Wallet"} · {teamAddress ? short(teamAddress) : "—"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-base-100 border-base-200 hover:border-base-300 rounded-2xl border p-4 shadow-sm transition-colors"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className={`h-11 w-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <Icon className={`size-5 ${s.color}`} />
                </div>
              </div>
              <h3>{s.value}</h3>
              <p className="text-neutral-content mt-0.5 font-bold">{s.label}</p>
              <p className="text-neutral-content/70 mt-0.5">{s.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bg-base-100 border-base-200 rounded-2xl border shadow-sm lg:col-span-2">
          <div className="border-base-200 flex items-center justify-between border-b px-6 py-4">
            <h4 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="text-warning size-4.5" />
              {t("NeedsAttention")}
            </h4>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <span className="bg-info/10 text-info rounded-full px-2 py-1 text-xs font-medium uppercase">
                  {pendingCount}
                  {t("pending")}
                </span>
              )}
              {approvedCount > 0 && (
                <span className="bg-warning/10 text-warning rounded-full px-2 py-1 text-xs font-medium uppercase">
                  {approvedCount} {t("ready")}
                </span>
              )}
            </div>
          </div>
          <div className="divide-base-200 divide-y">
            {activeProposals.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Check className="text-success mx-auto mb-2 h-8 w-8" />
                <p className="text-neutral-content">{t("All caught up no pending proposals")}</p>
              </div>
            ) : (
              activeProposals.map((p) => (
                <div
                  key={p.publicKey}
                  className="hover:bg-base-200/20 cursor-pointer px-6 py-3.5 transition-colors"
                  onClick={() => router.push(`/transaction/${teamAddress}`)}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs leading-0 font-medium uppercase ${p.status === "approved" ? "border-warning/30 bg-warning/10 text-warning" : "border-info/30 bg-info/10 text-info"}`}
                    >
                      {p.status === "approved" ? (
                        <Zap className="size-4" />
                      ) : (
                        <Clock className="size-4" />
                      )}
                      {p.status}
                    </span>
                    <span className="text-neutral-content">{timeAgo(p.createdAt)}</span>
                  </div>
                  <p className="truncate text-sm font-medium">{getActionLabel(p.action)}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-neutral-content font-mono text-xs">
                      {short(p.proposer)}
                    </span>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="text-success size-4.5" />
                      <span className="text-xs font-semibold">
                        {p.votesFor}/{threshold}
                      </span>
                      <div className="bg-base-300 ml-1 h-1 w-10 overflow-hidden rounded-full">
                        <div
                          className="bg-success h-full rounded-full"
                          style={{ width: `${Math.min((p.votesFor / threshold) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {activeProposals.length > 0 && (
            <div className="text-primary mx-auto flex items-center gap-1 text-xs hover:underline">
              <Button
                label={
                  <>
                    {t("View all proposals")}
                    <ChevronRight className="h-3 w-3" />
                  </>
                }
                onClick={() => router.push(`/transaction/${teamAddress}`)}
              />
            </div>
          )}
        </div>

        <div className="bg-base-100 border-base-200 rounded-2xl border shadow-sm">
          <div className="border-base-200 border-b px-6 py-4">
            <h4 className="flex items-center gap-2 font-semibold">
              <Check className="text-success size-4.5" />
              {t("RecentlyExecuted")}
            </h4>
          </div>
          <div className="divide-base-200 divide-y">
            {executedProposals.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-neutral-content">{t("No executed proposals yet")}</p>
              </div>
            ) : (
              executedProposals.map((p) => (
                <div
                  key={p.publicKey}
                  className="hover:bg-base-200/20 flex items-center justify-between px-6 py-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{getActionLabel(p.action)}</p>
                    <p className="text-neutral-content">
                      {short(p.proposer)} · {timeAgo(p.createdAt)}
                    </p>
                  </div>
                  {sigMap[p.publicKey] ? (
                    <a
                      href={explorerTxLink(sigMap[p.publicKey])}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:bg-success/10 text-success ml-2 shrink-0 rounded-lg p-1.5"
                      title="View on Explorer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="bg-success/10 text-success ml-2 shrink-0 rounded-full px-2 py-0.5 font-bold">
                      {t("Done")}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bg-base-100 border-base-200 overflow-hidden rounded-2xl border shadow-sm lg:col-span-2">
          <div className="border-base-200 flex items-center justify-between border-b px-6 py-4">
            <h4 className="flex items-center gap-2 font-semibold">
              <Coins className="text-primary size-4.5" />
              {t("Token Holdings")}
            </h4>
            <Button
              label={
                <>
                  {t("View all")}
                  <ChevronRight className="size-4" />
                </>
              }
              variant="ghost"
              size="xs"
              onClick={() => router.push("/treasury")}
            />
          </div>
          {tokenHoldings.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-neutral-content text-sm">{t("No tokens in treasury")}</p>
            </div>
          ) : (
            <table className="table w-full">
              <thead>
                <tr className="text-neutral-content text-xs tracking-wider uppercase">
                  <th className="bg-base-200/30 font-medium">{t("Asset")}</th>
                  <th className="bg-base-200/30 text-right font-medium">{t("Balance")}</th>
                  <th className="bg-base-200/30 text-right font-medium">{t("Value")}</th>
                </tr>
              </thead>
              <tbody>
                {tokenHoldings.slice(0, 5).map((h) => (
                  <tr key={h.mint} className="hover:bg-base-200/20 transition-colors">
                    <td>
                      <div className="flex items-center gap-3">
                        <TokenImg src={h.logo} alt={h.symbol} size={32} className="h-8" />
                        <div>
                          <p className="text-sm font-semibold">{h.symbol}</p>
                          <p className="text-neutral-content">{h.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                      <p className="font-mono text-sm">
                        {h.available.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </p>
                      {h.lockedUi > 0 && (
                        <p className="text-warning">{h.lockedUi.toFixed(2)} locked</p>
                      )}
                    </td>
                    <td className="text-right text-sm font-medium">
                      {h.price > 0
                        ? `$${h.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-semibold">
              <ImageIcon className="text-accent size-4.5" />
              {t("NFTs")} ({nftList.length})
            </h4>
            {nftList.length > 0 && (
              <button
                onClick={() => router.push("/treasury")}
                className="text-primary flex items-center gap-1 text-xs hover:underline"
              >
                {t("View all")}
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>
          {nftList.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-neutral-content text-sm">{t("No NFTs in treasury")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {nftList.slice(0, 4).map((nft) => (
                <div
                  key={nft.mint}
                  className="border-base-200 group hover:border-primary/20 cursor-pointer overflow-hidden rounded-xl border transition-all"
                  onClick={() => router.push("/treasury")}
                >
                  <div className="bg-base-200/50 aspect-square overflow-hidden">
                    {nft.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={nft.image}
                        alt={nft.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="text-neutral-content/30 flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-xs font-semibold">{nft.name}</p>
                    <p className="text-neutral-content">
                      {nft.amount > 1 ? `×${nft.amount}` : nft.symbol}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="bg-base-100 border-base-200 rounded-2xl border shadow-sm">
          <div className="border-base-200 flex items-center justify-between border-b px-6 py-4">
            <h4 className="flex items-center gap-2 font-semibold">
              <Users className="text-warning size-4.5" />
              {t("Team Members")}
            </h4>
            <span className="text-neutral-content">
              {threshold}/{voters.length} {t("threshold")}
            </span>
          </div>
          <div className="divide-base-200 divide-y">
            {owner && (
              <div
                className="hover:bg-base-200/20 flex cursor-pointer items-center justify-between px-6 py-3 transition-colors"
                onClick={() => router.push("/members")}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-warning/10 flex h-9 w-9 items-center justify-center rounded-xl">
                    <Crown className="text-warning size-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("Owner")}</p>
                    <p className="text-neutral-content font-mono">{short(owner)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {contributors.includes(owner) && (
                    <span className="bg-success/10 text-success border-success/20 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
                      {t("Contributor")}
                    </span>
                  )}
                  <span className="bg-warning h-2 w-2 rounded-full" title="Owner" />
                </div>
              </div>
            )}
            {(() => {
              const memberSet = new Set([...voters, ...contributors]);
              memberSet.delete(owner);
              return [...memberSet].slice(0, 4).map((m) => {
                const isVoter = voters.includes(m);
                const isContrib = contributors.includes(m);
                return (
                  <div
                    key={m}
                    className="hover:bg-base-200/20 flex cursor-pointer items-center justify-between px-6 py-3 transition-colors"
                    onClick={() => router.push("/members")}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${isContrib ? "bg-success/10" : "bg-base-200/80"}`}
                      >
                        <ShieldCheck
                          className={`size-4.5 ${isContrib ? "text-success" : "text-neutral-content"}`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium">
                            {isVoter ? t("Voter") : t("Contributor")}
                          </p>
                          {isVoter && isContrib && (
                            <span className="bg-success/10 text-success border-success/20 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
                              {t("Contributor")}
                            </span>
                          )}
                        </div>
                        <p className="text-neutral-content font-mono">{short(m)}</p>
                      </div>
                    </div>
                    <span
                      className={`h-2 w-2 rounded-full ${isContrib ? "bg-success" : "bg-info"}`}
                      title={isContrib ? "Contributor" : "Voter"}
                    />
                  </div>
                );
              });
            })()}
          </div>
          <div className="border-base-200 flex items-center justify-between border-t px-6 py-3">
            <div className="text-neutral-content flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="bg-info h-2 w-2 rounded-full" />
                {voters.length} {t("voters")}
              </span>
              <span className="flex items-center gap-1">
                <span className="bg-success h-2 w-2 rounded-full" />
                {contributors.length} {t("contributors")}
              </span>
            </div>

            <Button
              label={
                <>
                  {t("Manage")}
                  <ChevronRight className="size-4" />
                </>
              }
              variant="ghost"
              size="xs"
              onClick={() => router.push("/members")}
            />
          </div>
        </div>

        <div className="bg-base-100 border-base-200 rounded-2xl border shadow-sm">
          <div className="border-base-200 flex items-center justify-between border-b px-6 py-4">
            <h4 className="flex items-center gap-2 font-semibold">
              <Code2 className="text-accent size-4.5" />
              {t("Programs")}
            </h4>
            <span className="text-neutral-content">
              {programs?.length || 0} {t("managed")}
            </span>
          </div>
          {!programs || programs.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Code2 className="text-neutral-content/30 mx-auto mb-2 h-8 w-8" />
              <p className="text-neutral-content text-sm">{t("No programs managed")}</p>
              <Button
                label={
                  <>
                    {t("Add Program")}
                    <Plus className="size-4.5" />
                  </>
                }
                variant="primary"
                size="sm"
                className="max-sm:btn-sm mt-3"
                onClick={() => router.push("/programs")}
              />
            </div>
          ) : (
            <>
              <div className="divide-base-200 divide-y">
                {programs.slice(0, 4).map((prog: any) => (
                  <div
                    key={prog._id || prog.programId}
                    className="hover:bg-base-200/20 flex cursor-pointer items-center justify-between px-6 py-3 transition-colors"
                    onClick={() => router.push("/programs")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-accent/10 flex h-9 w-9 items-center justify-center rounded-xl">
                        <Code2 className="text-accent size-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{prog.name || "Unnamed"}</p>
                        <p className="text-neutral-content font-mono">{short(prog.programId)}</p>
                      </div>
                    </div>

                    <Button
                      label={<Copy size={12} />}
                      variant="ghost"
                      size="xs"
                      className="btn-square"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(prog.programId);
                        toast.success("Copied");
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="border-base-200 border-t px-6 py-3">
                <Button
                  label={
                    <>
                      {t("Manage programs")}
                      <ChevronRight className="size-4.5" />
                    </>
                  }
                  variant="ghost"
                  size="xs"
                  onClick={() => router.push("/programs")}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
