import type { QueryClient, QueryKey } from "@tanstack/react-query";

export type QueryRefresher = {
  refreshQueries: (queryKey: QueryKey) => void;
};

/**
 * Refreshes the queries under a key with at most one request in flight per key. A refresh
 * asked for while one runs is kept and started once that one ends, so the last events of a
 * burst are never missed, and a running request is never cancelled: TanStack Query cancels
 * it by default (`cancelRefetch`), which starved the lists while thousands of emails arrived.
 */
export function createQueryRefresher(queryClient: QueryClient): QueryRefresher {
  const refreshingKeys = new Set<string>();
  const keysToRefreshAgain = new Set<string>();

  const refreshQueries = (queryKey: QueryKey) => {
    const keyText = JSON.stringify(queryKey);
    if (refreshingKeys.has(keyText)) {
      keysToRefreshAgain.add(keyText);
      return;
    }

    refreshingKeys.add(keyText);
    void queryClient
      .invalidateQueries({ queryKey }, { cancelRefetch: false })
      .catch(() => {
        // A failed refetch shows on its own query; the next refresh tries again.
      })
      .finally(() => {
        refreshingKeys.delete(keyText);
        if (keysToRefreshAgain.delete(keyText)) {
          refreshQueries(queryKey);
        }
      });
  };

  return { refreshQueries };
}
