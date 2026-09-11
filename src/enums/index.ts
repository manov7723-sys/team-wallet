/**
 * UI Enums — lightweight, no backend dependencies
 */

export enum ProposalType {
  TREASURY = "treasury",
  TOKEN = "token",
  SWAP = "swap",
  THRESHOLD = "threshold",
  UPGRADE = "upgrade",
  DELETE = "delete",
}

export enum ProposalStatus {
  PENDING = "pending",
  APPROVED = "approved",
  EXECUTED = "executed",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

export enum AssetType {
  SOL = "SOL",
  SPL = "SPL",
  NFT = "NFT",
}
