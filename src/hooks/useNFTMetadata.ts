import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

export interface NFTMeta {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  collection: string | null;
  amount: number;
}
/**
 * Converts a URI string into a usable image source.
 *
 * - If the URI is a direct image URL (png, jpg, jpeg, gif, webp, svg) and not IPFS/Arweave, returns it directly.
 * - Otherwise, returns a proxied URL to fetch the image via `/api/v1/proxy/ipfs`.
 *
 * @param {string} uri - The URI of the NFT metadata image.
 * @returns {string | null} - The resolved image URL or null if invalid.
 */
function uriToImgSrc(uri: string): string | null {
  if (!uri || uri.length < 5) return null;
  if (
    /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(uri) &&
    !uri.includes("ipfs") &&
    !uri.includes("arweave")
  ) {
    return uri;
  }
  return `/api/v1/proxy/ipfs?uri=${encodeURIComponent(uri)}`;
}
/**
 * React hook to fetch metadata for a list of NFT mints on Solana.
 *
 * Uses `@tanstack/react-query` to cache and manage the request state.
 *
 * @param {string[]} mints - Array of NFT mint addresses to fetch metadata for.
 * @returns {import('@tanstack/react-query').UseQueryResult<NFTMeta[], unknown>}
 *   - Query result object containing the array of NFTMeta.
 *
 * @example
 * const { data: nfts, isLoading, error } = useNFTMetadata(["mintAddress1", "mintAddress2"]);
 */
export function useNFTMetadata(mints: string[]) {
  const { connection } = useConnection();

  return useQuery<NFTMeta[]>({
    queryKey: ["nftMetadata", mints.join(",")],
    queryFn: async () => {
      if (mints.length === 0) return [];
      const results: NFTMeta[] = [];

      for (const mint of mints) {
        let name = mint.slice(0, 4) + "..." + mint.slice(-4);
        let symbol = "NFT";
        let image: string | null = null;

        try {
          const info = await connection.getParsedAccountInfo(new PublicKey(mint));
          const parsed = (info.value?.data as any)?.parsed;
          if (parsed?.info?.extensions) {
            for (const ext of parsed.info.extensions) {
              if (ext.extension === "tokenMetadata") {
                name = ext.state?.name || name;
                symbol = ext.state?.symbol || symbol;
                if (ext.state?.uri) image = uriToImgSrc(ext.state.uri);
                break;
              }
            }
          }
        } catch {}

        results.push({ mint, name, symbol, image, collection: null, amount: 0 });
      }
      return results;
    },
    enabled: mints.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
