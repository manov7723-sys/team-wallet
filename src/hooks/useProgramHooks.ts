import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useAuth } from "@/src/providers/AuthProvider";
import { useApi, queryKeys } from "./useApiCore";
import type { ProgramData, CreateProgramInput, AddUpgradeLogInput } from "@/src/lib/api";

const BPF_LOADER_UPGRADEABLE = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

export interface ProgramOnChain {
  authority: string | null;
  dataSize: number;
  balance: number;
  lastDeploySlot: number;
  isUpgradeable: boolean;
}
/**
 * React hook to fetch all programs associated with a team from off-chain API.
 *
 * @param teamWalletAddress - Base58 string of the team wallet.
 * @returns `UseQueryResult<ProgramData[], unknown>` from react-query
 */
export function usePrograms(teamWalletAddress: string | null | undefined) {
  const api = useApi();
  const { isAuthenticated } = useAuth();

  return useQuery<ProgramData[]>({
    queryKey: queryKeys.programs(teamWalletAddress || ""),
    queryFn: () => api.programs.list(teamWalletAddress!),
    enabled: isAuthenticated && !!teamWalletAddress,
    staleTime: 60 * 1000,
  });
}
/**
 * React hook to fetch all programs associated with a team from off-chain API.
 *
 * @param teamWalletAddress - Base58 string of the team wallet.
 * @returns `UseQueryResult<ProgramData[], unknown>` from react-query
 */
export function useSaveProgram() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProgramInput) => api.programs.create(input),
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.programs(input.teamWalletAddress) });
    },
  });
}
/**
 * Hook to add an upgrade log to a program via the API.
 * Invalidates program queries on success.
 *
 * @returns Mutation object from react-query.
 */
export function useAddUpgradeLog() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: AddUpgradeLogInput) => api.programs.addUpgradeLog(input),
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.programs(input.teamWalletAddress) });
    },
  });
}
/**
 * Hook to add an upgrade log to a program via the API.
 * Invalidates program queries on success.
 *
 * @returns Mutation object from react-query.
 */
export function useRemoveProgram() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      programId,
      teamWalletAddress,
    }: {
      programId: string;
      teamWalletAddress: string;
    }) => api.programs.remove(programId, teamWalletAddress),
    onSuccess: (_, { teamWalletAddress }) => {
      qc.invalidateQueries({ queryKey: queryKeys.programs(teamWalletAddress) });
    },
  });
}

/**
 * Fetch on-chain program info: authority, data size, balance, deploy slot.
 * Parses the BPF Upgradeable Loader programdata account.
 */
export function useProgramOnChain(programId: string | null | undefined) {
  const { connection } = useConnection();

  return useQuery<ProgramOnChain | null>({
    queryKey: ["programOnChain", programId],
    queryFn: async () => {
      if (!programId) return null;
      const pk = new PublicKey(programId);

      const accountInfo = await connection.getAccountInfo(pk);
      if (!accountInfo) return null;

      if (!accountInfo.owner.equals(BPF_LOADER_UPGRADEABLE)) {
        return {
          authority: null,
          dataSize: accountInfo.data.length,
          balance: accountInfo.lamports / 1e9,
          lastDeploySlot: 0,
          isUpgradeable: false,
        };
      }

      const programdataAddress = new PublicKey(accountInfo.data.slice(4, 36));
      const programdataInfo = await connection.getAccountInfo(programdataAddress);

      if (!programdataInfo) {
        return {
          authority: null,
          dataSize: 0,
          balance: accountInfo.lamports / 1e9,
          lastDeploySlot: 0,
          isUpgradeable: false,
        };
      }
      const data = programdataInfo.data;
      const slot = Number(data.readBigUInt64LE(4));
      const hasAuthority = data[12] === 1;
      const authority = hasAuthority ? new PublicKey(data.slice(13, 45)).toBase58() : null;
      const dataSize = programdataInfo.data.length;
      const balance = (accountInfo.lamports + programdataInfo.lamports) / 1e9;

      return {
        authority,
        dataSize,
        balance,
        lastDeploySlot: slot,
        isUpgradeable: hasAuthority,
      };
    },
    enabled: !!programId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
