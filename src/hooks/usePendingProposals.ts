/**
 * @module usePendingProposals
 * @description
 * Hooks and utilities to fetch and manage on-chain pending proposals for a Solana team wallet.
 * - `usePendingProposals` fetches all active, unexecuted proposals for a team.
 * - `usePendingVoteCount` counts proposals the connected wallet hasn't voted on.
 * - `useInvalidateProposals` invalidates and refetches cached proposal data.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "@/src/lib/web3";
import { decodeProposal, type ProposalActionDecoded } from "@/src/lib/proposalDecoder";
import bs58 from "bs58";
import logger from "../lib/logger";

export interface OnChainProposal {
  publicKey: string;
  teamWallet: string;
  proposer: string;
  action: ProposalActionDecoded;
  votesFor: number;
  votesAgainst: number;
  votersVoted: number[];
  snapshotVoters: string[];
  snapshotThreshold: number;
  executed: boolean;
  cancelled: boolean;
  createdAt: number;
  expiresAt: number;
  approved: boolean;
  approvedAt: number;
  executionWindow: number;
  nonce: string;
}

const PROPOSAL_DISCRIMINATOR = Buffer.from([26, 94, 189, 187, 116, 136, 53, 33]);
/**
 * Fetch all active, unexecuted proposals for a team wallet from on-chain.
 *
 * @param connection - Solana connection object.
 * @param teamWalletAddress - Base58 string of the team wallet.
 * @returns Promise resolving to an array of `OnChainProposal`.
 */

async function fetchProposals(
  connection: any,
  teamWalletAddress: string
): Promise<OnChainProposal[]> {
  const teamPDA = new PublicKey(teamWalletAddress);

  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    commitment: "confirmed",
    filters: [
      { memcmp: { offset: 0, bytes: bs58.encode(PROPOSAL_DISCRIMINATOR) } },
      { memcmp: { offset: 8, bytes: teamPDA.toBase58() } },
    ],
  });

  const now = Math.floor(Date.now() / 1000);
  const proposals: OnChainProposal[] = [];

  for (const { pubkey, account } of accounts) {
    try {
      const decoded = decodeProposal(account.data);

      const proposal: OnChainProposal = {
        publicKey: pubkey.toBase58(),
        teamWallet: decoded.teamWallet,
        proposer: decoded.proposer,
        action: decoded.action,
        votesFor: decoded.votesFor,
        votesAgainst: decoded.votesAgainst,
        votersVoted: decoded.votersVoted,
        snapshotVoters: decoded.snapshotVoters,
        snapshotThreshold: decoded.snapshotThreshold,
        executed: decoded.executed,
        cancelled: decoded.cancelled,
        createdAt: decoded.createdAt,
        expiresAt: decoded.expiresAt,
        approved: decoded.approved,
        approvedAt: decoded.approvedAt,
        executionWindow: decoded.executionWindow,
        nonce: decoded.nonce,
      };

      if (!proposal.executed && !proposal.cancelled && proposal.expiresAt > now) {
        // Skip mathematically impossible proposals (too many rejects to ever pass)
        if (
          proposal.snapshotThreshold > 0 &&
          proposal.votesAgainst > proposal.snapshotVoters.length - proposal.snapshotThreshold
        ) {
          continue;
        }
        proposals.push(proposal);
      }
    } catch (err: any) {
      logger.warn("[Proposals] Failed to decode:", err?.message);
    }
  }
  return proposals.sort((a, b) => b.createdAt - a.createdAt);
}
/**
 * React hook to fetch pending (active and unexecuted) proposals for a team wallet.
 *
 * @param teamWalletAddress - Team wallet address to fetch proposals for.
 * @returns `UseQueryResult<OnChainProposal[], unknown>` from react-query containing pending proposals.
 */
export function usePendingProposals(teamWalletAddress: string | null | undefined) {
  const { connection } = useConnection();
  const { wallet } = useWallet();

  return useQuery<OnChainProposal[]>({
    queryKey: ["pendingProposals", teamWalletAddress],
    queryFn: async () => {
      if (!teamWalletAddress || !wallet) return [];
      try {
        return await fetchProposals(connection, teamWalletAddress);
      } catch (err) {
        logger.warn("Error on usePendingProposals", err);
        return [];
      }
    },
    enabled: !!teamWalletAddress && !!wallet,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}

/** Count proposals the current user hasn't voted on */
export function usePendingVoteCount(teamWalletAddress: string | null | undefined) {
  const { publicKey } = useWallet();
  const { data: proposals } = usePendingProposals(teamWalletAddress);
  if (!proposals || !publicKey) return 0;

  const walletAddr = publicKey.toBase58();
  return proposals.filter((p) => {
    const myIndex = p.snapshotVoters.indexOf(walletAddr);
    if (myIndex === -1) return false;
    return !p.votersVoted.includes(myIndex);
  }).length;
}

/** Invalidate + delayed refetch */
export function useInvalidateProposals() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["pendingProposals"] });
    await new Promise((r) => setTimeout(r, 2000));
    await queryClient.refetchQueries({ queryKey: ["pendingProposals"] });
  };
}
