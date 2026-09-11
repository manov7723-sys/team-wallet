/**
 * Metadata configuration for the "Create Team" page and layout component.
 *
 * @typedef {Object} CreateLayoutProps
 * @property {React.ReactNode} children - Child components to be rendered inside the layout
 *
 * @returns {React.ReactNode} Returns the children directly without additional layout wrapping
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Team",
  description:
    "Set up a new multi-sig team wallet on Solana. Add members, configure voting thresholds, and deploy your shared treasury.",
  openGraph: {
    title: "Create Team | Team Wallet",
    description:
      "Set up a new multi-sig team wallet on Solana. Add members, configure voting thresholds, and deploy your shared treasury.",
  },
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
