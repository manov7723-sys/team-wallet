/**
 * @module GET /api/v1/trade/tokens
 *
 * Proxy for Jupiter's verified token list (tokens/v2/tag?query=verified).
 *
 * Returns all tokens tagged as "verified" on Jupiter, used to populate
 * the token selector modal and resolve token metadata throughout the UI.
 * Keeps the JUPITER_API_KEY server-side.
 */
import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

const JUPITER_API = "https://api.jup.ag";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const key = process.env.JUPITER_API_KEY || "";
  if (key) h["x-api-key"] = key;
  return h;
}

export async function GET() {
  const t = await getTranslations("errormessageapi");
  try {
    const res = await fetch(`${JUPITER_API}/tokens/v2/tag?query=verified`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Jupiter token list failed (${res.status})` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || t("Failed to fetch token list") },
      { status: 500 }
    );
  }
}
