/**
 * @fileoverview Hooks for fetching and managing DAO proposals on Solana.
 *
 * This module provides:
 * 1. `useAllProposals(teamWalletAddress)`: Fetches all proposals for a given team wallet
 *    and decodes them into structured `FullProposal` objects, including votes, proposer,
 *    timestamps, and computed status.
 *
 * 2. `useInvalidateAllProposals()`: Returns a function to invalidate and refetch all proposal
 *    queries in React Query, ensuring up-to-date on-chain data after changes.
 *
 * It uses:
 * - `@solana/web3.js` for Solana accounts and public keys
 * - `@solana/wallet-adapter-react` for connection
 * - `@tanstack/react-query` for caching and fetching
 * - `decodeProposal` to parse raw proposal data
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "@/src/lib/web3";
import { decodeProposal, type ProposalActionDecoded } from "@/src/lib/proposalDecoder";
import bs58 from "bs58";

export interface FullProposal {
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
  status: "pending" | "approved" | "executed" | "rejected" | "expired";
}

const PROPOSAL_DISCRIMINATOR = Buffer.from([26, 94, 189, 187, 116, 136, 53, 33]);

function computeStatus(p: {
  executed: boolean;
  cancelled: boolean;
  approved: boolean;
  expiresAt: number;
  votesAgainst: number;
  snapshotVoters: string[];
  snapshotThreshold: number;
}): FullProposal["status"] {
  const now = Math.floor(Date.now() / 1000);
  if (p.executed) return "executed";
  if (p.cancelled) return "rejected";
  if (!p.executed && !p.cancelled && p.expiresAt <= now) return "expired";
  // Mathematically impossible: too many reject votes to ever reach threshold.
  // e.g. 3 voters, threshold 3 → 1 reject makes max possible votesFor = 2 < 3.
  // Only applies to new proposals that have snapshotThreshold set.
  if (p.snapshotThreshold > 0 && p.votesAgainst > p.snapshotVoters.length - p.snapshotThreshold) {
    return "rejected";
  }
  if (p.approved && !p.executed && !p.cancelled) return "approved";
  return "pending";
}

export function useAllProposals(teamWalletAddress: string | null | undefined) {
  const { connection } = useConnection();

  return useQuery<FullProposal[]>({
    queryKey: ["allProposals", teamWalletAddress],
    queryFn: async () => {
      if (!teamWalletAddress) return [];

      const teamPDA = new PublicKey(teamWalletAddress);
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        commitment: "confirmed",
        filters: [
          { memcmp: { offset: 0, bytes: bs58.encode(PROPOSAL_DISCRIMINATOR) } },
          { memcmp: { offset: 8, bytes: teamPDA.toBase58() } },
        ],
      });

      const proposals: FullProposal[] = [];

      for (const { pubkey, account } of accounts) {
        try {
          const d = decodeProposal(account.data);
          proposals.push({
            publicKey: pubkey.toBase58(),
            teamWallet: d.teamWallet,
            proposer: d.proposer,
            action: d.action,
            votesFor: d.votesFor,
            votesAgainst: d.votesAgainst,
            votersVoted: d.votersVoted,
            snapshotVoters: d.snapshotVoters,
            snapshotThreshold: d.snapshotThreshold,
            executed: d.executed,
            cancelled: d.cancelled,
            createdAt: d.createdAt,
            expiresAt: d.expiresAt,
            approved: d.approved,
            approvedAt: d.approvedAt,
            executionWindow: d.executionWindow,
            nonce: d.nonce,
            status: computeStatus(d),
          });
        } catch {}
      }

      return proposals.sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !!teamWalletAddress,
    staleTime: 5 * 1000,
    refetchInterval: 5 * 1000,
  });
}

export function useInvalidateAllProposals() {
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries({ queryKey: ["allProposals"] });
    await qc.invalidateQueries({ queryKey: ["pendingProposals"] });
    await new Promise((r) => setTimeout(r, 2000));
    await qc.refetchQueries({ queryKey: ["allProposals"] });
    await qc.refetchQueries({ queryKey: ["pendingProposals"] });
  };
}
