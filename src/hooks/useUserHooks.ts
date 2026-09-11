import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/src/providers/AuthProvider";
import { useApi, queryKeys } from "./useApiCore";
import type { TeamAccessData, UserProfile, UpdateProfileInput } from "@/src/lib/api";
/**
 * Hook to fetch the current user's team access information.
 * Requires the user to be authenticated.
 */
export function useTeamAccess() {
  const api = useApi();
  const { isAuthenticated } = useAuth();

  return useQuery<TeamAccessData>({
    queryKey: queryKeys.teamAccess,
    queryFn: () => api.users.getTeamAccess(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}
/**
 * Hook to invalidate the cached team access data.
 *
 * Use this after changes that may affect team access, e.g., updating roles or membership.
 */
export function useInvalidateTeamAccess() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.teamAccess });
}

/**
 * Requires the user to be authenticated.
 *
 * @returns An object with the following properties:
 * - `profile` - `UserProfile` data (current user's profile)
 * - `isLoading` - true while fetching profile
 * - `error` - error object if fetching failed
 * - `updateProfile` - function to update the profile (`mutate` from React Query)
 * - `isUpdating` - true while profile update mutation is in progress.
 */
export function useProfile() {
  const api = useApi();
  const { isAuthenticated, updateUser } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<UserProfile>({
    queryKey: queryKeys.profile,
    queryFn: () => api.users.getProfile(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => api.users.updateProfile(input),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.profile, data);
      updateUser(data);
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "team" });
    },
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateProfile: mutation.mutate,
    isUpdating: mutation.isPending,
  };
}
