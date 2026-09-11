/**
 * Solana Explorer link helpers.
 * Cluster is read from NEXT_PUBLIC_SOLANA_NETWORK env var.
 * On mainnet-beta the ?cluster param is omitted (explorer defaults to mainnet).
 */

const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";

const clusterParam = NETWORK === "mainnet-beta" ? "" : `?cluster=${NETWORK}`;

export function explorerAddressLink(address: string): string {
  return `https://explorer.solana.com/address/${address}${clusterParam}`;
}

export function explorerTxLink(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
}
