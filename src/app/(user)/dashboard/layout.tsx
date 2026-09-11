/**
 * DashboardLayout
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Pages rendered inside the dashboard layout
 *
 * @returns {React.ReactNode}
 * Renders dashboard pages as-is without adding extra wrappers.
 *
 * Defines page metadata for the dashboard such as title and summary.
 * Used as a shared layout for all dashboard routes.
 * Acts as a grouping layer for authenticated user content.
 * Helps organize routing without affecting rendering behavior.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Overview of your team wallet — balances, recent activity, and pending proposals.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
