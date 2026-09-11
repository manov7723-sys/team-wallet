/**
 * Wallet and clipboard utility functions.
 *
 * - `shortenWalletAddress(text, fallback)` → Shortens a blockchain wallet address to the first 4 and last 4 characters.
 *    Returns a fallback string if the input is null, undefined, or empty.
 *    Example: "F4kEwAlLeT1234" → "F4kE...1234".
 *
 * - `copyToClipboard(value)` → Copies the provided string to the system clipboard.
 *    Logs an error if the copy operation fails (e.g., unsupported browser or permission issues).
 */
import logger from "./logger";

export function shortenWalletAddress(
  text: string | null | undefined,
  fallback: string = "Select Wallet"
): string {
  if (!text) return fallback;
  if (text.length <= 8) return text;
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

export const copyToClipboard = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    logger.error("Failed to copy to clipboard");
  }
};
