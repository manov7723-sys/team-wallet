/**
 * Metadata configuration and layout component for guest (unauthenticated) pages.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components rendered inside the layout
 *
 * @returns {JSX.Element} Returns a full-page layout with header, footer, and main content area
 *
 * This layout is used for public-facing pages. It wraps content with a header and footer,
 * and provides a styled background container for the main section.
 */
import type { Metadata } from "next";
import FooterVW from "@/src/components/Footer/FooterVW";
import HeaderVW from "@/src/components/Header/HeaderVW";

export const metadata: Metadata = {
  title: "Team Wallet — Multi-sig Treasury on Solana",
  description:
    "Create a shared wallet, add your team, and manage crypto assets with multi-signature security on Solana. Every transaction requires team approval.",
  openGraph: {
    title: "Team Wallet — Multi-sig Treasury on Solana",
    description:
      "Create a shared wallet, add your team, and manage crypto assets with multi-signature security on Solana.",
  },
};

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-base-100 flex min-h-dvh flex-col justify-between">
      <HeaderVW />
      <main className="from-base-100 via-primary/5 to-accent/5 relative flex w-full flex-1 items-center overflow-hidden bg-linear-to-br">
        <div className="bg-primary/20 fixed -top-32 -left-32 h-72 w-72 rounded-full blur-3xl" />
        <div className="bg-primary/20 fixed -right-32 -bottom-32 h-72 w-72 rounded-full blur-3xl" />
        {children}
      </main>
      <FooterVW />
    </div>
  );
}
