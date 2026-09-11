"use client";
/**
 * Treasury Component
 *
 * Displays and manages the treasury of a team wallet on Solana.
 * Includes token balances, NFT holdings, and actions like sending assets
 * via proposal-based governance and depositing funds.
 *
 * Features:
 * - Fetches on-chain token balances and NFT data
 * - Merges token metadata from Jupiter + DB sources
 * - Calculates available, locked, and total balances
 * - Supports sending tokens/NFTs via proposal creation
 * - Handles deposit via QR code and wallet address
 * - Displays pending proposal locks on assets
 *
 * Dependencies:
 * - useActiveTeam: Active team context
 * - useTeamTokenBalances: Fetches token balances
 * - useJupiterTokenList: Token price + metadata
 * - usePendingProposals: Locks calculation
 * - useTransaction: Handles transaction lifecycle
 * - Solana Wallet Adapter
 *
 * @returns {JSX.Element} Treasury UI
 */
import { useState, useMemo } from "react";
import Button from "@/src/components/Button/ButtonVW";
import Input from "@/src/components/Input/InputVW";
import TokenSelectorModal, {
  type TokenOption,
} from "@/src/components/TokenSelector/TokenSelectorModal";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import { useTeamTokenBalances } from "@/src/hooks/useTokenHooks";
import { useTokens } from "@/src/hooks/useTokenHooks";
import { useTeamOnChain } from "@/src/hooks/useTeamOnChain";
import { useJupiterTokenList } from "@/src/hooks/useTradeHooks";
import { usePendingProposals, useInvalidateProposals } from "@/src/hooks/usePendingProposals";
import { useTransaction } from "@/src/hooks/useTransaction";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { buildCreateProposalIx, type ProposalAction } from "@/src/lib/web3";
import { buildTokenMap, sortHoldings, SOL_MINT, type JupiterToken } from "@/src/lib/jupiter";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Coins,
  Copy,
  Check,
  ImageIcon,
  Landmark,
  Lock,
  LockKeyholeOpen,
  Wallet,
  Loader2,
  X,
} from "lucide-react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import QRCode from "react-qr-code";
import { toast } from "react-toastify";
import TokenImg from "@/src/components/TokenImg/TokenImg";
import Image from "next/image";
import { useTranslations } from "next-intl";

type Tab = "tokens" | "nfts";

function extractCid(url: string): string | null {
  if (url.startsWith("ipfs://")) return url.slice(7);
  const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  if (match) return match[1];
  const sub = url.match(/([a-zA-Z0-9]+)\.ipfs\./);
  if (sub) return sub[1];
  return null;
}

