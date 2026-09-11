"use client";
/**
 * @component AuthProvider
 *
 * Handles the full wallet-based authentication lifecycle for the app.
 *
 * On mount, restores a previous session from localStorage JWTs and
 * schedules silent token refresh before expiry. Exposes login() which
 * requests a sign message from the API, prompts the wallet to sign,
 * and exchanges the signature for a JWT pair. Clears all auth state
 * and React Query cache on logout.
 *
 * @states
 * - `isAuthenticated` — valid access token is present in memory
 * - `isLoading`       — session restoration or login is in progress
 * - `error`           — last authentication error message (login failures)
 *
 * @dependencies
 * - `useWallet`      — Solana wallet adapter for signing the auth message
 * - `useQueryClient` — React Query cache cleared on logout
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import bs58 from "bs58";
import { toast } from "react-toastify";

export interface AuthUser {
  walletAddress: string;
  name?: string;
  avatar?: string;
  email?: string;
  bio?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: () => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  /**
   * Authenticated fetch wrapper.
   * Automatically attaches Bearer token, and on 401/TokenExpired:
   *   1. Attempts a token refresh
   *   2. Retries the original request with the new token
   *   3. Logs out if refresh fails
   */
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

const KEYS = {
  accessToken: "tw_access_token",
  refreshToken: "tw_refresh_token",
  user: "tw_user",
  wallet: "tw_wallet",
} as const;

function loadStored() {
  if (typeof window === "undefined") return null;
  try {
    const accessToken = localStorage.getItem(KEYS.accessToken);
    const refreshToken = localStorage.getItem(KEYS.refreshToken);
    const user = JSON.parse(localStorage.getItem(KEYS.user) || "null") as AuthUser | null;
    const wallet = localStorage.getItem(KEYS.wallet);
    if (accessToken && user && wallet) return { accessToken, refreshToken, user, wallet };
    return null;
  } catch {
    return null;
  }
}

function saveStored(accessToken: string, refreshToken: string, user: AuthUser, wallet: string) {
  localStorage.setItem(KEYS.accessToken, accessToken);
  localStorage.setItem(KEYS.refreshToken, refreshToken);
  localStorage.setItem(KEYS.user, JSON.stringify(user));
  localStorage.setItem(KEYS.wallet, wallet);
}

