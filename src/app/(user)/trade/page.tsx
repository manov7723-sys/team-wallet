"use client";
/**
 * @component TransactionPage
 *
 * Full proposal and transaction history page for a specific team wallet.
 *
 * Displays all on-chain proposals in a tabbed, searchable, date-grouped
 * list. Each row expands inline to show full proposal details, vote
 * progress, and contextual action buttons (vote, execute, cancel).
 * Accessible to unauthenticated users for public team wallet addresses.
 * - Renders proposals grouped by creation date with tab filtering
 *   (all | pending | approved | executed | rejected | expired)
 * - Full-text search across action labels and proposer addresses
 * - Expandable row panels showing: author, creation date, expiry, action
 *   details, vote counts, progress bar, and status-specific banners
 * - Vote action: submits approve or reject via `buildVoteProposalIx`
 * - Execute action: for approved proposals — handles standard instructions
 *   and Jupiter swap execution (fetches live route, creates output ATAs,
 *   passes swap data + ALTs to `buildExecuteProposalIx`)
 * - Cancel action: available to proposer/owner on pending or approved proposals
 * - Saves execution signature to DB via `useSaveProposalLog` post-confirmation
 * - Notification banner showing count of proposals awaiting the current user's vote
 * - Explorer links for addresses and confirmed transaction signatures
 *
 * @states
 * - `activeTab`        — current status filter tab
 * - `search`           — text filter applied across action labels and proposer
 * - `expandedId`       — publicKey of the currently expanded proposal row
 * - `notifDismissed`   — controls visibility of the pending-vote notification banner
 * - `tx.isProcessing`  — a transaction is being built, signed, or confirmed
 * - `tx.isError`       — transaction failed; error shown inline within the expanded row
 *
 * @dataFlow
 * - `useAllProposals`      — full decoded proposal list from on-chain program accounts
 * - `useTeamOnChain`       — voter list, owner, and vote threshold for role checks
 * - `useProposalLogs`      — execution signatures keyed by proposal public key
 * - `useTokens`            — DB token records for building mint → decimals/symbol map
 *   used in `getActionDetail` for human-readable amount formatting
 * - `buildVoteProposalIx`  — Anchor instruction for casting a vote
 * - `buildExecuteProposalIx` — Anchor instruction for executing an approved proposal
 * - `buildCancelProposalIx`  — Anchor instruction for cancelling a proposal
 * - `prepareJupiterSwap`   — fetches live Jupiter route and builds swap data for execution
 * - `useSaveProposalLog`   — DB mutation to persist execution signature post-confirmation
 * - `useInvalidateAllProposals` — React Query cache refresh after any state change
 *
 * @dependencies
 * - `useWallet`           — connected wallet public key for role resolution and voting
 * - `useTransaction`      — versioned tx lifecycle (build → sign → confirm)
 * - `getActionLabel` / `getActionType` / `timeAgo` / `timeLeft` / `formatDate`
 *   — display helpers from proposalHelpers lib
 * - `explorerAddressLink` / `explorerTxLink` — Solana Explorer URL helpers
 */
import { useState, useMemo, useRef, useEffect } from "react";
import {
  ArrowRightLeft,
  ArrowDown,
  ChevronDown,
  Settings2,
  Zap,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";
import Button from "@/src/components/Button/ButtonVW";
import TokenSelectorModal, {
  type TokenOption,
} from "@/src/components/TokenSelector/TokenSelectorModal";
import PriceChart from "@/src/components/Trade/PriceChart";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import { useTeamTokenBalances } from "@/src/hooks/useTokenHooks";
import { useJupiterTokenList, useSwapQuote, useSwapHistory } from "@/src/hooks/useTradeHooks";
import { useTransaction } from "@/src/hooks/useTransaction";
import { useInvalidateProposals, usePendingProposals } from "@/src/hooks/usePendingProposals";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { buildCreateProposalIx, type ProposalAction } from "@/src/lib/web3";
import { buildTokenMap, sortHoldings, SOL_MINT, type JupiterToken } from "@/src/lib/jupiter";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import Input from "@/src/components/Input/InputVW";

function TokenImg({ src, alt, size }: { src: string | null; alt: string; size: number }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken)
    return (
      <div
        className="bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-full font-bold"
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {alt?.[0] || "?"}
      </div>
    );

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}

