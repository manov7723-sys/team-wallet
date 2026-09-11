"use client";
/**
 * @component ActiveTeamProvider
 *
 * Manages the currently selected team wallet across the entire app.
 *
 * Persists the active team address to localStorage so the selection
 * survives page refreshes. On mount it auto-selects the previously
 * active team if it still exists in the access list, or falls back to
 * the first available team. Exposes useActiveTeam() for reading and
 * switching the active team from any component.
 *
 * @dependencies
 * - `useTeamAccess` — fetches all teams the authenticated wallet belongs to
 */
import { createContext, useContext, useCallback, useState, type FC, type ReactNode } from "react";
import { useTeamAccess, type TeamAccess } from "@/src/hooks/useApi";

interface ActiveTeamContextValue {
  activeTeam: TeamAccess | null;
  setActiveTeamAddress: (address: string) => void;
  teams: TeamAccess[];
  isLoading: boolean;
}

const ActiveTeamContext = createContext<ActiveTeamContextValue | null>(null);

export function useActiveTeam(): ActiveTeamContextValue {
  const ctx = useContext(ActiveTeamContext);
  if (!ctx) throw new Error("useActiveTeam must be used within <ActiveTeamProvider>");
  return ctx;
}

const STORAGE_KEY = "tw_active_team";

export const ActiveTeamProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { data: accessData, isLoading } = useTeamAccess();
  const [activeAddress, setActiveAddress] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  const accessKey = accessData?.teams?.map((t) => t.teamWalletAddress).join(",") ?? null;
  const [lastAccessKey, setLastAccessKey] = useState<string | null>(null);
  if (accessKey && accessKey !== lastAccessKey) {
    setLastAccessKey(accessKey);
    const teams = accessData!.teams;
    if (activeAddress) {
      const exists = teams.find((t) => t.teamWalletAddress === activeAddress);
      if (!exists) {
        setActiveAddress(teams[0].teamWalletAddress);
        localStorage.setItem(STORAGE_KEY, teams[0].teamWalletAddress);
      }
    } else {
      setActiveAddress(teams[0].teamWalletAddress);
      localStorage.setItem(STORAGE_KEY, teams[0].teamWalletAddress);
    }
  }

  const setActiveTeamAddress = useCallback((address: string) => {
    setActiveAddress(address);
    localStorage.setItem(STORAGE_KEY, address);
  }, []);

  const teams = accessData?.teams || [];
  const activeTeam = teams.find((t) => t.teamWalletAddress === activeAddress) || null;

  return (
    <ActiveTeamContext.Provider value={{ activeTeam, setActiveTeamAddress, teams, isLoading }}>
      {children}
    </ActiveTeamContext.Provider>
  );
};

export default ActiveTeamProvider;
