/**
 * ProgramsLayout
 *
 * Layout wrapper for the Programs section.
 * Defines page metadata like title and description.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Nested page content
 *
 * @returns {JSX.Element} Renders child components inside the layout
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Programs",
  description:
    "Manage Solana program upgrade authorities with multi-sig governance. Deploy, upgrade, and transfer program ownership.",
};

export default function ProgramsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
