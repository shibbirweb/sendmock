import { describe, expect, test } from "vitest";

import {
  describeEventForToast,
  listQueryKeysToRefresh,
} from "@/features/realtime/realtime-event-effects";
import { queryKeys } from "@/lib/api/query-keys";

describe("listQueryKeysToRefresh", () => {
  test("PL-02.1 an email event refreshes email lists and stats", () => {
    expect(listQueryKeysToRefresh("email.received")).toEqual([
      queryKeys.emails.all,
      queryKeys.system.stats,
    ]);
  });

  test("a Verify event also refreshes SMS, where codes are delivered", () => {
    expect(listQueryKeysToRefresh("verify.started")).toContainEqual(
      queryKeys.sms.all,
    );
  });

  test("an event outside every area refreshes nothing", () => {
    expect(listQueryKeysToRefresh("test.ping")).toEqual([]);
  });
});

describe("describeEventForToast", () => {
  test("announces a new email with its subject", () => {
    expect(
      describeEventForToast({
        id: "evt_1",
        type: "email.received",
        created_at: "2026-10-24T16:00:00Z",
        data: { subject: "Your verification code" },
      }),
    ).toEqual({ title: "New email", description: "Your verification code" });
  });

  test("stays quiet for events that are not worth a notification", () => {
    expect(
      describeEventForToast({
        id: "evt_2",
        type: "webhook.delivered",
        created_at: "2026-10-24T16:00:00Z",
        data: {},
      }),
    ).toBeNull();
  });
});
