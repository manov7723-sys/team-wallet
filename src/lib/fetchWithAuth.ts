/**
 * Authenticated fetch for client-side library modules.
 *
 * Reads the JWT from localStorage and attaches it as a Bearer token.
 * Used by pinata.ts and jupiter.ts to call internal /api/v1/* proxy routes
 * that require authentication via middleware.
 */
export function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const headers = new Headers(options?.headers);

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("tw_access_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return fetch(url, { ...options, headers });
}
