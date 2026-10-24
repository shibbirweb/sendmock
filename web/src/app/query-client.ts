import { QueryClient } from "@tanstack/react-query";

/** Lists refresh through realtime events, so background refetching stays modest. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
