/**
 * @component TokenLayout
 *
 * Segment layout for the /token and /token/[mintAddress] routes.
 *
 * Provides route-level SEO metadata (title, description) for the
 * token manager section, then passes children through directly
 * without adding any additional DOM structure or styling.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tokens",
  description:
    "Create, import, and manage fungible tokens and NFTs with Token-2022 extensions from your team wallet.",
};

export default function TokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
