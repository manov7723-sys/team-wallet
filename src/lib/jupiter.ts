/**
 * Jupiter Swap API v2 — Client Library
 *
 * All external API calls are proxied through internal /api/v1/trade/* routes
 * so that API keys stay server-side. Types and pure utility functions remain
 * client-side.
 */

import { fetchWithAuth } from "./fetchWithAuth";

export interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
  usdPrice: number;
}

let tokenCache: JupiterToken[] | null = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_TTL = 10 * 60 * 1000;

export async function getJupiterTokenList(): Promise<JupiterToken[]> {
  if (tokenCache && Date.now() - tokenCacheTime < TOKEN_CACHE_TTL) return tokenCache;

  const res = await fetchWithAuth("/api/v1/trade/tokens");
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || "Token list failed");

  const raw: any[] = json.data;
  const seen = new Set<string>();
  tokenCache = [];
  for (const t of raw) {
    const addr = t.id || t.address;
    if (!addr || !t.symbol || !t.name || seen.has(addr)) continue;
    seen.add(addr);
    tokenCache.push({
      address: addr,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals ?? 0,
      logoURI: t.icon || t.logoURI || null,
      usdPrice: t.usdPrice || 0,
    });
  }
  tokenCacheTime = Date.now();
  return tokenCache;
}

export function buildTokenMap(tokens: JupiterToken[]): Map<string, JupiterToken> {
  const map = new Map<string, JupiterToken>();
  for (const t of tokens) map.set(t.address, t);
  return map;
}

export const SOL_MINT = "So11111111111111111111111111111111111111112";

const STABLECOIN_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "USDSwr9ApdHk5bvJKMjzff41FfuE8YqnhuoR7pKKmHR",
]);

export function sortHoldings<T extends { mint: string; usdValue: number }>(holdings: T[]): T[] {
  return holdings.sort((a, b) => {
    if (a.mint === SOL_MINT) return -1;
    if (b.mint === SOL_MINT) return 1;
    const aS = STABLECOIN_MINTS.has(a.mint);
    const bS = STABLECOIN_MINTS.has(b.mint);
    if (aS && !bS) return -1;
    if (!aS && bS) return 1;
    return b.usdValue - a.usdValue;
  });
}

export interface SwapOrder {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  inUsdValue: number;
  outUsdValue: number;
  priceImpact: number;
  otherAmountThreshold: string;
  slippageBps: number;
  routePlan: {
    swapInfo: {
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
    };
    percent: number;
  }[];
  transaction?: string | null;
  requestId?: string;
  lastValidBlockHeight?: string;
  errorCode?: number;
  errorMessage?: string;
}

/**
 * Get a swap quote. If taker is omitted, returns quote only (no transaction).
 * If taker is provided, returns quote + base64 transaction.
 */
export async function getSwapOrder(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  taker?: string;
}): Promise<SwapOrder> {
  const { inputMint, outputMint, amount, slippageBps, taker } = params;
  const url = new URL("/api/v1/trade/quote", window.location.origin);
  url.searchParams.set("inputMint", inputMint);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", amount);
  if (slippageBps !== undefined) url.searchParams.set("slippageBps", String(slippageBps));
  if (taker) url.searchParams.set("taker", taker);

  const res = await fetchWithAuth(url.toString());
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Quote failed (${res.status})`);
  }
  return json.data;
}

export interface SwapInstruction {
  programId: string;
  accounts: { pubkey: string; isWritable: boolean; isSigner: boolean }[];
  data: string;
}

export interface SwapBuild {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  routePlan: any[];
  computeBudgetInstructions: SwapInstruction[];
  setupInstructions: SwapInstruction[];
  swapInstruction: SwapInstruction;
  cleanupInstruction?: SwapInstruction;
  otherInstructions: SwapInstruction[];
  addressesByLookupTableAddress?: Record<string, string[]>;
}

/**
 * Get raw swap instructions for building custom transactions.
 * Used at proposal execution time — taker is the team PDA.
 */
export async function getSwapBuild(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  taker: string;
  slippageBps?: number;
  maxAccounts?: number;
}): Promise<SwapBuild> {
  const { inputMint, outputMint, amount, taker, slippageBps, maxAccounts } = params;
  const url = new URL("/api/v1/trade/build", window.location.origin);
  url.searchParams.set("inputMint", inputMint);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", amount);
  url.searchParams.set("taker", taker);
  if (slippageBps !== undefined) url.searchParams.set("slippageBps", String(slippageBps));
  if (maxAccounts !== undefined) url.searchParams.set("maxAccounts", String(maxAccounts));

  const res = await fetchWithAuth(url.toString());
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Build failed (${res.status})`);
  }
  return json.data;
}

export interface SwapResult {
  status: "Success" | "Failed";
  signature: string;
  slot?: string;
  error?: string;
  code?: number;
  inputAmountResult?: string;
  outputAmountResult?: string;
}

/**
 * Submit a signed transaction to Jupiter for managed landing.
 * Gets better block inclusion than standard RPC sendTransaction.
 */
export async function executeSwap(params: {
  signedTransaction: string;
  requestId: string;
  lastValidBlockHeight?: string;
}): Promise<SwapResult> {
  const res = await fetchWithAuth("/api/v1/trade/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Execute failed (${res.status})`);
  }
  return json.data;
}

export async function getTokenPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};

  const res = await fetchWithAuth(`/api/v1/trade/prices?ids=${mints.join(",")}`);
  const json = await res.json();
  if (!res.ok || !json.success) return {};
  return json.data;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

export async function getPriceHistory(
  mint: string,
  period: "24h" | "7d" | "30d"
): Promise<PricePoint[]> {
  const res = await fetchWithAuth(`/api/v1/trade/history?mint=${mint}&period=${period}`);
  const json = await res.json();
  if (!res.ok || !json.success) return [];
  return json.data;
}
