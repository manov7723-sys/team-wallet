/**
 * @module POST /api/v1/trade/execute
 *
 * Proxy for Jupiter's swap execution endpoint (swap/v2/execute).
 *
 * Submits a client-signed versioned transaction to Jupiter for
 * broadcast and on-chain confirmation. The client must sign the
 * transaction returned by /build before calling this route.
 * Keeps the JUPITER_API_KEY server-side.
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

/**
 * Body: { signedTransaction, requestId, lastValidBlockHeight? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const t = await getTranslations("errormessageapi");
    const { signedTransaction, requestId } = body;

    if (!signedTransaction || !requestId) {
      return NextResponse.json(
        { success: false, error: t("signedTransaction and requestId are required") },
        { status: 400 }
      );
    }

    const res = await fetch(`${JUPITER_API}/swap/v2/execute`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `Jupiter execute failed (${res.status}): ${text}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Execute failed" },
      { status: 500 }
    );
  }
}
