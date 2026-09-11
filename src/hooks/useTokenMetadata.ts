import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

export interface TokenMeta {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
}

/**
 * For IPFS/Arweave URIs, use our server proxy as the img src.
 * The proxy fetches JSON metadata, extracts .image, and 302 redirects to the actual image.
 * No client-side fetch needed — <img src="/api/v1/proxy/ipfs?uri=..."> just works.
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
 * Fetch token metadata for a list of mint addresses.
 *
 * This hook queries the Solana blockchain for metadata associated with
 * each token mint address provided. If the metadata includes a URI, it
 * is converted to a usable image source via `uriToImgSrc`.
 *
 * @param mints - Array of Solana token mint addresses (Base58 strings)
 * @returns `UseQueryResult<Map<string, TokenMeta>, unknown>` from react-query,
 *          where the key is the mint address and the value is `TokenMeta`
 */
export function useTokenMetadata(mints: string[]) {
  const { connection } = useConnection();

  return useQuery<Map<string, TokenMeta>>({
    queryKey: ["tokenMetadata", mints.join(",")],
    queryFn: async () => {
      const map = new Map<string, TokenMeta>();
      if (mints.length === 0) return map;

      for (const mint of mints) {
        let name = mint.slice(0, 4) + "..." + mint.slice(-4);
        let symbol = "???";
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

        map.set(mint, { mint, name, symbol, image });
      }
      return map;
    },
    enabled: mints.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
