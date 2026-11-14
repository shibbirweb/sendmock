import type { QueryClient, QueryKey } from "@tanstack/react-query";

export type QueryRefresher = {
  refreshQueries: (queryKey: QueryKey) => void;
};

/**
 * Refreshes the queries under a key without ever cancelling a request: TanStack Query cancels
 * one in flight by default (`cancelRefetch`), which starved the lists while thousands of
 * emails arrived. A refresh asked for while a request runs is answered by one more request
 * once it ends, so every refresh still gets data from after it was asked.
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
    // A request started elsewhere (a screen opening) is joined, then followed by a fresh one.
    if (queryClient.isFetching({ queryKey }) > 0) {
      keysToRefreshAgain.add(keyText);
    }
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

const queryRefreshersByClient = new WeakMap<QueryClient, QueryRefresher>();

/**
 * The refresher of a query client, shared by realtime events and mutations so neither
 * cancels the other's requests (PL-02.3).
 */
export function getQueryRefresher(queryClient: QueryClient): QueryRefresher {
  const knownRefresher = queryRefreshersByClient.get(queryClient);
  if (knownRefresher !== undefined) {
    return knownRefresher;
  }
  const queryRefresher = createQueryRefresher(queryClient);
  queryRefreshersByClient.set(queryClient, queryRefresher);

  return queryRefresher;
}
