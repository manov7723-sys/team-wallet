"use client";
/**
 * Determines whether a route is publicly accessible.
 *
 * Public pages bypass authentication and team access checks.
 *
 * @param {string} path - Current route pathname
 * @returns {boolean} True if the page is public
 *
 * Acts as a top-level layout wrapper with built-in authentication
 * and team access control for protected routes.
 *
 * Responsibilities:
 * - Redirects unauthenticated users to the home page
 * - Verifies whether the authenticated user has team access
 * - Allows public routes (e.g., transaction pages) to bypass checks
 * - Displays a loading state while authentication or access data is being resolved
 * - Wraps all valid content inside a shared UserLayoutVW component
 *
 * Behavior:
 * - Public routes (`/transaction/*`) are always accessible
 * - If authentication is loading → show spinner
 * - If not authenticated → redirect to "/"
 * - If authenticated but no team access → redirect to "/"
 * - Otherwise → render children inside layout
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render within the layout
 *
 * @returns {JSX.Element | null} Layout-wrapped content, loading UI, or null during redirects
 */
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTeamAccess } from "@/src/hooks/useApi";
import UserLayoutVW from "@/src/components/Layout/UserLayoutVW";

const isPublicPage = (path: string) => path.startsWith("/transaction/");

export default function UserRootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: accessData, isFetched } = useTeamAccess();

  useEffect(() => {
    if (isPublicPage(pathname)) return;
    if (authLoading) return;

    if (!isAuthenticated) {
      router.replace("/");
      return;
    }

    if (isFetched && accessData && !accessData.hasTeams) {
      router.replace("/");
    }
  }, [isAuthenticated, authLoading, accessData, isFetched, router, pathname]);

  if (isPublicPage(pathname)) {
    return <UserLayoutVW>{children}</UserLayoutVW>;
  }

  if (authLoading || (isAuthenticated && !isFetched)) {
    return (
      <div className="bg-base-100 flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary" />
          <p className="text-neutral-content mt-3 text-sm">
            {authLoading ? "Loading..." : "Verifying team access..."}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (isFetched && accessData && !accessData.hasTeams) return null;

  return <UserLayoutVW>{children}</UserLayoutVW>;
}
