"use client";
/**
 * @component PriceChart
 *
 * Recharts area chart displaying historical price data for a given SPL
 * token mint address. Fetches OHLCV-style price points via usePriceHistory
 * and renders a gradient area chart with a period selector (24h / 7d / 30d).
 * Shows current price, percentage change with trend arrow, and high/low stats
 * for the selected period. Chart line color switches green/red based on
 * whether the period return is positive or negative.
 *
 * @dependencies
 * - `usePriceHistory` — fetches price history from /api/v1/trade/history
 */

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { usePriceHistory } from "@/src/hooks/useTradeHooks";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

interface PriceChartProps {
  mintAddress: string | null;
  symbol?: string;
  period: "24h" | "7d" | "30d";
  onPeriodChange: (period: "24h" | "7d" | "30d") => void;
}

export default function PriceChart({
  mintAddress,
  symbol,
  period,
  onPeriodChange,
}: PriceChartProps) {
  const { data: history, isLoading } = usePriceHistory(mintAddress, period);
  const t = useTranslations("trade");
  const stats = useMemo(() => {
    if (!history || history.length < 2) return null;
    const first = history[0].price;
    const last = history[history.length - 1].price;
    const change = last - first;
    const changePct = (change / first) * 100;
    const high = Math.max(...history.map((p) => p.price));
    const low = Math.min(...history.map((p) => p.price));
    return { current: last, change, changePct, high, low, isUp: change >= 0 };
  }, [history]);

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    if (period === "24h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (!mintAddress) {
    return (
      <div className="text-neutral-content flex h-[300px] items-center justify-center text-sm">
        {t("Select a token to view price chart")}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          {stats ? (
            <>
              <p className="text-2xl font-bold">{formatPrice(stats.current)}</p>
              <div
                className={`flex items-center gap-1 text-sm ${stats.isUp ? "text-success" : "text-error"}`}
              >
                {stats.isUp ? (
                  <TrendingUp className="size-4.5" />
                ) : (
                  <TrendingDown className="size-4.5" />
                )}
                <span className="font-medium">
                  {stats.isUp ? "+" : ""}
                  {stats.changePct.toFixed(2)}%
                </span>
                <span className="text-neutral-content ml-1">
                  {period === "24h" ? "24h" : period === "7d" ? "7d" : "30d"}
                </span>
              </div>
            </>
          ) : isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="size-4.5 animate-spin" />
              <span className="text-neutral-content text-sm">{t("Loading")}</span>
            </div>
          ) : (
            <p className="text-neutral-content text-sm">{t("No price data")}</p>
          )}
        </div>

        <div className="bg-base-200/50 flex gap-1 rounded-lg p-1">
          {(["24h", "7d", "30d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${period === p ? "bg-base-100 text-base-content shadow-sm" : "text-neutral-content hover:text-base-content"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[220px]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
          </div>
        ) : history && history.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={stats?.isUp ? "#22c55e" : "#ef4444"}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="100%"
                    stopColor={stats?.isUp ? "#22c55e" : "#ef4444"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                tick={{ fontSize: 10, fill: "var(--color-neutral-content, #888)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 10, fill: "var(--color-neutral-content, #888)" }}
                axisLine={false}
                tickLine={false}
                width={60}
                tickFormatter={(v: number) => formatPrice(v)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-base-100, #1a1a2e)",
                  border: "1px solid var(--color-base-200, #2a2a4a)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                labelFormatter={(label) => new Date(Number(label)).toLocaleString()}
                formatter={(value) => [formatPrice(Number(value)), symbol || "Price"]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={stats?.isUp ? "#22c55e" : "#ef4444"}
                strokeWidth={2}
                fill="url(#priceGradient)"
                dot={false}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-neutral-content flex h-full items-center justify-center text-sm">
            {t("No chart data available")}
          </div>
        )}
      </div>

      {stats && (
        <div className="text-neutral-content mt-3 flex gap-4 text-xs">
          <div>
            {t("High")}{" "}
            <span className="text-base-content font-mono">{formatPrice(stats.high)}</span>
          </div>
          <div>
            {t("Low")} <span className="text-base-content font-mono">{formatPrice(stats.low)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
