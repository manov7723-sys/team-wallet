/**
 * Proposal and time utility functions.
 *
 * - `getActionLabel(action)` → Returns a human-readable label for a decoded proposal action.
 * - `getActionType(action)` → Returns the type key of a decoded action (e.g., "transferSol", "swap").
 * - `getActionCategory(action)` → Categorizes an action into one of: "transfer", "member", "governance", "program", "token", "swap".
 * - `timeAgo(timestamp)` → Returns a relative "time ago" string for a UNIX timestamp.
 * - `timeLeft(timestamp)` → Returns a human-readable remaining time until a UNIX timestamp, or "Expired".
 * - `formatDate(timestamp)` → Returns a formatted date string (MM/DD/YYYY, HH:MM) for a UNIX timestamp.
 * - `short(addr)` (internal) → Shortens a blockchain address to the first 4 and last 4 characters.
 *
 * These functions are intended for UI display of proposals, actions, and timestamps in a team wallet dApp.
 */
import type { ProposalActionDecoded } from "@/src/lib/proposalDecoder";

const short = (addr: string) => (addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : "?");

export function getActionLabel(action: ProposalActionDecoded): string {
  const a = action as any;
  if (a.transferSol)
    return `Transfer ${(a.transferSol.amount / 1e9).toFixed(4)} SOL to ${short(a.transferSol.recipient)}`;
  if (a.transferToken) return `Transfer tokens to ${short(a.transferToken.recipient)}`;
  if (a.swap) return `Swap tokens (${short(a.swap.inputMint)} → ${short(a.swap.outputMint)})`;
  if (a.changeThreshold) return `Change threshold to ${a.changeThreshold.newThreshold}`;
  if (a.addVoter) return `Add voter: ${short(a.addVoter.voter)}`;
  if (a.removeVoter) return `Remove voter: ${short(a.removeVoter.voter)}`;
  if (a.addContributor) return `Add contributor: ${short(a.addContributor.contributor)}`;
  if (a.removeContributor) return `Remove contributor: ${short(a.removeContributor.contributor)}`;
  if (a.upgradeProgram) return `Upgrade program: ${short(a.upgradeProgram.programId)}`;
  if (a.deleteProgram) return `Close program: ${short(a.deleteProgram.programId)}`;
  if (a.tokenMint) return `Mint tokens: ${short(a.tokenMint.mint)}`;
  if (a.tokenBurn) return `Burn tokens: ${short(a.tokenBurn.mint)}`;
  if (a.tokenFreeze) return `Freeze account: ${short(a.tokenFreeze.account)}`;
  if (a.tokenThaw) return `Thaw account: ${short(a.tokenThaw.account)}`;
  if (a.tokenSetMintAuthority) return `Set mint authority: ${short(a.tokenSetMintAuthority.mint)}`;
  if (a.tokenSetFreezeAuthority)
    return `Set freeze authority: ${short(a.tokenSetFreezeAuthority.mint)}`;
  if (a.tokenUpdateMetadata) return `Update metadata: ${a.tokenUpdateMetadata.name}`;
  return "Unknown action";
}

export function getActionType(action: ProposalActionDecoded): string {
  return Object.keys(action)[0] || "unknown";
}

export function getActionCategory(
  action: ProposalActionDecoded
): "transfer" | "member" | "governance" | "program" | "token" | "swap" {
  const t = getActionType(action);
  if (t === "transferSol" || t === "transferToken") return "transfer";
  if (
    t === "addVoter" ||
    t === "removeVoter" ||
    t === "addContributor" ||
    t === "removeContributor"
  )
    return "member";
  if (t === "changeThreshold") return "governance";
  if (t === "upgradeProgram" || t === "deleteProgram") return "program";
  if (t === "swap") return "swap";
  return "token";
}

export function timeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

export function timeLeft(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;
  if (diff <= 0) return "Expired";
  if (diff < 3600) return `${Math.floor(diff / 60)}m left`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h left`;
  return `${Math.floor(diff / 86400)}d left`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
