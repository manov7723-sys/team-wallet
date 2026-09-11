import { useQuery } from "@tanstack/react-query";
import {
  getJupiterTokenList,
  getSwapOrder,
  getTokenPrices,
  getPriceHistory,
  type JupiterToken,
  type SwapOrder,
  type PricePoint,
} from "@/src/lib/jupiter";
import { useAllProposals } from "./useAllProposals";

export function useJupiterTokenList() {
  return useQuery<JupiterToken[]>({
    queryKey: ["jupiterTokenList"],
    queryFn: () => getJupiterTokenList(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get a swap quote via /swap/v2/order (without taker = quote only).
 * Auto-refreshes every 15s.
 */
export function useSwapQuote(
  inputMint: string | null,
  outputMint: string | null,
  amount: string | null,
  slippageBps?: number
) {
  return useQuery<SwapOrder | null>({
    queryKey: ["swapQuote", inputMint, outputMint, amount, slippageBps],
    queryFn: async () => {
      if (!inputMint || !outputMint || !amount || amount === "0") return null;
      return getSwapOrder({ inputMint, outputMint, amount, slippageBps });
    },
    enabled: !!inputMint && !!outputMint && !!amount && amount !== "0",
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    retry: 1,
  });
}
/**
 * Fetch the latest on-chain token prices for a list of mint addresses.
 *
 * @param mints - Array of token mint addresses
 * @returns `UseQueryResult<Record<string, number>, unknown>` - mapping of mint -> price
 
 */
export function useTokenPrices(mints: string[]) {
  return useQuery<Record<string, number>>({
    queryKey: ["tokenPrices", mints.sort().join(",")],
    queryFn: () => getTokenPrices(mints),
    enabled: mints.length > 0,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
/**
 * Fetch historical price data for a token over a given period.
 *
 * @param mint - Token mint address
 * @param period - Period to fetch ("24h", "7d", or "30d")
 * @returns `UseQueryResult<PricePoint[], unknown>` - array of price points
 */
export function usePriceHistory(mint: string | null, period: "24h" | "7d" | "30d") {
  return useQuery<PricePoint[]>({
    queryKey: ["priceHistory", mint, period],
    queryFn: () => getPriceHistory(mint!, period),
    enabled: !!mint,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export interface SwapRecord {
  proposalKey: string;
  inputMint: string;
  outputMint: string;
  amountIn: number;
  minAmountOut: number;
  slippageBps: number;
  executedAt: number;
  status: string;
}

/**
 * Extract executed swap proposals as SwapRecords.
 *
 * @param teamWalletAddress - Team wallet to fetch proposals from
 * @returns Array of executed swap records sorted by execution time (descending)
 */
export function useSwapHistory(teamWalletAddress: string | null | undefined) {
  const { data: proposals } = useAllProposals(teamWalletAddress);
  if (!proposals) return [];
  return proposals
    .filter((p) => (p.action as any).swap && p.executed)
    .map((p) => {
      const a = (p.action as any).swap;
      return {
        proposalKey: p.publicKey,
        inputMint: a.inputMint,
        outputMint: a.outputMint,
        amountIn: a.amountIn,
        minAmountOut: a.minAmountOut,
        slippageBps: a.slippageBps,
        executedAt: p.createdAt,
        status: "executed",
      } as SwapRecord;
    })
    .sort((a, b) => b.executedAt - a.executedAt);
}