export default function TradePage() {
  const { activeTeam } = useActiveTeam();
  const { publicKey } = useWallet();
  const tx = useTransaction();
  const t = useTranslations("trade");
  const invalidateProposals = useInvalidateProposals();
  const { data: balances } = useTeamTokenBalances(activeTeam?.teamWalletAddress);
  const { data: jupiterTokens } = useJupiterTokenList();
  const teamAddress = activeTeam?.teamWalletAddress || "";
  const canPropose = activeTeam?.isOwner || activeTeam?.isContributor;

  const tokenMap = useMemo(
    () => (jupiterTokens ? buildTokenMap(jupiterTokens) : new Map<string, JupiterToken>()),
    [jupiterTokens]
  );

  const { data: pendingProposals } = usePendingProposals(teamAddress || undefined);

  const lockedByMint = useMemo(() => {
    const map = new Map<string, bigint>();
    if (!pendingProposals) return map;
    const add = (mint: string, amount: string | number) => {
      const prev = map.get(mint) || BigInt(0);
      map.set(mint, prev + BigInt(amount));
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

  const [inputToken, setInputToken] = useState<TokenOption | null>(null);
  const [outputToken, setOutputToken] = useState<TokenOption | null>(null);
  const [defaultsSet, setDefaultsSet] = useState(false);

  useEffect(() => {
    if (defaultsSet || tokenMap.size === 0) return;
    const MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const sol = tokenMap.get(SOL_MINT);
    const usdc = tokenMap.get(MAINNET_USDC);
    if (sol && !inputToken) {
      setInputToken({
        mint: sol.address,
        symbol: sol.symbol,
        name: sol.name,
        logo: sol.logoURI,
        decimals: sol.decimals,
        price: sol.usdPrice,
        balance: balances?.[sol.address]?.ui,
      });
    }
    if (usdc && !outputToken) {
      setOutputToken({
        mint: usdc.address,
        symbol: usdc.symbol,
        name: usdc.name,
        logo: usdc.logoURI,
        decimals: usdc.decimals,
        price: usdc.usdPrice,
      });
    }
    setDefaultsSet(true);
  }, [tokenMap, balances, defaultsSet, inputToken, outputToken]);
  const [inputAmount, setInputAmount] = useState("");
  const [slippage, setSlippage] = useState("50");
  const [showSettings, setShowSettings] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState<"input" | "output" | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"24h" | "7d" | "30d">("24h");
  const selectorOpenRef = useRef(selectorOpen);
  useEffect(() => {
    selectorOpenRef.current = selectorOpen;
  }, [selectorOpen]);

  const swapHistory = useSwapHistory(teamAddress);
  const iPrice = inputToken ? tokenMap.get(inputToken.mint)?.usdPrice || 0 : 0;
  const oPrice = outputToken ? tokenMap.get(outputToken.mint)?.usdPrice || 0 : 0;

  const rawInputAmount = useMemo(() => {
    if (!inputAmount || !inputToken) return null;
    const parsed = parseFloat(inputAmount);
    if (isNaN(parsed) || parsed <= 0) return null;
    return BigInt(Math.floor(parsed * Math.pow(10, inputToken.decimals))).toString();
  }, [inputAmount, inputToken]);

  const slippageBps = parseInt(slippage) || 50;

  const { data: quote, isLoading: quoteLoading } = useSwapQuote(
    inputToken?.mint || null,
    outputToken?.mint || null,
    rawInputAmount,
    slippageBps
  );

  const outputAmount = useMemo(() => {
    if (!quote || !outputToken) return "";
    const raw = BigInt(quote.outAmount);
    const dec = outputToken.decimals;
    if (dec === 0) return raw.toString();
    const divisor = BigInt(10 ** dec);
    const whole = raw / divisor;
    const frac = raw % divisor;
    if (frac === BigInt(0)) return whole.toString();
    return `${whole}.${frac.toString().padStart(dec, "0").replace(/0+$/, "")}`;
  }, [quote, outputToken]);

  const rate = useMemo(() => {
    if (!inputAmount || !outputAmount) return null;
    const inVal = parseFloat(inputAmount);
    const outVal = parseFloat(outputAmount);
    return inVal > 0 ? (outVal / inVal).toFixed(6) : null;
  }, [inputAmount, outputAmount]);

  const inputTotalBalance = inputToken ? balances?.[inputToken.mint]?.ui || 0 : 0;
  const inputLockedRaw = inputToken ? lockedByMint.get(inputToken.mint) || BigInt(0) : BigInt(0);
  const inputLockedUi = inputToken ? Number(inputLockedRaw) / Math.pow(10, inputToken.decimals) : 0;
  const inputRentReserve = inputToken ? balances?.[inputToken.mint]?.rentReserve || 0 : 0;
  const inputAvailable = Math.max(0, inputTotalBalance - inputLockedUi - inputRentReserve);
  const hasLockedInput = inputLockedUi > 0;
  const swapTokens = () => {
    const t = inputToken;
    setInputToken(outputToken);
    setOutputToken(t);
    setInputAmount("");
  };

  const treasuryHoldings = useMemo(() => {
    if (!balances || tokenMap.size === 0) return [];
    return sortHoldings(
      Object.entries(balances)
        .filter(([mint, bal]) => bal.ui > 0 && tokenMap.has(mint))
        .map(([mint, bal]) => {
          const info = tokenMap.get(mint)!;
          const lockedRaw = lockedByMint.get(mint) || BigInt(0);
          const lockedUi = Number(lockedRaw) / Math.pow(10, info.decimals);
          const available = Math.max(0, bal.ui - lockedUi - (bal.rentReserve || 0));
          return {
            mint,
            symbol: info.symbol,
            name: info.name,
            logo: info.logoURI,
            decimals: info.decimals,
            balance: bal.ui,
            available,
            lockedUi,
            price: info.usdPrice,
            usdValue: bal.ui * info.usdPrice,
          };
        })
    );
  }, [balances, tokenMap, lockedByMint]);

  function handleTokenSelect(token: TokenOption) {
    const side = selectorOpenRef.current;
    if (side === "input") {
      if (outputToken?.mint === token.mint) setOutputToken(inputToken);
      setInputToken(token);
    } else if (side === "output") {
      if (inputToken?.mint === token.mint) setInputToken(outputToken);
      setOutputToken(token);
    }
  }

  function handleHoldingClick(h: (typeof treasuryHoldings)[0]) {
    setInputToken({
      mint: h.mint,
      symbol: h.symbol,
      name: h.name,
      logo: h.logo,
      decimals: h.decimals,
      balance: h.available,
      price: h.price,
    });
  }

  const handleCreateProposal = async () => {
    if (!publicKey || !activeTeam || !inputToken || !outputToken || !rawInputAmount || !quote)
      return;
    if (!canPropose) {
      toast.error(t("Only owners and contributors can create proposals"));
      return;
    }

    const swapAmount = parseFloat(inputAmount);
    if (swapAmount > inputAvailable) {
      toast.error(
        `Exceeds available balance. Available: ${inputAvailable.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${inputToken.symbol}${hasLockedInput ? ` (${inputLockedUi.toLocaleString(undefined, { maximumFractionDigits: 2 })} locked in proposals)` : ""}`
      );
      return;
    }

    const provider = tx.getProvider();
    if (!provider) return;
    try {
      const teamPDA = new PublicKey(teamAddress);
      const action: ProposalAction = {
        swap: {
          inputMint: new PublicKey(inputToken.mint),
          outputMint: new PublicKey(outputToken.mint),
          amountIn: new anchor.BN(rawInputAmount),
          minAmountOut: new anchor.BN(quote.otherAmountThreshold),
          slippageBps,
        },
      };
      const { instructions } = await buildCreateProposalIx(provider, teamPDA, action);
      await tx.execute(instructions, {
        accountKeys: [teamPDA],
        successMessage: "Swap proposal created!",
        onConfirmed: () => {
          invalidateProposals();
          setInputAmount("");
        },
      });
    } catch (err: any) {
      if (err?.message?.includes("User rejected")) return;
      toast.error(err.message || t("Failed to create proposal"));
    }
  };

  const statusMsg = tx.isBuilding
    ? "Building..."
    : tx.isSigning
      ? "Confirm in wallet..."
      : tx.isConfirming
        ? "Confirming..."
        : "";
  const short = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`;

  const exceedsBalance =
    inputToken && inputAmount && parseFloat(inputAmount || "0") > inputAvailable;

  const getButtonLabel = () => {
    if (!canPropose) return "Not Authorized";
    if (!inputToken || !outputToken) return "Select Tokens";
    if (!inputAmount || parseFloat(inputAmount || "0") <= 0) return "Enter Amount";
    if (exceedsBalance) return "Insufficient Balance";
    if (quoteLoading)
      return (
        <>
          <Loader2 className="size-4.5 animate-spin" />
          {t("Getting Quote")}
        </>
      );
    if (!quote) return "No Route Found";
    return (
      <>
        <Zap className="size-4.5" />
        {t("Create Swap Proposal")}
      </>
    );
  };

  const TokenButton = ({ token, onClick }: { token: TokenOption | null; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className="bg-base-300/60 hover:bg-base-300 flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 transition-colors"
    >
      {token ? (
        <>
          <TokenImg src={token.logo} alt={token.symbol} size={24} />
          <span className="font-semibold">{token.symbol}</span>
        </>
      ) : (
        <span className="text-neutral-content font-medium">{t("Select token")}</span>
      )}
      <ChevronDown className="text-neutral-content size-4.5" />
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <ArrowRightLeft className="h-6 w-6" />
          {t("Swap")}
        </h2>
        <p className="text-neutral-content mt-1">
          {canPropose
            ? "Create swap proposals via Jupiter. Requires team approval."
            : "Only owners and contributors can create swap proposals."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="order-2 md:col-span-2">
          <div className="bg-base-100 border-base-200 space-y-4 rounded-2xl border p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("Swap Tokens")}</h3>

              <Button
                type="button"
                label={<Settings2 className="size-4.5" />}
                size="sm"
                className="btn-square"
                onClick={() => setShowSettings(!showSettings)}
              />
            </div>

            {showSettings && (
              <div className="bg-base-200/30 border-base-300 space-y-2 rounded-xl border p-3">
                <p className="text-neutral-content font-semibold">{t("Slippage Tolerance")}</p>
                <div className="flex gap-2">
                  {["10", "50", "100"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSlippage(v)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${slippage === v ? "bg-primary text-primary-content" : "bg-base-300/50 hover:bg-base-300"}`}
                    >
                      {(parseInt(v) / 100).toFixed(1)}%
                    </button>
                  ))}
                  <Input
                    type="number"
                    placeholder="bps"
                    value={!["10", "50", "100"].includes(slippage) ? slippage : ""}
                    onChange={(e) => setSlippage(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="bg-base-200/30 border-base-300 space-y-2 rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <span className="text-neutral-content text-xs font-medium">{t("You pay")}</span>
                {inputToken && (
                  <span className="text-neutral-content text-xs">
                    {t("Available")}{" "}
                    <button
                      type="button"
                      className="text-primary font-medium hover:underline"
                      onClick={() => setInputAmount(String(inputAvailable))}
                    >
                      {inputAvailable.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </button>
                    {hasLockedInput && (
                      <span className="text-warning ml-1">
                        ({inputLockedUi.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                        locked)
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="input-primary"
                />
                <TokenButton token={inputToken} onClick={() => setSelectorOpen("input")} />
              </div>
              {inputAmount && iPrice > 0 && (
                <p className="text-neutral-content truncate text-xs">
                  ≈ $
                  {(parseFloat(inputAmount) * iPrice).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>

            <div className="relative z-10 -my-2 flex justify-center">
              <Button
                type="button"
                onClick={swapTokens}
                size="md"
                label={<ArrowDown className="size-5 max-sm:size-4" />}
                className="btn-square shadow-md transition-all active:scale-95"
              />
            </div>

            <div className="bg-base-200/30 border-base-300 space-y-2 rounded-2xl border p-4">
              <span className="text-neutral-content text-xs font-medium">{t("You receive")}</span>
              <div className="flex items-center gap-3">
                <div className="text-neutral-content/60 flex-1 text-xl font-bold">
                  {quoteLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    outputAmount || "0.00"
                  )}
                </div>
                <TokenButton token={outputToken} onClick={() => setSelectorOpen("output")} />
              </div>
              {outputAmount && oPrice > 0 && (
                <p className="text-neutral-content text-xs">
                  ≈ $
                  {(parseFloat(outputAmount) * oPrice).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>

            {quote && inputAmount && parseFloat(inputAmount) > 0 && (
              <div className="space-y-2 px-1 text-sm">
                {rate && (
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Rate")}</span>
                    <span className="font-mono text-xs">
                      1 {inputToken?.symbol} = {rate} {outputToken?.symbol}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-content">{t("Slippage")}</span>
                  <span>{(quote.slippageBps / 100).toFixed(1)}%</span>
                </div>
                {quote.priceImpact !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Price Impact")}</span>
                    <span className={Math.abs(quote.priceImpact) > 0.01 ? "text-warning" : ""}>
                      {(quote.priceImpact * 100).toFixed(3)}%
                    </span>
                  </div>
                )}
                {quote.inUsdValue > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Value")}</span>
                    <span className="text-xs">
                      ${quote.inUsdValue.toFixed(2)} → ${quote.outUsdValue.toFixed(2)}
                    </span>
                  </div>
                )}
                {quote.routePlan?.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-content">{t("Route")}</span>
                    <span className="max-w-45 truncate text-xs">
                      {quote.routePlan.map((r) => r.swapInfo.label).join(" → ")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {statusMsg && (
              <div className="bg-primary/5 border-primary/20 flex items-center gap-2 rounded-xl border p-3">
                <Loader2 className="text-primary size-4.5 animate-spin" />
                <p className="text-sm">{statusMsg}</p>
              </div>
            )}
            {tx.isError && tx.error && (
              <div className="bg-error/5 border-error/20 flex items-start gap-2 rounded-xl border p-3">
                <AlertTriangle className="text-error mt-0.5 size-4.5 shrink-0" />
                <p className="text-error flex-1 text-sm">{tx.error}</p>
                <button
                  onClick={() => tx.reset()}
                  className="text-error/50 hover:text-error shrink-0"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>
            )}

            <Button
              label={getButtonLabel()}
              variant="primary"
              fullWidth
              size="lg"
              className="rounded-xl"
              disabled={
                !canPropose ||
                !inputToken ||
                !outputToken ||
                !inputAmount ||
                parseFloat(inputAmount || "0") <= 0 ||
                exceedsBalance ||
                !quote ||
                quoteLoading ||
                tx.isProcessing
              }
              onClick={handleCreateProposal}
            />

            <div className="bg-warning/5 border-warning/10 flex items-center gap-2 rounded-xl border p-3">
              <AlertTriangle className="text-warning size-4.5 shrink-0" />
              <p className="text-neutral-content text-xs">
                {t(
                  "Quote refreshes at execution time via Jupiter Slippage protects against price movement"
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="order-1 space-y-6 md:col-span-3">
          <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
            {(() => {
              const STABLES = new Set([
                "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                "USDSwr9ApdHk5bvJKMjzff41FfuE8YqnhuoR7pKKmHR",
              ]);
              const isOutputStable = outputToken && STABLES.has(outputToken.mint);
              const chartToken = isOutputStable && inputToken ? inputToken : outputToken;
              return (
                <>
                  <h3 className="mb-3 text-base font-semibold">
                    {chartToken ? `${chartToken.symbol} Price` : "Token Price"}
                  </h3>
                  <PriceChart
                    mintAddress={chartToken?.mint || null}
                    symbol={chartToken?.symbol}
                    period={chartPeriod}
                    onPeriodChange={setChartPeriod}
                  />
                </>
              );
            })()}
          </div>

          {treasuryHoldings.length > 0 && (
            <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold">{t("Treasury Holdings")}</h3>
              <div className="space-y-1">
                {treasuryHoldings.map((h, i) => (
                  <div
                    key={`h-${i}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleHoldingClick(h)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleHoldingClick(h);
                      }
                    }}
                    aria-label={`Select ${h.symbol}`}
                    className="hover:bg-base-200/30 flex cursor-pointer items-center justify-between rounded-xl p-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <TokenImg src={h.logo} alt={h.symbol} size={36} />
                      <div>
                        <p className="text-sm font-semibold">{h.symbol}</p>
                        <p className="text-neutral-content text-xs">{h.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold">
                        {h.available.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </p>
                      {h.lockedUi > 0 && (
                        <p className="text-warning text-xs">
                          {h.lockedUi.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                          {t("locked")}
                        </p>
                      )}
                      {h.price > 0 ? (
                        <p className="text-neutral-content text-xs">
                          ${h.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      ) : (
                        <p className="text-neutral-content/40 text-xs">—</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {swapHistory.length > 0 && (
            <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                <Clock className="size-4.5" />
                {t("Swap History")}
              </h3>
              <div className="space-y-3">
                {swapHistory.slice(0, 10).map((s, i) => {
                  const inT = tokenMap.get(s.inputMint);
                  const outT = tokenMap.get(s.outputMint);
                  return (
                    <div
                      key={`sw-${i}`}
                      className="bg-base-200/20 flex items-center justify-between rounded-xl p-3"
                    >
                      <div className="flex items-center gap-2">
                        <TokenImg src={inT?.logoURI || null} alt={inT?.symbol || "?"} size={20} />
                        <span className="text-sm font-medium">
                          {inT?.symbol || short(s.inputMint)}
                        </span>
                        <span className="text-neutral-content">→</span>
                        <TokenImg src={outT?.logoURI || null} alt={outT?.symbol || "?"} size={20} />
                        <span className="text-sm font-medium">
                          {outT?.symbol || short(s.outputMint)}
                        </span>
                      </div>
                      <span className="badge badge-sm badge-success">{t("Executed")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <TokenSelectorModal
        isOpen={selectorOpen !== null}
        onClose={() => setSelectorOpen(null)}
        onSelect={handleTokenSelect}
        selectedMint={selectorOpen === "input" ? inputToken?.mint : outputToken?.mint}
        title={selectorOpen === "input" ? "Select token to pay" : "Select token to receive"}
        balances={balances}
      />
    </div>
  );
}
