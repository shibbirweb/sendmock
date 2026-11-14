import { type InfiniteData, QueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import {
  applyRealtimeEvents,
  refreshAfterReconnect,
} from "@/features/realtime/apply-realtime-events";
import type { QueryRefresher } from "@/lib/api/query-refresher";
import { listEveryRealtimeQueryKey } from "@/features/realtime/realtime-event-effects";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  AppEvent,
  AppEventType,
  EmailSummary,
  PageOf,
} from "@/lib/api/types";

function createRecordingRefresher() {
  const refreshedKeys: QueryKey[] = [];
  const queryRefresher: QueryRefresher = {
    refreshQueries: (queryKey) => {
      refreshedKeys.push(queryKey);
    },
  };

  return { queryRefresher, refreshedKeys };
}

function buildEvent(
  eventType: AppEventType,
  eventData: Record<string, unknown>,
): AppEvent {
  return {
    id: `evt_${eventType}`,
    type: eventType,
    created_at: "2026-11-12T10:00:00Z",
    data: eventData,
  };
}

function buildNewEmailEvent(subject: string): AppEvent {
  const emailSummary: EmailSummary = {
    id: `email_${subject}`,
    received_at: "2026-11-12T10:00:00Z",
    from: { name: "Shop", address: "shop@example.test" },
    to: [{ name: "Sam", address: "sam@example.test" }],
    subject,
    snippet: "",
    size_bytes: 900,
    attachment_count: 0,
    is_read: false,
    tags: [],
    source: "smtp",
    delivery_status: null,
    open_count: 0,
    has_otp: false,
    direction: "outbound",
    response_kind: null,
    project: "default",
  };

  return buildEvent("email.received", emailSummary);
}

describe("applyRealtimeEvents", () => {
  test("PL-02.3 a flush of new emails fills the list and refreshes only the counters, once", () => {
    const queryClient = new QueryClient();
    const listKey = queryKeys.emails.infiniteList({ project: undefined });
    queryClient.setQueryData<InfiniteData<PageOf<EmailSummary>>>(listKey, {
      pages: [{ items: [], next_cursor: null, total_count: 0 }],
      pageParams: [undefined],
    });
    const { queryRefresher, refreshedKeys } = createRecordingRefresher();

    applyRealtimeEvents(
      queryClient,
      queryRefresher,
      Array.from({ length: 500 }, (_, emailIndex) =>
        buildNewEmailEvent(`Burst ${emailIndex + 1}`),
      ),
    );

    const listData =
      queryClient.getQueryData<InfiniteData<PageOf<EmailSummary>>>(listKey);
    expect(listData?.pages[0]?.items[0]?.subject).toBe("Burst 500");
    expect(listData?.pages[0]?.total_count).toBe(500);
    expect(refreshedKeys).toEqual([queryKeys.system.stats]);
  });

  test("event data that is not a whole list row refreshes the email queries instead", () => {
    const { queryRefresher, refreshedKeys } = createRecordingRefresher();

    applyRealtimeEvents(new QueryClient(), queryRefresher, [
      buildEvent("email.received", { id: "email_1", subject: "Hi" }),
      buildEvent("email.opened", { id: "email_1" }),
    ]);

    expect(refreshedKeys).toEqual([
      queryKeys.emails.all,
      queryKeys.system.stats,
    ]);
  });

  test("PL-08.5 new emails then a prune in one flush refresh the lists the emails went into", () => {
    const queryClient = new QueryClient();
    const listKey = queryKeys.emails.infiniteList({ project: undefined });
    queryClient.setQueryData<InfiniteData<PageOf<EmailSummary>>>(listKey, {
      pages: [{ items: [], next_cursor: null, total_count: 0 }],
      pageParams: [undefined],
    });
    const { queryRefresher, refreshedKeys } = createRecordingRefresher();

    applyRealtimeEvents(queryClient, queryRefresher, [
      buildNewEmailEvent("Kept or pruned"),
      buildEvent("traffic.pruned", { pruned_count: 1 }),
    ]);

    expect(refreshedKeys).toContainEqual(queryKeys.emails.all);
    expect(refreshedKeys).toContainEqual(queryKeys.system.stats);
    expect(new Set(refreshedKeys.map((key) => JSON.stringify(key))).size).toBe(
      refreshedKeys.length,
    );
  });
});

describe("refreshAfterReconnect", () => {
  test("PL-02.5 after a reconnect every list is refreshed once", () => {
    const { queryRefresher, refreshedKeys } = createRecordingRefresher();

    refreshAfterReconnect(queryRefresher);

    expect(refreshedKeys).toEqual(listEveryRealtimeQueryKey());
    expect(refreshedKeys).toContainEqual(queryKeys.emails.all);
    expect(refreshedKeys).toContainEqual(queryKeys.sms.all);
    expect(new Set(refreshedKeys.map((key) => JSON.stringify(key))).size).toBe(
      refreshedKeys.length,
    );
  });
});
