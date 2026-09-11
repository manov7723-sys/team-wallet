/**
 * @component TransactionLayout
 *
 * Segment layout for the /transaction and /transaction/[teamWalletAddress] routes.
 *
 * Provides route-level SEO metadata (title, description) for the
 * transactions section, then passes children through directly without
 * adding any additional DOM structure or styling.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transactions",
  description: "View, vote on, and execute multi-sig proposals and transactions for your team.",
};

export default function TransactionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
