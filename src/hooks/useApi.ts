/**
 * @file Compatibility layer for hooks and types.
 *
 * This file re-exports all hooks and types from their new domain-specific modules,
 * allowing existing imports like `from "@/src/hooks/useApi"` to continue working
 * without refactoring code across the app.
 *
 * It includes:
 * - API hooks (`useApi`, `queryKeys`)
 * - User and team management hooks (`useTeamAccess`, `useProfile`, `useCreateTeam`, etc.)
 * - Proposal and token hooks (`useProposalLogs`, `useSaveToken`, `useManagedTokens`, etc.)
 * - Program hooks (`usePrograms`, `useSaveProgram`, `useAddUpgradeLog`, etc.)
 * - Upload hook (`useUpload`)
 *
 * Also re-exports all relevant TypeScript types for strong typing across the app.
 */
export { useApi, queryKeys } from "./useApiCore";
export { useTeamAccess, useInvalidateTeamAccess, useProfile } from "./useUserHooks";
export { useTeamDb, useCreateTeam, useUpdateTeam } from "./useTeamHooks";
export { useProposalLogs, useSaveProposalLog } from "./useProposalLogHooks";
export {
  useTokens,
  useSaveToken,
  useTeamTokenBalances,
  useProposalMintInfos,
} from "./useTokenHooks";
export {
  usePrograms,
  useSaveProgram,
  useAddUpgradeLog,
  useRemoveProgram,
  useProgramOnChain,
} from "./useProgramHooks";
export { useUpload } from "./useUploadHook";

export {
  useTokens as useManagedTokens,
  useSaveToken as useSaveManagedToken,
} from "./useTokenHooks";

export type {
  TeamAccess,
  TeamAccessData,
  UserProfile,
  TeamData,
  TeamMember,
  ProposalLog,
  TokenData,
  TokenData as ManagedTokenData,
  TokenExtensions,
  ProgramData,
  UpgradeLogData,
  CreateTeamInput,
  UpdateTeamInput,
  CreateProposalLogInput,
  CreateTokenInput,
  CreateTokenInput as CreateManagedTokenInput,
  CreateProgramInput,
  AddUpgradeLogInput,
  UpdateProfileInput,
} from "./useApiCore";
