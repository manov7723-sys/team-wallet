"use client";
/**
 * @component ReactQueryProvider
 *
 * Wraps the app in TanStack's QueryClientProvider with sensible defaults:
 * 30s stale time, no refetch on window focus, and a single retry.
 * Creates a fresh QueryClient per mount to prevent shared state across
 * server renders in Next.js.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type FC, type ReactNode } from "react";

const ReactQueryProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export default ReactQueryProvider;
