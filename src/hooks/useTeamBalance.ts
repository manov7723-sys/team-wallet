/**
 * @module useTeamBalance
 * @description
 * React Query hook to fetch the SOL balance of a team wallet on the Solana blockchain.
 * Returns both the raw lamports and the equivalent SOL amount.
 */

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

export interface TeamBalance {
  lamports: number;
  sol: number;
}

export function useTeamBalance(teamWalletAddress: string | null | undefined) {
  const { connection } = useConnection();

  return useQuery<TeamBalance>({
    queryKey: ["teamBalance", teamWalletAddress],
    queryFn: async () => {
      if (!teamWalletAddress) return { lamports: 0, sol: 0 };
      const pda = new PublicKey(teamWalletAddress);
      const lamports = await connection.getBalance(pda);
      return { lamports, sol: lamports / LAMPORTS_PER_SOL };
    },
    enabled: !!teamWalletAddress,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}
