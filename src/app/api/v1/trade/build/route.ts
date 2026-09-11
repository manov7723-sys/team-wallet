/**
 * @module GET /api/v1/trade/build
 *
 * Proxy for Jupiter's swap transaction builder (swap/v2/build).
 *
 * Constructs the unsigned versioned transaction for a given swap order.
 * The client signs and submits via the /execute route.
 * Keeps the JUPITER_API_KEY server-side.
 *
 * @query inputMint, outputMint, amount, taker, slippageBps?, maxAccounts?
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
  const { searchParams } = req.nextUrl;
  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");
  const taker = searchParams.get("taker");
  const t = await getTranslations("errormessageapi")
  if (!inputMint || !outputMint || !amount || !taker) {
    return NextResponse.json(
      { success: false, error: "inputMint, outputMint, amount, and taker are required" },
      { status: 400 }
    );
  }

  try {
    const url = new URL(`${JUPITER_API}/swap/v2/build`);
    url.searchParams.set("inputMint", inputMint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", amount);
    url.searchParams.set("taker", taker);

    const slippageBps = searchParams.get("slippageBps");
    if (slippageBps) url.searchParams.set("slippageBps", slippageBps);

    const maxAccounts = searchParams.get("maxAccounts");
    if (maxAccounts) url.searchParams.set("maxAccounts", maxAccounts);

    const res = await fetch(url.toString(), { headers: authHeaders() });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `Jupiter build failed (${res.status}): ${text}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || t("Build failed") },
      { status: 500 }
    );
  }
}
