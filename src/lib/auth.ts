/**
 * Utility functions for authentication and wallet verification:
 * - `generateAccessToken(payload)` / `generateRefreshToken(payload)` → create JWTs
 * - `verifyAccessToken(token)` / `verifyRefreshToken(token)` → validate JWTs
 * - `verifySignature(wallet, message, signature)` → verify Solana wallet signatures
 * - `generateNonce()` → produce a random nonce for auth
 * - `buildSignMessage(nonce)` → create a message to sign for login
 * - `hashToken(token)` → hash refresh tokens before storing in DB
 *
 * These functions provide secure, stateless auth with Solana wallet integration.
 */
import jwt from "jsonwebtoken";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { createHash } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

export interface JWTPayload {
  wallet: string;
  userId: string;
}

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign({ ...payload, type: "refresh" }, JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): (JWTPayload & { type: string }) | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload & { type: string };
  } catch {
    return null;
  }
}

export function verifySignature(
  walletAddress: string,
  message: string,
  signature: string
): boolean {
  try {
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
  } catch {
    return false;
  }
}

export function generateNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildSignMessage(nonce: string): string {
  return `Sign this message to authenticate with Team Wallet.\n\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;
}

/**
 * Hash a token (refresh token) before storing in DB.
 * If the database is compromised, raw JWTs aren't directly usable.
 * Uses SHA-256 — fast enough for token comparison, no need for bcrypt
 * since refresh tokens already have high entropy.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