const NFT_FALLBACKS = [
  (cid: string) => `https://${cid}.ipfs.dweb.link/`,
  (cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`,
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
];

function NftImage({ src, alt }: { src: string; alt: string }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [gwIdx, setGwIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setCurrentSrc(src);
    setGwIdx(0);
    setFailed(false);
  }

  const handleError = () => {
    const cid = extractCid(src);
    if (cid && gwIdx < NFT_FALLBACKS.length) {
      setCurrentSrc(NFT_FALLBACKS[gwIdx](cid));
      setGwIdx((i) => i + 1);
      return;
    }
    setFailed(true);
  };

  if (failed)
    return (
      <div className="text-neutral-content/30 flex h-full w-full items-center justify-center">
        <ImageIcon className="h-12 w-12" />
      </div>
    );

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill
      sizes="(max-width: 640px) 50vw, 20vw"
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      onError={handleError}
    />
  );
}

export default function Treasury() {
  const { activeTeam } = useActiveTeam();
  const { publicKey } = useWallet();
  const txHook = useTransaction();
  const t = useTranslations("treasury");
  const invalidateProposals = useInvalidateProposals();
  const teamAddress = activeTeam?.teamWalletAddress || "";
  const canPropose = activeTeam?.isOwner || activeTeam?.isContributor;

  const { data: balances } = useTeamTokenBalances(teamAddress || undefined);
  const { data: jupiterTokens } = useJupiterTokenList();
  const { data: teamOnChain } = useTeamOnChain(teamAddress || undefined);
  const { data: pendingProposals } = usePendingProposals(teamAddress || undefined);
  const { data: dbTokens } = useTokens(teamAddress || undefined);

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

  const [tab, setTab] = useState<Tab>("tokens");
  const [showSend, setShowSend] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [sendToken, setSendToken] = useState<TokenOption | null>(null);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendTokenSelector, setSendTokenSelector] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recipientError, setRecipientError] = useState("");

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

  const { tokenHoldings, nftList, totalUsd, solBalance, solLocked, solAvailable } = useMemo(() => {
    if (!balances)
      return {
        tokenHoldings: [],
        nftList: [],
        totalUsd: 0,
        solBalance: 0,
        solLocked: 0,
        solAvailable: 0,
        solRentReserve: 0,
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
    let usdTotal = 0;

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
      const usdValue = bal.ui * price;
      usdTotal += usdValue;
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
        usdValue,
      });
    }
    const sorted = sortHoldings(tokens);
    const solEntry = tokens.find((t) => t.mint === SOL_MINT);
    const solRent = balances[SOL_MINT]?.rentReserve || 0;
    return {
      tokenHoldings: sorted,
      nftList: nfts,
      totalUsd: usdTotal,
      solBalance: solEntry?.balance || 0,
      solLocked: solEntry?.lockedUi || 0,
      solAvailable: solEntry?.available || 0,
      solRentReserve: solRent,
    };
  }, [balances, tokenMap, dbTokenMap, lockedByMint]);

  const sendDecimals = sendToken?.decimals || 0;
  const sendBalance = sendToken ? balances?.[sendToken.mint]?.ui || 0 : 0;
  const sendLockedRaw = sendToken ? lockedByMint.get(sendToken.mint) || BigInt(0) : BigInt(0);
  const sendLockedUi = sendToken ? Number(sendLockedRaw) / Math.pow(10, sendDecimals) : 0;
  const sendRentReserve = sendToken ? balances?.[sendToken.mint]?.rentReserve || 0 : 0;
  const sendAvailable = Math.max(0, sendBalance - sendLockedUi - sendRentReserve);
  const threshold = teamOnChain?.voteThreshold || 1;

  const handleSend = async () => {
    if (!publicKey || !activeTeam || !sendToken || !sendRecipient.trim() || !sendAmount) return;
    if (!canPropose) {
      toast.error(t("Only owners and contributors can create proposals"));
      return;
    }
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t("Invalid amount"));
      return;
    }
    if (amount > sendAvailable) {
      toast.error(
        `Exceeds available balance (${sendAvailable.toLocaleString(undefined, { maximumFractionDigits: 4 })})`
      );
      return;
    }
    let recipientPk: PublicKey;
    try {
      recipientPk = new PublicKey(sendRecipient.trim());
    } catch {
      toast.error(t("Invalid recipient address"));
      return;
    }
    const provider = txHook.getProvider();
    if (!provider) return;
    try {
      const teamPDA = new PublicKey(teamAddress);
      let action: ProposalAction;
      if (sendToken.mint === SOL_MINT) {
        action = {
          transferSol: { amount: new anchor.BN(Math.floor(amount * 1e9)), recipient: recipientPk },
        };
      } else {
        action = {
          transferToken: {
            amount: new anchor.BN(
              BigInt(Math.floor(amount * Math.pow(10, sendDecimals))).toString()
            ),
            recipient: recipientPk,
            mint: new PublicKey(sendToken.mint),
          },
        };
      }
      const { instructions } = await buildCreateProposalIx(provider, teamPDA, action);
      await txHook.execute(instructions, {
        accountKeys: [teamPDA],
        successMessage: `Transfer proposal created: ${amount} ${sendToken.symbol}`,
        onConfirmed: () => {
          invalidateProposals();
          setShowSend(false);
          setSendRecipient("");
          setSendAmount("");
        },
      });
    } catch (err: any) {
      if (err?.message?.includes("User rejected")) return;
      toast.error(err.message || t("Failed to create proposal"));
    }
  };

  const handleSendNFT = (nft: {
    mint: string;
    name: string;
    symbol: string;
    image: string | null;
  }) => {
    setSendToken({
      mint: nft.mint,
      symbol: nft.symbol,
      name: nft.name,
      logo: nft.image,
      decimals: 0,
    });
    setSendAmount("1");
    setShowSend(true);
  };

  const openSendWithToken = (h: (typeof tokenHoldings)[0]) => {
    setSendToken({
      mint: h.mint,
      symbol: h.symbol,
      name: h.name,
      logo: h.logo,
      decimals: h.decimals,
      balance: h.available,
      price: h.price,
    });
    setSendAmount("");
    setShowSend(true);
  };

  const short = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  const statusMsg = txHook.isBuilding
    ? "Building..."
    : txHook.isSigning
      ? "Confirm in wallet..."
      : txHook.isConfirming
        ? "Confirming..."
        : "";

  const TokenPicker = ({ token, onClick }: { token: TokenOption | null; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="bg-base-300/60 hover:bg-base-300 flex w-full items-center gap-2 rounded-xl px-3 py-2 transition-colors"
    >
      {token ? (
        <>
          <TokenImg src={token.logo || null} alt={token.symbol} size={24} />
          <span className="flex-1 text-left text-sm font-semibold">{token.symbol}</span>
          <span className="text-neutral-content text-xs">{token.name}</span>
        </>
      ) : (
        <span className="text-neutral-content flex-1 text-left text-sm">{t("Select token")}</span>
      )}
      <ChevronDown className="text-neutral-content size-4.5" />
    </button>
  );
  const closeSendModal = () => {
    setShowSend(false);
    setSendToken(null);
    setSendRecipient("");
    setSendAmount("");
    setRecipientError("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3>{t("Treasury")}</h3>
          <p className="text-neutral-content mt-1 text-sm">
            {t("Manage vault funds tokens  NFTs")}
          </p>
        </div>
        <div className="flex gap-2">
          {canPropose && (
            <Button
              label={
                <>
                  <ArrowUpRight className="h-4 w-4" />
                  {t("Send")}
                </>
              }
              variant="success"
              size="sm"
              onClick={() => {
                setSendToken(null);
                setShowSend(true);
              }}
            />
          )}
          <Button
            label={
              <>
                <ArrowDownLeft className="size-4.5" />
                {t("Deposit")}
              </>
            }
            variant="primary"
            size="sm"
            onClick={() => setShowDeposit(true)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="glass-card border-primary/60 bg-primary/5 border-2 p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="bg-primary/20 flex h-12 w-12 items-center justify-center rounded-xl">
              <Landmark className="text-primary h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-bold">{activeTeam?.name || "Team Wallet"}</p>
              <div className="flex items-center gap-1">
                <span className="text-neutral-content font-mono">
                  {teamAddress ? short(teamAddress) : "—"}
                </span>
                {teamAddress && (
                  <Button
                    label={<Copy size={12} />}
                    variant="ghost"
                    size="xs"
                    className="btn-square"
                    onClick={() => {
                      navigator.clipboard.writeText(teamAddress);
                      toast.success("Copied");
                    }}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="mb-1 flex items-center gap-2">
            {}
            <Image
              src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
              alt="SOL"
              width={28}
              height={28}
              className="rounded-full"
            />
            <h2 className="text-2xl font-bold">
              {solAvailable.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
            </h2>
          </div>
          <p className="text-neutral-content mb-3 text-sm">
            {t("Total portfolio")}{" "}
            <strong className="text-base-content">
              ${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </strong>
          </p>
          <div className="flex gap-2">
            {canPropose && (
              <Button
                label={
                  <>
                    <ArrowUpRight className="h-4 w-4" />
                    {t("Send")}
                  </>
                }
                fullWidth
                variant="success"
                size="sm"
                onClick={() => {
                  setSendToken(null);
                  setShowSend(true);
                }}
                className="flex-1"
              />
            )}
            <Button
              label={
                <>
                  <ArrowDownLeft className="size-4.5" />
                  {t("Deposit")}
                </>
              }
              fullWidth
              variant="primary"
              size="sm"
              onClick={() => setShowDeposit(true)}
              className="flex-1"
            />
          </div>
        </div>
        <div className="glass-card p-5">
          <h5 className="mb-4 flex items-center gap-2 font-bold">
            <LockKeyholeOpen className="text-primary h-5 w-5" />
            {t("Locked Available")}
          </h5>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-neutral-content flex items-center gap-2 text-sm">
                <Wallet className="text-primary size-4.5" />
                {t("Available SOL")}
              </span>
              <span className="font-mono font-semibold">
                {solAvailable.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </div>
            {solLocked > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-content flex items-center gap-2 text-sm">
                  <Lock className="text-warning size-4.5" />
                  {t("Locked SOL")}
                </span>
                <span className="text-warning font-mono font-semibold">
                  {solLocked.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              </div>
            )}
            <div className="border-border flex justify-between border-t pt-2">
              <span className="text-neutral-content text-sm">{t("Total SOL")}</span>
              <span className="font-mono font-bold">
                {solBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="bg-secondary/30 border-border mb-4 flex w-fit items-center gap-1 rounded-xl border p-1">
          <button
            onClick={() => setTab("tokens")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === "tokens" ? "bg-primary text-primary-content shadow" : "hover:bg-secondary/50 text-neutral-content"}`}
          >
            <Coins className="mr-1.5 inline size-4.5" />
            {t("Tokens")} ({tokenHoldings.length})
          </button>
          <button
            onClick={() => setTab("nfts")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === "nfts" ? "bg-primary text-primary-content shadow" : "hover:bg-secondary/50 text-neutral-content"}`}
          >
            <ImageIcon className="mr-1.5 inline size-4.5" />
            {t("NFTs")} ({nftList.length})
          </button>
        </div>

        {tab === "tokens" && (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="text-neutral-content text-xs tracking-wider uppercase">
                    <th className="bg-secondary/20">{t("Asset")}</th>
                    <th className="bg-secondary/20 text-right">{t("Balance")}</th>
                    <th className="bg-secondary/20 text-right">{t("Value")}</th>
                    <th className="bg-secondary/20 text-right">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenHoldings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-neutral-content py-8 text-center">
                        {t("No tokens found in treasury")}
                      </td>
                    </tr>
                  ) : (
                    tokenHoldings.map((h) => (
                      <tr key={h.mint} className="hover:bg-secondary/10">
                        <td>
                          <div className="flex items-center gap-3">
                            <TokenImg src={h.logo} alt={h.symbol} size={36} className="h-9" />
                            <div>
                              <p className="font-semibold">{h.symbol}</p>
                              <p className="text-neutral-content">{h.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right">
                          <p className="font-mono font-semibold">
                            {h.available.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </p>
                          {h.lockedUi > 0 && (
                            <p className="text-warning">
                              {h.lockedUi.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
                              {t("locked")}
                            </p>
                          )}
                        </td>
                        <td className="text-right">
                          {h.price > 0 ? (
                            <span className="font-mono">
                              ${h.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-neutral-content/40">—</span>
                          )}
                        </td>
                        <td className="text-right">
                          {canPropose && (
                            <Button
                              label="Send"
                              variant="ghost"
                              size="xs"
                              onClick={() => openSendWithToken(h)}
                            />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "nfts" &&
          (nftList.length === 0 ? (
            <div className="text-neutral-content py-12 text-center text-sm">
              {t("No NFTs found in treasury")}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {nftList.map((nft) => (
                <div
                  key={nft.mint}
                  className="glass-card group hover:border-primary/20 overflow-hidden transition-all"
                >
                  <div className="bg-secondary/50 relative aspect-square overflow-hidden">
                    {nft.image ? (
                      <NftImage src={nft.image} alt={nft.name} />
                    ) : (
                      <div className="text-neutral-content/30 flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-12 w-12" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold">{nft.name}</p>
                    <p className="text-neutral-content text-xs">
                      {nft.amount > 1 ? `Supply: ${nft.amount}` : nft.symbol}
                    </p>
                    {canPropose && (
                      <Button
                        label="Send"
                        variant="ghost"
                        size="xs"
                        className="mt-2 w-full"
                        onClick={() => handleSendNFT(nft)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>

      {showSend && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-modal-title"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => {
              setShowSend(false);
              setSendToken(null);
              setSendRecipient("");
              setSendAmount("");
              setRecipientError("");
            }}
          />
          <div className="bg-base-100 border-border relative w-full max-w-md space-y-4 rounded-2xl border p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 id="send-modal-title" className="text-lg font-bold">
                {t("Send Assets")}
              </h3>

              <Button
                label={<X className="size-4" />}
                size="xs"
                aria-label="Close modal"
                onClick={closeSendModal}
                className="btn-square"
              />
            </div>
            <div>
              <label className="text-neutral-content mb-1 block text-sm font-medium tracking-wider">
                {t("Token")}
              </label>
              <TokenPicker token={sendToken} onClick={() => setSendTokenSelector(true)} />
              {sendToken && (
                <p className="text-neutral-content mt-1 text-xs">
                  {t("Available")}{" "}
                  <span className="text-base-content font-mono font-medium">
                    {sendAvailable.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                  {sendLockedUi > 0 && (
                    <span className="text-warning ml-1">
                      ({sendLockedUi.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
                      locked)
                    </span>
                  )}
                </p>
              )}
            </div>
            <div>
              <Input
                label="Recipient Address"
                placeholder="Enter Solana wallet address"
                value={sendRecipient}
                onChange={(e: any) => {
                  const val = e.target.value;
                  setSendRecipient(val);
                  if (val.trim()) {
                    try {
                      new PublicKey(val.trim());
                      setRecipientError("");
                    } catch {
                      setRecipientError("Invalid Solana address");
                    }
                  } else {
                    setRecipientError("");
                  }
                }}
                maxLength={44}
                required
              />
              {recipientError && (
                <p className="text-error mt-1 flex items-center gap-1 text-xs font-medium">
                  <XMarkIcon className="h-3.5 w-3.5" />
                  {recipientError}
                </p>
              )}
            </div>

            <div>
              <Input
                label="Amount"
                type="number"
                placeholder="0.00"
                value={sendAmount}
                onChange={(e: any) => setSendAmount(e.target.value)}
                required
                endIcon={
                  sendToken && (
                    <button
                      className="text-primary text-xs font-semibold hover:underline"
                      onClick={() => setSendAmount(String(sendAvailable))}
                    >
                      {t("MAX")}
                    </button>
                  )
                }
              />
            </div>
            {statusMsg && (
              <div className="text-primary flex items-center gap-2 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {statusMsg}
              </div>
            )}
            {txHook.isError && txHook.error && <p className="text-error text-xs">{txHook.error}</p>}
            <p className="text-neutral-content text-xs">
              {t("This will create a proposal requiring")} {threshold} {t("approval")}
              {threshold > 1 ? "s" : ""}.
            </p>
            <div className="flex gap-3">
              <Button
                label="Cancel"
                variant="outline"
                fullWidth
                onClick={closeSendModal}
                className="flex-1"
              />
              <Button
                label={
                  txHook.isProcessing ? (
                    <>
                      <Loader2 className="size-4.5 animate-spin" />
                      {t("Creating")}
                    </>
                  ) : (
                    "Create Proposal"
                  )
                }
                variant="primary"
                fullWidth
                onClick={handleSend}
                disabled={
                  !sendToken ||
                  !sendRecipient ||
                  !sendAmount ||
                  parseFloat(sendAmount || "0") <= 0 ||
                  txHook.isProcessing
                }
                className="flex-1"
              />
            </div>
          </div>
        </div>
      )}

      {showDeposit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deposit-modal-title"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => {
              setShowDeposit(false);
              setCopied(false);
            }}
          />
          <div className="bg-base-100 border-border relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h3 id="deposit-modal-title" className="text-lg font-bold">
                {t("Deposit to Treasury")}
              </h3>

              <Button
                label={<X className="size-4" />}
                size="xs"
                aria-label="Close modal"
                onClick={() => {
                  setShowDeposit(false);
                  setCopied(false);
                }}
                className="btn-square"
              />
            </div>
            <div className="space-y-4 px-6 pb-6">
              <p className="text-neutral-content text-sm">
                {t(
                  "Send any Solana asset to the address below Deposits appear in the treasury immediately no approval needed"
                )}
              </p>
              <div className="flex justify-center">
                <div className="border-base-200 bg-base-100 rounded-2xl border p-4 shadow-sm">
                  <QRCode
                    value={teamAddress || ""}
                    size={200}
                    level="H"
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  />
                </div>
              </div>
              <div>
                <p className="text-neutral-content mb-1.5 text-xs font-medium">
                  {t("Treasury Address")}
                </p>
                <div className="bg-base-200/60 border-base-300 flex items-center gap-2 rounded-xl border p-3">
                  <span className="flex-1 font-mono text-xs break-all">{teamAddress}</span>

                  <Button
                    label={copied ? <Check size={14} /> : <Copy size={14} />}
                    variant="ghost"
                    size="xs"
                    className={`btn-square ${copied ? "bg-success/10 text-success" : "hover:bg-primary/10 text-neutral-content hover:text-primary"}`}
                    onClick={() => {
                      navigator.clipboard.writeText(teamAddress);
                      setCopied(true);
                      toast.success(t("Address copied"));
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 py-2">
                {[
                  {
                    label: "SOL",
                    img: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
                  },
                  {
                    label: "USDC",
                    img: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
                  },
                  { label: "SPL Tokens", img: null },
                  { label: "NFTs", img: null },
                ].map((a) => (
                  <div key={a.label} className="flex flex-col items-center gap-1">
                    {a.img ? (
                      <Image
                        src={a.img}
                        alt={a.label}
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-full"
                      />
                    ) : (
                      <div className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold">
                        {a.label[0]}
                      </div>
                    )}
                    <span className="text-neutral-content text-xs">{a.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <TokenSelectorModal
        isOpen={sendTokenSelector}
        onClose={() => setSendTokenSelector(false)}
        onSelect={(t) => {
          setSendToken(t);
          setSendTokenSelector(false);
        }}
        selectedMint={sendToken?.mint}
        title="Select token to send"
        balances={balances}
      />
    </div>
  );
}
