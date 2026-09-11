/**
 * MembersLayout Component & Metadata
 *
 * @param {Object} props - Layout wrapper props.
 * @param {React.ReactNode} props.children - Child components/pages rendered inside the members layout.
 *
 * @returns {JSX.Element}
 * - Returns the layout wrapper for the Members section.
 * - Defines page metadata such as title and description for SEO.
 * - Represents the members management section of the application.
 * - Used to group all routes related to team member management.
 * - Ensures consistent structure for members-related pages.
 * - Acts as a simple container for child components.
 * - Supports role and permission management pages under this layout.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Members",
  description:
    "Manage team members, roles, and permissions. Add voters, contributors, and configure access control.",
};

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
