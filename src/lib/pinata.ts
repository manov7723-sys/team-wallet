/**
 * Pinata IPFS Upload Client
 *
 * Uploads images and metadata JSON to IPFS via the internal
 * /api/v1/pinata proxy route (which holds the Pinata JWT server-side).
 *
 * Returns both ipfs:// URIs (for on-chain storage) and
 * gateway URLs (for display in the UI).
 */

import { fetchWithAuth } from "./fetchWithAuth";

interface UploadResult {
  ipfsUri: string;
  gatewayUrl: string;
  cid: string;
}

/**
 * Upload an image file to IPFS via Pinata.
 */
export async function uploadImageToPinata(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetchWithAuth("/api/v1/pinata?type=image", {
    method: "POST",
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Pinata image upload failed (${res.status})`);
  }
  return json.data;
}

/**
 * Upload a token metadata JSON to IPFS via Pinata.
 * Follows the Metaplex / Token-2022 metadata standard.
 */
export async function uploadMetadataJsonToPinata(metadata: {
  name: string;
  symbol: string;
  description?: string;
  image: string;
  attributes?: { trait_type: string; value: string }[];
  external_url?: string;
}): Promise<UploadResult> {
  const res = await fetchWithAuth("/api/v1/pinata?type=metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Pinata metadata upload failed (${res.status})`);
  }
  return json.data;
}
