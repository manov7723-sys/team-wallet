import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useAuth } from "@/src/providers/AuthProvider";
import { useApi, queryKeys } from "./useApiCore";
import { SOL_MINT } from "@/src/lib/jupiter";
import type { TokenData, CreateTokenInput } from "@/src/lib/api";
/**
 * Fetch all tokens for a given team wallet.
 *
 * @param teamWalletAddress - Base58 string of the team's wallet address
 * @returns `UseQueryResult<TokenData[], unknown>` from react-query
 */

export function useTokens(teamWalletAddress: string | null | undefined) {
  const api = useApi();
  const { isAuthenticated } = useAuth();

  return useQuery<TokenData[]>({
    queryKey: queryKeys.tokens(teamWalletAddress || ""),
    queryFn: () => api.tokens.list(teamWalletAddress!),
    enabled: isAuthenticated && !!teamWalletAddress,
    staleTime: 60 * 1000,
  });
}
/**
 * Mutation hook to create/save a new token for a team.
 *
 * @returns `UseMutationResult<TokenData, unknown, CreateTokenInput, unknown>` from react-query
 */
export function useSaveToken() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTokenInput) => api.tokens.create(input),
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.tokens(input.teamWalletAddress) });
    },
  });
}

/** Map of mintAddress → { raw, ui } balances for all tokens the team holds */
export interface TokenBalance {
  raw: string;
  ui: number;
  decimals: number;
  /** Rent-exempt reserve in UI units — only set for native SOL on team PDA */
  rentReserve?: number;
}

export interface TokenBalanceMap {
  [mintAddress: string]: TokenBalance;
}

/**
 * Fetch all token balances for a team PDA:
 * - Native SOL balance (mapped to wrapped SOL mint)
 * - SPL Token accounts (USDC, USDT, JUP, BONK, etc.)
 * - Token-2022 accounts (team-created tokens)
 * - NFTs (decimals=0) — included for treasury NFT tab
 */
export function useTeamTokenBalances(teamWalletAddress: string | null | undefined) {
  const { connection } = useConnection();

  return useQuery<TokenBalanceMap>({
    queryKey: ["teamTokenBalances", teamWalletAddress],
    queryFn: async () => {
      if (!teamWalletAddress) return {};
      const teamPDA = new PublicKey(teamWalletAddress);
      const map: TokenBalanceMap = {};

      const parseAccounts = (accounts: any[]) => {
        for (const { account } of accounts) {
          const parsed = account.data.parsed?.info;
          if (!parsed?.mint) continue;
          const amount = parsed.tokenAmount?.amount || "0";
          const uiAmount = parsed.tokenAmount?.uiAmount || 0;
          const decimals = parsed.tokenAmount?.decimals ?? 0;
          if (parseInt(amount) <= 0) continue;
          map[parsed.mint] = { raw: amount, ui: uiAmount, decimals };
        }
      };

      try {
        const accountInfo = await connection.getAccountInfo(teamPDA);
        if (accountInfo) {
          const lamports = accountInfo.lamports;
          const rentLamports = await connection.getMinimumBalanceForRentExemption(
            accountInfo.data.length
          );
          map[SOL_MINT] = {
            raw: lamports.toString(),
            ui: lamports / LAMPORTS_PER_SOL,
            decimals: 9,
            rentReserve: rentLamports / LAMPORTS_PER_SOL,
          };
        }
      } catch {}

      try {
        const res = await connection.getParsedTokenAccountsByOwner(teamPDA, {
          programId: TOKEN_PROGRAM_ID,
        });
        parseAccounts(res.value);
      } catch {}

      try {
        const res = await connection.getParsedTokenAccountsByOwner(teamPDA, {
          programId: TOKEN_2022_PROGRAM_ID,
        });
        parseAccounts(res.value);
      } catch {}

      return map;
    },
    enabled: !!teamWalletAddress,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

/**
 * Given a list of mint addresses extracted from proposal actions, fetch their
 * decimals directly from the on-chain mint account.  This works without auth
 * and acts as a public fallback so guest viewers see correctly formatted amounts
 * even for mints the team no longer holds in their token accounts.
 */
export function useProposalMintInfos(mintAddresses: string[]) {
  const { connection } = useConnection();

  const key = [...new Set(mintAddresses)].sort().join(",");

  return useQuery<Map<string, { decimals: number }>>({
    queryKey: ["proposalMintInfos", key],
    queryFn: async () => {
      const result = new Map<string, { decimals: number }>();
      const unique = [...new Set(mintAddresses)].filter(Boolean);
      if (unique.length === 0) return result;

      const pubkeys = unique.map((m) => new PublicKey(m));
      try {
        const accounts = await connection.getMultipleAccountsInfo(pubkeys);
        for (let i = 0; i < pubkeys.length; i++) {
          const info = accounts[i];
          if (!info?.data || info.data.length < 45) continue;

          const decimals = info.data[44];
          result.set(unique[i], { decimals });
        }
      } catch {}
      return result;
    },
    enabled: mintAddresses.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
