/**
 * URI → image src helper.
 * Routes IPFS/Arweave/JSON-metadata URIs through our server proxy.
 * The proxy handles JSON parsing + gateway resolution + 302 redirect.
 *
 * Usage: <img src={uriToImgSrc(uri)} />
 */

export function uriToImgSrc(uri: string): string | null {
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

export const toGatewayUrl = uriToImgSrc;
export const resolveImage = async (uri: string) => uriToImgSrc(uri);
