/**
 * @module GET /api/v1/trade/history
 *
 * Token price history endpoint.
 *
 * Attempts to fetch real OHLCV data from Birdeye first (requires
 * BIRDEYE_API_KEY). Falls back to a simulated history generated from
 * Jupiter's current spot price when Birdeye is unavailable or returns
 * no data. Interval resolution scales with the requested period:
 * 24h → 5m bars, 7d → 1H bars, 30d → 4H bars.
 *
 * @query mint, period (24h | 7d | 30d)
 * @returns Array of { timestamp, price } data points
 */
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
const JUPITER_API = "https://api.jup.ag";

function jupiterHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const key = process.env.JUPITER_API_KEY || "";
  if (key) h["x-api-key"] = key;
  return h;
}

export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get("mint");
  const period = req.nextUrl.searchParams.get("period") as "24h" | "7d" | "30d" | null;
  const t = await getTranslations("errormessageapi");
  if (!mint || !period || !["24h", "7d", "30d"].includes(period)) {
    return NextResponse.json(
      { success: false, error: t("mint and period (24h|7d|30d) are required") },
      { status: 400 }
    );
  }

  try {
    const BIRDEYE_KEY = process.env.BIRDEYE_API_KEY || "";
    if (BIRDEYE_KEY) {
      const birdeyeResult = await tryBirdeye(mint, period, BIRDEYE_KEY);
      if (birdeyeResult) {
        return NextResponse.json({ success: true, data: birdeyeResult });
      }
    }

    const fallback = await simulatedHistory(mint, period);
    return NextResponse.json({ success: true, data: fallback });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || t("Price history failed") },
      { status: 500 }
    );
  }
}

interface PricePoint {
  timestamp: number;
  price: number;
}

async function tryBirdeye(
  mint: string,
  period: "24h" | "7d" | "30d",
  apiKey: string
): Promise<PricePoint[] | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const sec = { "24h": 86400, "7d": 604800, "30d": 2592000 };
    const iv: Record<string, string> = { "24h": "5m", "7d": "1H", "30d": "4H" };

    const res = await fetch(
      `https://public-api.birdeye.so/defi/history_price?address=${mint}&address_type=token&type=${iv[period]}&time_from=${now - sec[period]}&time_to=${now}`,
      { headers: { "x-chain": "solana", "X-API-KEY": apiKey } }
    );

    if (res.ok) {
      const d = await res.json();
      if (d.data?.items?.length > 0) {
        return d.data.items.map((i: any) => ({
          timestamp: i.unixTime * 1000,
          price: i.value,
        }));
      }
    }
  } catch {}
  return null;
}

async function simulatedHistory(mint: string, period: "24h" | "7d" | "30d"): Promise<PricePoint[]> {
  const res = await fetch(`${JUPITER_API}/price/v3?ids=${mint}`, {
    headers: jupiterHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const cp = parseFloat(data?.data?.[mint]?.price || "0");
  if (!cp) return [];

  const pts: PricePoint[] = [];
  const now = Date.now();
  const ms = { "24h": 86400000, "7d": 604800000, "30d": 2592000000 };
  const steps = { "24h": 48, "7d": 56, "30d": 60 };
  const vol = { "24h": 0.003, "7d": 0.008, "30d": 0.015 };
  const n = steps[period];
  const step = ms[period] / n;
  const v = vol[period];
  let p = cp;
  const arr: number[] = [cp];
  for (let i = 1; i <= n; i++) {
    p = Math.max(p * 0.8, p - (Math.random() - 0.52) * v * p);
    arr.unshift(p);
  }
  for (let i = 0; i <= n; i++) {
    pts.push({ timestamp: now - ms[period] + step * i, price: arr[i] });
  }
  return pts;
}
