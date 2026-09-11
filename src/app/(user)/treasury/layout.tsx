/**
 * @component TreasuryLayout
 *
 * Segment layout for the /treasury route.
 *
 * Provides route-level SEO metadata (title, description) for the
 * treasury page, then passes children through directly without
 * adding any additional DOM structure or styling.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Treasury",
  description: "View and manage your team wallet token balances, send assets, and track holdings.",
};

export default function TreasuryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
