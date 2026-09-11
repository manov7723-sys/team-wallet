/**
 * @module Hooks Barrel Export
 *
 * Single import point for all custom React hooks and their shared types.
 * Re-exports on-chain hooks, API hooks, trade hooks, and upload hooks
 * so consumers can import from "@/src/hooks" without deep file paths.
 */

export { useTeamBalance } from "./useTeamBalance";
export { useTeamOnChain } from "./useTeamOnChain";
export { useTransaction, type TxOptions, type TxResult, type TxStatus } from "./useTransaction";
export {
  usePendingProposals,
  usePendingVoteCount,
  useInvalidateProposals,
  type OnChainProposal,
} from "./usePendingProposals";
export { useAllProposals, useInvalidateAllProposals } from "./useAllProposals";

export { useApi, queryKeys } from "./useApiCore";
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
} from "./useApiCore";

export { useTeamAccess, useInvalidateTeamAccess, useProfile } from "./useUserHooks";

export {
  useTeamDb,
  useCreateTeam,
  useUpdateTeam,
  useAddTeamMember,
  useSyncMemberRole,
} from "./useTeamHooks";

export { useProposalLogs, useSaveProposalLog } from "./useProposalLogHooks";

export {
  useTokens,
  useSaveToken,
  useTeamTokenBalances,
  type TokenBalance,
  type TokenBalanceMap,
} from "./useTokenHooks";

export {
  usePrograms,
  useSaveProgram,
  useAddUpgradeLog,
  useRemoveProgram,
  useProgramOnChain,
  type ProgramOnChain,
} from "./useProgramHooks";

export { useUpload } from "./useUploadHook";

export {
  useJupiterTokenList,
  useSwapQuote,
  useTokenPrices,
  usePriceHistory,
  useSwapHistory,
  type SwapRecord,
} from "./useTradeHooks";
