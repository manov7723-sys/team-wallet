/**
 * Typed API Client
 *
 * Centralized API layer with:
 *   - Typed request/response for every endpoint
 *   - Automatic `{ success, data, error }` envelope parsing
 *   - `ApiError` for structured error handling
 *
 * Usage: const api = createApiClient(authFetch);
 *        const profile = await api.users.getProfile();
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const body: ApiEnvelope<T> = await res.json();
  if (!body.success || body.data === undefined) {
    throw new ApiError(body.error || `Request failed (${res.status})`, res.status);
  }
  return body.data;
}

export interface UserProfile {
  walletAddress: string;
  name?: string;
  avatar?: string;
  email?: string;
  bio?: string;
}

export type UpdateProfileInput = Partial<Pick<UserProfile, "name" | "avatar" | "email" | "bio">>;

export interface TeamAccess {
  teamWalletAddress: string;
  name: string;
  image?: string;
  threshold: number;
  memberCount: number;
  isOwner: boolean;
  isVoter: boolean;
  isContributor: boolean;
  isMember: boolean;
}

export interface TeamAccessData {
  wallet: string;
  hasTeams: boolean;
  teamCount: number;
  teams: TeamAccess[];
}

export interface TeamMember {
  key: string;
  name?: string;
  avatar?: string;
  isOwner: boolean;
  hasVoter: boolean;
  hasContributor: boolean;
  addedAt: string;
}

export interface TeamData {
  _id: string;
  teamWalletAddress: string;
  name: string;
  description?: string;
  image?: string;
  owner: string;
  members: TeamMember[];
  threshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamInput {
  teamWalletAddress: string;
  name: string;
  members: { key: string; name?: string }[];
  threshold: number;
  image?: string;
}

export interface UpdateTeamInput {
  image?: string;
  description?: string;
}

export interface AddMemberInput {
  key: string;
  name?: string;
  role: "voter" | "contributor";
}

export interface SyncMemberRoleInput {
  key: string;
  action: "addVoter" | "removeVoter" | "addContributor" | "removeContributor";
}

export interface ProposalLog {
  proposalKey: string;
  signature: string;
  executedBy: string;
  createdAt: string;
}

export interface CreateProposalLogInput {
  teamWalletAddress: string;
  proposalKey: string;
  signature: string;
}

export interface TokenExtensions {
  transferFee?: { bps: number };
  nonTransferable?: boolean;
  interestBearing?: { rate: number };
}

export interface TokenData {
  _id: string;
  mintAddress: string;
  teamWalletAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  tokenType: "fungible" | "nft";
  initialSupply: string;
  metadataUri: string;
  imageUrl: string;
  description?: string;
  extensions: TokenExtensions;
  createdBy: string;
  imported: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTokenInput {
  mintAddress: string;
  teamWalletAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  tokenType: "fungible" | "nft";
  initialSupply?: string;
  metadataUri: string;
  imageUrl?: string;
  description?: string;
  extensions?: TokenExtensions;
  imported?: boolean;
}

export interface UpgradeLogData {
  _id: string;
  bufferAddress: string;
  notes?: string;
  proposalKey?: string;
  signature?: string;
  proposedBy: string;
  executedAt?: string;
}

export interface ProgramData {
  _id: string;
  programId: string;
  teamWalletAddress: string;
  name: string;
  description?: string;
  addedBy: string;
  upgradeLogs: UpgradeLogData[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProgramInput {
  programId: string;
  teamWalletAddress: string;
  name: string;
  description?: string;
}

export interface AddUpgradeLogInput {
  programId: string;
  teamWalletAddress: string;
  upgradeLog: {
    bufferAddress: string;
    notes?: string;
    proposalKey?: string;
    signature?: string;
    executedAt?: string;
  };
}

export interface PresignInput {
  fileName: string;
  contentType: string;
  folder?: string;
}

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

export interface LocalUploadResult {
  url: string;
  fileName: string;
}

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

export function createApiClient(fetchFn: FetchFn) {
  /** JSON POST/PUT helper */
  function jsonRequest<T>(
    url: string,
    method: "POST" | "PUT" | "PATCH",
    body: unknown
  ): Promise<T> {
    return fetchFn(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((res) => parseResponse<T>(res));
  }

  return {
    users: {
      getProfile: (): Promise<UserProfile> =>
        fetchFn("/api/v1/users/me").then((res) => parseResponse<UserProfile>(res)),

      updateProfile: (input: UpdateProfileInput): Promise<UserProfile> =>
        jsonRequest<UserProfile>("/api/v1/users/me", "PUT", input),

      getTeamAccess: (): Promise<TeamAccessData> =>
        fetchFn("/api/v1/users/me/access").then((res) => parseResponse<TeamAccessData>(res)),
    },

    teams: {
      create: (input: CreateTeamInput): Promise<TeamData> =>
        jsonRequest<TeamData>("/api/v1/teams", "POST", input),

      get: (address: string): Promise<TeamData> =>
        fetchFn(`/api/v1/teams/${address}`).then((res) => parseResponse<TeamData>(res)),

      update: (address: string, input: UpdateTeamInput): Promise<TeamData> =>
        jsonRequest<TeamData>(`/api/v1/teams/${address}`, "PUT", input),

      addMember: (address: string, input: AddMemberInput): Promise<TeamData> =>
        jsonRequest<TeamData>(`/api/v1/teams/${address}/members`, "POST", input),

      syncMemberRole: (address: string, input: SyncMemberRoleInput): Promise<TeamData> =>
        jsonRequest<TeamData>(`/api/v1/teams/${address}/members`, "PATCH", input),
    },

    proposals: {
      list: (teamWalletAddress: string): Promise<ProposalLog[]> =>
        fetchFn(`/api/v1/proposals?team=${teamWalletAddress}`).then((res) =>
          parseResponse<ProposalLog[]>(res)
        ),

      save: (input: CreateProposalLogInput): Promise<ProposalLog> =>
        jsonRequest<ProposalLog>("/api/v1/proposals", "POST", input),
    },

    tokens: {
      list: (teamWalletAddress: string): Promise<TokenData[]> =>
        fetchFn(`/api/v1/tokens?team=${teamWalletAddress}`).then((res) =>
          parseResponse<TokenData[]>(res)
        ),

      create: (input: CreateTokenInput): Promise<TokenData> =>
        jsonRequest<TokenData>("/api/v1/tokens", "POST", input),
    },

    programs: {
      list: (teamWalletAddress: string): Promise<ProgramData[]> =>
        fetchFn(`/api/v1/programs?team=${teamWalletAddress}`).then((res) =>
          parseResponse<ProgramData[]>(res)
        ),

      create: (input: CreateProgramInput): Promise<ProgramData> =>
        jsonRequest<ProgramData>("/api/v1/programs", "POST", input),

      addUpgradeLog: (input: AddUpgradeLogInput): Promise<ProgramData> =>
        jsonRequest<ProgramData>("/api/v1/programs", "POST", input),

      remove: (programId: string, teamWalletAddress: string): Promise<void> =>
        fetchFn(`/api/v1/programs?id=${programId}&team=${teamWalletAddress}`, {
          method: "DELETE",
        }).then((res) => {
          parseResponse<void>(res);
        }),
    },

    upload: {
      presign: (input: PresignInput): Promise<PresignResult> =>
        jsonRequest<PresignResult>("/api/v1/upload/presign", "POST", input),

      local: async (file: File, folder: string): Promise<LocalUploadResult> => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);
        const res = await fetchFn("/api/v1/upload/local", { method: "POST", body: formData });
        return parseResponse<LocalUploadResult>(res);
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
