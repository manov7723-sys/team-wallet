import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/src/providers/AuthProvider";
import { useApi, queryKeys } from "./useApiCore";
import { useInvalidateTeamAccess } from "./useUserHooks";
import type {
  TeamData,
  CreateTeamInput,
  UpdateTeamInput,
  AddMemberInput,
  SyncMemberRoleInput,
} from "@/src/lib/api";
/**
 * Hook to fetch a team's data from the API.
 *
 * @param teamWalletAddress - Base58 string of the team's wallet address
 * @returns `UseQueryResult<TeamData | null, unknown>` from react-query
 * ```
 */

export function useTeamDb(teamWalletAddress: string | null | undefined) {
  const api = useApi();
  const { isAuthenticated } = useAuth();

  return useQuery<TeamData | null>({
    queryKey: queryKeys.team(teamWalletAddress || ""),
    queryFn: async () => {
      if (!teamWalletAddress) return null;
      return api.teams.get(teamWalletAddress);
    },
    enabled: isAuthenticated && !!teamWalletAddress,
    staleTime: 60 * 1000,
  });
}
/**
 * Hook to create a new team.
 *
 * @returns `UseMutationResult<TeamData, unknown, CreateTeamInput>` from react-query
 *
 */

export function useCreateTeam() {
  const api = useApi();
  const invalidate = useInvalidateTeamAccess();

  return useMutation({
    mutationFn: (input: CreateTeamInput) => api.teams.create(input),
    onSuccess: () => invalidate(),
  });
}
/**
 * Hook to update an existing team's data.
 *
 * @returns `UseMutationResult<TeamData, unknown, { address: string; input: UpdateTeamInput }>` from react-query
 *

 */
export function useUpdateTeam() {
  const api = useApi();
  const qc = useQueryClient();
  const invalidateAccess = useInvalidateTeamAccess();

  return useMutation({
    mutationFn: ({ address, input }: { address: string; input: UpdateTeamInput }) =>
      api.teams.update(address, input),
    onSuccess: (data, { address }) => {
      qc.setQueryData(queryKeys.team(address), data);
      invalidateAccess();
    },
  });
}

export function useAddTeamMember() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ address, input }: { address: string; input: AddMemberInput }) =>
      api.teams.addMember(address, input),
    onSuccess: (data, { address }) => {
      qc.setQueryData(queryKeys.team(address), data);
    },
  });
}

export function useSyncMemberRole() {
  const api = useApi();
  const qc = useQueryClient();
  const invalidateAccess = useInvalidateTeamAccess();

  return useMutation({
    mutationFn: ({ address, input }: { address: string; input: SyncMemberRoleInput }) =>
      api.teams.syncMemberRole(address, input),
    onSuccess: (data, { address }) => {
      qc.setQueryData(queryKeys.team(address), data);
      invalidateAccess(); // Re-fetches isContributor/isVoter for sidebar + permissions
    },
  });
}
