/**
 * Core API client hook + query keys.
 * Domain-specific hooks live in their own files.
 */

import { useMemo } from "react";
import { useAuth } from "@/src/providers/AuthProvider";
import { createApiClient, type ApiClient } from "@/src/lib/api";

export const queryKeys = {
  teamAccess: ["teamAccess"] as const,
  profile: ["profile"] as const,
  team: (address: string) => ["team", address] as const,
  proposalLogs: (teamWallet: string) => ["proposalLogs", teamWallet] as const,
  tokens: (teamWallet: string) => ["tokens", teamWallet] as const,
  programs: (teamWallet: string) => ["programs", teamWallet] as const,
};

/** Returns a typed, memoized API client bound to the current auth session. */
export function useApi(): ApiClient {
  const { authFetch } = useAuth();
  return useMemo(() => createApiClient(authFetch), [authFetch]);
}

export type {
  TeamAccess,
  TeamAccessData,
  UserProfile,
  TeamData,
  TeamMember,
  ProposalLog,
  TokenData,
  TokenExtensions,
  ProgramData,
  UpgradeLogData,
  CreateTeamInput,
  UpdateTeamInput,
  AddMemberInput,
  SyncMemberRoleInput,
  CreateProposalLogInput,
  CreateTokenInput,
  CreateProgramInput,
  AddUpgradeLogInput,
  UpdateProfileInput,
} from "@/src/lib/api";
