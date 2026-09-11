"use client";
/**
 * TransactionRedirect module - Handles routing to the correct transaction page.
 *
 * Automatically redirects users based on authentication and team state:
 * - If authenticated and active team exists → redirects to team transaction page
 * - If not authenticated → redirects to home page
 *
 * Ensures users cannot access transaction routes without proper context.
 *
 * Uses:
 * - useActiveTeam → fetch active team and loading state
 * - useAuth → check authentication status
 * - useRouter → perform client-side navigation
 *
 * Side Effects:
 * - Triggers router.replace() after state is resolved
 * - Prevents rendering incorrect route content
 *
 * @returns {JSX.Element} Loading spinner UI while determining redirect
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import { useAuth } from "@/src/providers/AuthProvider";

export default function TransactionRedirect() {
  const router = useRouter();
  const { activeTeam, isLoading } = useActiveTeam();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && activeTeam && isAuthenticated) {
      router.replace(`/transaction/${activeTeam.teamWalletAddress}`);
    } else if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [activeTeam, isLoading, isAuthenticated, router]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="loading loading-spinner loading-lg text-primary" />
    </div>
  );
}
