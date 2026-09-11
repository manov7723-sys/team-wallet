/**
 * @component SettingsLayout
 *
 * Segment layout for the /settings route.
 *
 * Provides route-level SEO metadata (title, description) for the
 * settings page, then passes children through directly without
 * adding any additional DOM structure or styling.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Configure your team wallet settings — update team profile, manage thresholds, and customize preferences.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