function clearStored() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { publicKey, signMessage, disconnect, connected, connecting } = useWallet();
  const queryClient = useQueryClient();
  const walletAddress = publicKey?.toBase58() || null;

  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const loginInProgress = useRef(false);
  const sessionResolved = useRef(false);
  const autoConnectTimer = useRef<NodeJS.Timeout | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const walletRef = useRef(walletAddress);
  walletRef.current = walletAddress;

  const refreshPromise = useRef<Promise<{
    accessToken: string;
    refreshToken: string;
  } | null> | null>(null);

  const doRefresh = useCallback(async (): Promise<{
    accessToken: string;
    refreshToken: string;
  } | null> => {
    if (refreshPromise.current) return refreshPromise.current;

    const currentRefreshToken = stateRef.current.refreshToken;
    if (!currentRefreshToken) return null;

    refreshPromise.current = (async () => {
      try {
        const res = await fetch("/api/v1/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });
        const data = await res.json();

        if (data.success) {
          const { accessToken, refreshToken: newRefreshToken } = data.data;
          setState((s) => {
            if (s.user && walletRef.current) {
              saveStored(accessToken, newRefreshToken, s.user, walletRef.current);
            }
            return { ...s, accessToken, refreshToken: newRefreshToken };
          });
          return { accessToken, refreshToken: newRefreshToken };
        }
        return null;
      } catch {
        return null;
      } finally {
        refreshPromise.current = null;
      }
    })();

    return refreshPromise.current;
  }, []);

  useEffect(() => {
    if (connecting) {
      if (autoConnectTimer.current) clearTimeout(autoConnectTimer.current);
      return;
    }

    if (connected && walletAddress) {
      if (autoConnectTimer.current) clearTimeout(autoConnectTimer.current);
      if (sessionResolved.current) return;
      sessionResolved.current = true;

      const stored = loadStored();
      if (stored && stored.wallet === walletAddress) {
        setState({
          user: stored.user,
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        if (stored && stored.wallet !== walletAddress) clearStored();
        setState((s) => ({ ...s, isLoading: false }));
      }
      return;
    }

    if (!connected && !connecting) {
      if (sessionResolved.current) return;

      const stored = loadStored();
      if (stored) {
        if (!autoConnectTimer.current) {
          autoConnectTimer.current = setTimeout(() => {
            if (sessionResolved.current) return;
            sessionResolved.current = true;
            setState((s) => ({ ...s, isLoading: false }));
          }, 2000);
        }
      } else {
        sessionResolved.current = true;
        setState((s) => ({ ...s, isLoading: false }));
      }
    }
  }, [connected, connecting, walletAddress]);

  useEffect(() => {
    return () => {
      if (autoConnectTimer.current) clearTimeout(autoConnectTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!sessionResolved.current) return;
    if (!connected || !walletAddress || state.isAuthenticated) return;
    const stored = loadStored();
    if (stored && stored.wallet === walletAddress) {
      setState({
        user: stored.user,
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    }
  }, [connected, walletAddress, state.isAuthenticated]);

  useEffect(() => {
    if (!sessionResolved.current) return;
    if (!connected && state.isAuthenticated) {
      clearStored();
      queryClient.clear();
      sessionResolved.current = false;
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, [connected, state.isAuthenticated, queryClient]);

  useEffect(() => {
    if (!sessionResolved.current || !walletAddress || !state.isAuthenticated || !state.user) return;
    if (state.user.walletAddress !== walletAddress) {
      clearStored();
      queryClient.clear();
      sessionResolved.current = false;
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, [walletAddress, state.isAuthenticated, state.user, queryClient]);

  const login = useCallback(async () => {
    if (!publicKey || !signMessage || loginInProgress.current) return;
    loginInProgress.current = true;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const msgRes = await fetch("/api/v1/auth/message", { method: "POST" });
      const msgData = await msgRes.json();
      if (!msgData.success) throw new Error(msgData.error || "Failed to get message");

      const signatureBytes = await signMessage(new TextEncoder().encode(msgData.data.message));
      const signature = bs58.encode(signatureBytes);

      const loginRes = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          signature,
          nonce: msgData.data.nonce,
        }),
      });
      const loginData = await loginRes.json();
      if (!loginData.success) throw new Error(loginData.error || "Login failed");

      const { user, accessToken, refreshToken } = loginData.data;
      const addr = publicKey.toBase58();
      saveStored(accessToken, refreshToken, user, addr);

      queryClient.clear();

      setState({
        user: { ...user, walletAddress: addr },
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      const msg = err?.message || "Login failed";
      const isRejection = msg.includes("User rejected") || msg.includes("rejected");
      if (!isRejection) toast.error(msg);
      setState((s) => ({ ...s, isLoading: false, error: isRejection ? null : msg }));
      if (isRejection) disconnect().catch(() => {});
    } finally {
      loginInProgress.current = false;
    }
  }, [publicKey, signMessage, disconnect, queryClient]);

  const logout = useCallback(() => {
    clearStored();
    queryClient.clear();
    sessionResolved.current = false;
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    disconnect().catch(() => {});
  }, [disconnect, queryClient]);

  /*
   *
   * Drop-in replacement for fetch() on authenticated API calls.
   * If the server returns 401 + "TokenExpired", this will:
   *   1. Attempt a single token refresh
   *   2. Retry the original request with the new access token
   *   3. Logout if refresh fails
   */
  const authFetch = useCallback(
    async (url: string, options?: RequestInit): Promise<Response> => {
      const currentToken = stateRef.current.accessToken;
      const headers = new Headers(options?.headers);
      if (currentToken) {
        headers.set("Authorization", `Bearer ${currentToken}`);
      }

      const res = await fetch(url, { ...options, headers });

      if (res.status !== 401) return res;

      const cloned = res.clone();
      try {
        const body = await cloned.json();
        if (body?.error !== "TokenExpired") return res;
      } catch {
        return res;
      }

      const refreshed = await doRefresh();
      if (!refreshed) {
        logout();
        return res;
      }
      headers.set("Authorization", `Bearer ${refreshed.accessToken}`);
      return fetch(url, { ...options, headers });
    },
    [doRefresh, logout]
  );

  useEffect(() => {
    if (!state.refreshToken || !state.isAuthenticated) return;
    const interval = setInterval(
      () => {
        doRefresh();
      },
      45 * 60 * 1000
    );
    return () => clearInterval(interval);
  }, [state.refreshToken, state.isAuthenticated, doRefresh]);

  const updateUser = useCallback(
    (updates: Partial<AuthUser>) => {
      setState((s) => {
        if (!s.user) return s;
        const updated = { ...s.user, ...updates };
        if (s.accessToken && s.refreshToken && walletAddress)
          saveStored(s.accessToken, s.refreshToken, updated, walletAddress);
        return { ...s, user: updated };
      });
    },
    [walletAddress]
  );

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;