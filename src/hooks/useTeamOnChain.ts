import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { fetchTeamWallet } from "@/src/lib/web3";
import logger from "../lib/logger";

export interface OnChainTeamData {
  owner: string;
  name: string;
  voters: string[];
  contributors: string[];
  voterCount: number;
  voteThreshold: number;
  proposalCount: number;
  bump: number;
}
/** A read-only fallback wallet for querying without a connected wallet */

const READ_ONLY_WALLET = {
  publicKey: Keypair.generate().publicKey,
  signTransaction: async (tx: any) => tx,
  signAllTransactions: async (txs: any[]) => txs,
};
/**
 * React Query hook to fetch a team's on-chain data.
 *
 * @param teamWalletAddress - Base58 string of the team's wallet address
 * @returns `UseQueryResult<OnChainTeamData | null, unknown>` from react-query
 *
 */
export function useTeamOnChain(teamWalletAddress: string | null | undefined) {
  const { connection } = useConnection();
  const { wallet } = useWallet();

  return useQuery<OnChainTeamData | null>({
    queryKey: ["teamOnChain", teamWalletAddress],
    queryFn: async () => {
      if (!teamWalletAddress) return null;

      const walletAdapter = wallet?.adapter ?? READ_ONLY_WALLET;
      const provider = new AnchorProvider(connection, walletAdapter as any, {
        commitment: "confirmed",
      });
      const pda = new PublicKey(teamWalletAddress);

      try {
        const data = await fetchTeamWallet(provider, pda);
        return {
          owner: data.owner.toBase58(),
          name: data.name,
          voters: data.voters.map((v: PublicKey) => v.toBase58()),
          contributors: data.contributors.map((c: PublicKey) => c.toBase58()),
          voterCount: data.voterCount,
          voteThreshold: data.voteThreshold,
          proposalCount: Number(data.proposalCount),
          bump: data.bump,
        };
      } catch (err) {
        logger.error("Error on useTeamOnChain", err);
        return null;
      }
    },
    enabled: !!teamWalletAddress,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
