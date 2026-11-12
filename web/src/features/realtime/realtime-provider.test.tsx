import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { clearNotifications } from "@/features/notifications/notification-store";
import { RealtimeProvider } from "@/features/realtime/realtime-provider";
import { realtimeFlushIntervalMs } from "@/features/realtime/realtime-event-batcher";
import { queryKeys } from "@/lib/api/query-keys";

vi.mock("sonner", () => ({ toast: vi.fn() }));

/** Stands in for the browser's WebSocket so the test opens, feeds and drops the stream. */
class FakeRealtimeSocket extends EventTarget {
  static openedSockets: FakeRealtimeSocket[] = [];

  constructor() {
    super();
    FakeRealtimeSocket.openedSockets.push(this);
  }

  close() {}

  receiveFrame(frameText: string) {
    this.dispatchEvent(new MessageEvent("message", { data: frameText }));
  }
}

function buildOpenedEventFrame(emailNumber: number): string {
  return JSON.stringify({
    id: `evt_${emailNumber}`,
    type: "email.opened",
    created_at: "2026-11-12T10:00:00Z",
    data: { id: `email_${emailNumber}` },
  });
}

function renderProvider(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <p>Inbox</p>
      </RealtimeProvider>
    </QueryClientProvider>,
  );
}

function readLatestSocket(): FakeRealtimeSocket {
  const latestSocket = FakeRealtimeSocket.openedSockets.at(-1);
  if (latestSocket === undefined) {
    throw new Error("the provider opened no socket");
  }

  return latestSocket;
}

describe("RealtimeProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeRealtimeSocket.openedSockets = [];
    vi.stubGlobal("WebSocket", FakeRealtimeSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    clearNotifications();
  });

  test("PL-02.3 a burst of events refreshes each affected query once per flush, the first at once", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    renderProvider(queryClient);
    const realtimeSocket = readLatestSocket();

    const expectedRefreshCalls = [
      [{ queryKey: queryKeys.emails.all }, { cancelRefetch: false }],
      [{ queryKey: queryKeys.system.stats }, { cancelRefetch: false }],
    ];

    act(() => {
      for (let emailNumber = 1; emailNumber <= 2000; emailNumber += 1) {
        realtimeSocket.receiveFrame(buildOpenedEventFrame(emailNumber));
      }
    });
    // The first event is applied at once; the other 1,999 wait for the next flush.
    expect(invalidateQueries.mock.calls).toEqual(expectedRefreshCalls);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(realtimeFlushIntervalMs);
    });

    expect(invalidateQueries.mock.calls).toEqual([
      ...expectedRefreshCalls,
      ...expectedRefreshCalls,
    ]);
  });

  test("PL-02.5 after the stream drops and comes back, every list is refreshed once", () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    renderProvider(queryClient);
    act(() => {
      readLatestSocket().dispatchEvent(new Event("open"));
    });
    expect(invalidateQueries).not.toHaveBeenCalled();

    act(() => {
      readLatestSocket().dispatchEvent(new Event("close"));
      vi.advanceTimersByTime(3000);
    });
    expect(FakeRealtimeSocket.openedSockets).toHaveLength(2);
    act(() => {
      readLatestSocket().dispatchEvent(new Event("open"));
    });

    const refreshedKeys = invalidateQueries.mock.calls.map(
      ([invalidateFilters]) => invalidateFilters?.queryKey,
    );
    expect(refreshedKeys).toContainEqual(queryKeys.emails.all);
    expect(refreshedKeys).toContainEqual(queryKeys.sms.all);
    expect(refreshedKeys).toContainEqual(queryKeys.system.stats);
    expect(new Set(refreshedKeys.map((key) => JSON.stringify(key))).size).toBe(
      refreshedKeys.length,
    );
  });
});
