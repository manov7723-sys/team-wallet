/**
 * @module GET /api/v1/trade/quote
 *
 * Proxy for Jupiter's swap quote endpoint (swap/v2/order).
 *
 * Returns the best available route, estimated output amount, price
 * impact, route plan, and slippage details for a given swap pair.
 * Used by the Trade page to display a live quote as the user types.
 * Keeps the JUPITER_API_KEY server-side.
 *
 * @query inputMint, outputMint, amount, slippageBps?, taker?
 */

import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";

const JUPITER_API = "https://api.jup.ag";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const key = process.env.JUPITER_API_KEY || "";
  if (key) h["x-api-key"] = key;
  return h;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");
  const t = await getTranslations("errormessageapi");

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { success: false, error: "inputMint, outputMint, and amount are required" },
      { status: 400 }
    );
  }

  try {
    const url = new URL(`${JUPITER_API}/swap/v2/order`);
    url.searchParams.set("inputMint", inputMint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", amount);

    const slippageBps = searchParams.get("slippageBps");
    if (slippageBps) url.searchParams.set("slippageBps", slippageBps);

    const taker = searchParams.get("taker");
    if (taker) url.searchParams.set("taker", taker);

    const res = await fetch(url.toString(), { headers: authHeaders() });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `t(Jupiter order failed) (${res.status}): ${text}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || t("Quote failed") },
      { status: 500 }
    );
  }
}
