/**
 * @module GET /api/v1/proxy/ipfs
 *
 * IPFS metadata resolver and image proxy.
 *
 * Accepts any ipfs://, ar://, or https:// URI and resolves it to an
 * image, cycling through multiple IPFS gateways (dweb.link → Pinata →
 * ipfs.io) on failure. Supports two operating modes:
 *
 *   ?uri=...               — 302 redirect to the resolved image URL.
 *                            Use directly as an <img src> attribute.
 *   ?uri=...&resolve=true  — returns JSON { image, name, symbol }
 *                            extracted from JSON metadata, without redirecting.
 *
 * If the URI points to JSON metadata, extracts the .image field and
 * resolves that in turn. Falls back gracefully on content-type mismatches
 * (binary images served with wrong content-type headers).
 */

import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
function extractCid(uri: string): string | null {
  if (uri.startsWith("ipfs://")) return uri.slice(7);
  const p = uri.match(/\/ipfs\/([a-zA-Z0-9]+[a-zA-Z0-9/]*)/);
  if (p) return p[1];
  const s = uri.match(/([a-zA-Z0-9]+)\.ipfs\./);
  if (s) return s[1];
  return null;
}

function buildUrls(uri: string): string[] {
  const cid = extractCid(uri);
  if (cid)
    return [
      `https://${cid}.ipfs.dweb.link/`,
      `https://gateway.pinata.cloud/ipfs/${cid}`,
      `https://ipfs.io/ipfs/${cid}`,
    ];
  if (uri.startsWith("ar://")) return [`https://arweave.net/${uri.slice(5)}`];
  if (uri.startsWith("http")) return [uri];
  return [];
}

function toImageUrl(uri: string): string {
  const cid = extractCid(uri);
  if (cid) return `https://${cid}.ipfs.dweb.link/`;
  if (uri.startsWith("ar://")) return `https://arweave.net/${uri.slice(5)}`;
  return uri;
}

async function fetchFirst(urls: string[]): Promise<Response | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return res;
    } catch {}
  }
  return null;
}

export async function GET(req: NextRequest) {
  const t = await getTranslations("errormessageapi");
  const uri = req.nextUrl.searchParams.get("uri");
  if (!uri) return NextResponse.json({ error: t("uriRequired") }, { status: 400 });

  const resolve = req.nextUrl.searchParams.get("resolve") === "true";
  const urls = buildUrls(uri);
  if (urls.length === 0) return NextResponse.json({ error: t("invalidUri") }, { status: 400 });

  const res = await fetchFirst(urls);
  if (!res) {
    if (resolve) return NextResponse.json({ image: null, error: t("failed") }, { status: 502 });
    return NextResponse.redirect(urls[0]);
  }

  const ct = res.headers.get("content-type") || "";

  if (ct.startsWith("image/")) {
    if (resolve) return NextResponse.json({ image: res.url || urls[0] });
    return NextResponse.redirect(res.url || urls[0]);
  }

  try {
    const text = await res.text();
    const json = JSON.parse(text);
    const imageUri = json.image || json.image_url || json.img || null;
    const imageUrl = imageUri ? toImageUrl(imageUri) : null;

    if (resolve)
      return NextResponse.json({ image: imageUrl, name: json.name, symbol: json.symbol });
    if (imageUrl) return NextResponse.redirect(imageUrl);
    return NextResponse.json({ error: t("noImage") }, { status: 404 });
  } catch {
    if (resolve) return NextResponse.json({ image: res.url || urls[0] });
    return NextResponse.redirect(res.url || urls[0]);
  }
}
