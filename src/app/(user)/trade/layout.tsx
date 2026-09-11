/**
 * @component TradeLayout
 *
 * Segment layout for the /trade route.
 *
 * Provides route-level SEO metadata (title, description) for the
 * trade page, then passes children through directly without adding
 * any additional DOM structure or styling.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trade",
  description:
    "Swap tokens from your team treasury via Jupiter aggregation with multi-sig approval.",
};

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
