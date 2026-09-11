/**
 * @module GET /api/v1/trade/prices
 *
 * Batch token price endpoint proxying Jupiter's price/v3 API.
 *
 * Accepts a comma-separated list of mint addresses and returns a flat
 * map of mint → USD price. Requests are batched in groups of 50 to
 * stay within Jupiter's query string limits.
 * Keeps the JUPITER_API_KEY server-side.
 *
 * @query ids (comma-separated mint addresses)
 * @returns Record<mintAddress, usdPrice>
 */

import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
const JUPITER_API = "https://api.jup.ag";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const key = process.env.JUPITER_API_KEY || "";
  if (key) h["x-api-key"] = key;
  return h;
}

export async function GET(req: NextRequest) {
  const t = await getTranslations("errormessageapi");
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) {
    return NextResponse.json(
      { success: false, error: t("ids parameter is required") },
      { status: 400 }
    );
  }

  try {
    const results: Record<string, number> = {};
    const mints = ids.split(",").filter(Boolean);

    for (let i = 0; i < mints.length; i += 50) {
      const batch = mints.slice(i, i + 50).join(",");
      const res = await fetch(`${JUPITER_API}/price/v3?ids=${batch}`, {
        headers: authHeaders(),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.data) {
        for (const [m, v] of Object.entries(data.data)) {
          results[m] = parseFloat((v as any).price || "0");
        }
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || t("Price fetch failed") },
      { status: 500 }
    );
  }
}
