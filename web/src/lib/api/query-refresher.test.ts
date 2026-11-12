import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, test } from "vitest";

import {
  createQueryRefresher,
  getQueryRefresher,
} from "@/lib/api/query-refresher";

type PendingRequest = { finish: () => void; signal: AbortSignal };

/** A query whose requests stay open until the test finishes them, watched like a screen does. */
function watchControlledQuery(queryClient: QueryClient) {
  const pendingRequests: PendingRequest[] = [];
  let requestCount = 0;
  const queryObserver = new QueryObserver(queryClient, {
    queryKey: ["emails", "infinite-list", {}],
    queryFn: ({ signal }) =>
      new Promise<number>((resolve) => {
        requestCount += 1;
        const requestNumber = requestCount;
        pendingRequests.push({
          finish: () => {
            resolve(requestNumber);
          },
          signal,
        });
      }),
  });
  const stopWatching = queryObserver.subscribe(() => {});

  return {
    pendingRequests,
    readRequestCount: () => requestCount,
    stopWatching,
  };
}

async function finishRequest(pendingRequest: PendingRequest | undefined) {
  pendingRequest?.finish();
  // Lets the query settle and the refresher start the refresh it kept.
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("createQueryRefresher", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  afterEach(() => {
    queryClient.clear();
  });

  test("PL-02.3 refreshes asked for while a request runs never cancel it, and one more follows it", async () => {
    const watchedQuery = watchControlledQuery(queryClient);
    await finishRequest(watchedQuery.pendingRequests[0]);
    const queryRefresher = createQueryRefresher(queryClient);

    for (let eventFlush = 0; eventFlush < 20; eventFlush += 1) {
      queryRefresher.refreshQueries(["emails", "infinite-list"]);
    }
    expect(watchedQuery.readRequestCount()).toBe(2);

    await finishRequest(watchedQuery.pendingRequests[1]);
    expect(watchedQuery.readRequestCount()).toBe(3);
    await finishRequest(watchedQuery.pendingRequests[2]);
    expect(watchedQuery.readRequestCount()).toBe(3);
    expect(
      watchedQuery.pendingRequests.some(
        (pendingRequest) => pendingRequest.signal.aborted,
      ),
    ).toBe(false);
    watchedQuery.stopWatching();
  });

  test("PL-02.3 a refresh with nothing running starts one request", async () => {
    const watchedQuery = watchControlledQuery(queryClient);
    await finishRequest(watchedQuery.pendingRequests[0]);
    const queryRefresher = createQueryRefresher(queryClient);

    queryRefresher.refreshQueries(["emails"]);
    await finishRequest(watchedQuery.pendingRequests[1]);

    expect(watchedQuery.readRequestCount()).toBe(2);
    watchedQuery.stopWatching();
  });

  test("PL-02.3 a refresh asked while a screen's own request runs is answered by a new request after it, without cancelling", async () => {
    const watchedQuery = watchControlledQuery(queryClient);
    const queryRefresher = createQueryRefresher(queryClient);

    queryRefresher.refreshQueries(["emails"]);
    expect(watchedQuery.readRequestCount()).toBe(1);
    await finishRequest(watchedQuery.pendingRequests[0]);
    expect(watchedQuery.readRequestCount()).toBe(2);
    await finishRequest(watchedQuery.pendingRequests[1]);

    expect(watchedQuery.readRequestCount()).toBe(2);
    expect(watchedQuery.pendingRequests[0]?.signal.aborted).toBe(false);
    watchedQuery.stopWatching();
  });

  test("realtime events and mutations of one query client share one refresher", () => {
    expect(getQueryRefresher(queryClient)).toBe(getQueryRefresher(queryClient));
    expect(getQueryRefresher(queryClient)).not.toBe(
      getQueryRefresher(new QueryClient()),
    );
  });
});
