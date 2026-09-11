import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/src/providers/AuthProvider";
import { useApi, queryKeys } from "./useApiCore";
import type { ProposalLog, CreateProposalLogInput } from "@/src/lib/api";
/**
 * Hook to fetch all proposal logs for a given team.
 *
 * @param teamWalletAddress - Base58 string of the team wallet
 * @returns `UseQueryResult<ProposalLog[], unknown>` from react-query
 */

export function useProposalLogs(teamWalletAddress: string | null | undefined) {
  const api = useApi();
  const { isAuthenticated } = useAuth();

  return useQuery<ProposalLog[]>({
    queryKey: queryKeys.proposalLogs(teamWalletAddress || ""),
    queryFn: () => api.proposals.list(teamWalletAddress!),
    enabled: isAuthenticated && !!teamWalletAddress,
    staleTime: 60 * 1000,
  });
}
/**
 * Hook to fetch all proposal logs for a given team.
 *
 * @param teamWalletAddress - Base58 string of the team wallet
 * @returns `UseQueryResult<ProposalLog[], unknown>` from react-query
 */

export function useSaveProposalLog() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProposalLogInput) => api.proposals.save(input),
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.proposalLogs(input.teamWalletAddress) });
    },
  });
}
