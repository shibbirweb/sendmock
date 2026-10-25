import { describe, expect, test } from "vitest";

import {
  describeEventForNotification,
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

describe("describeEventForNotification", () => {
  test("UI-08.3 a new email links to it, with its subject", () => {
    expect(
      describeEventForNotification({
        id: "evt_1",
        type: "email.received",
        created_at: "2026-10-24T16:00:00Z",
        data: { id: "01EMAIL", subject: "Your verification code" },
      }),
    ).toEqual({
      area: "email",
      title: "New email",
      description: "Your verification code",
      link: { kind: "email", emailId: "01EMAIL" },
    });
  });

  test("UI-08.3 SMS link to their conversation and failed webhooks to the delivery", () => {
    expect(
      describeEventForNotification({
        id: "evt_2",
        type: "sms.inbound",
        created_at: "2026-10-24T16:00:00Z",
        data: {
          from_number: "+8801711111111",
          body: "YES",
          thread_id: "+1555|+880",
        },
      }),
    ).toMatchObject({
      title: "Inbound SMS from +8801711111111",
      description: "YES",
      link: { kind: "sms", threadId: "+1555|+880" },
    });
    expect(
      describeEventForNotification({
        id: "evt_3",
        type: "webhook.failed",
        created_at: "2026-10-24T16:00:00Z",
        data: {
          id: "01DELIVERY",
          endpoint_name: "Laravel",
          event_type: "sms.status",
        },
      }),
    ).toEqual({
      area: "webhook",
      title: "Webhook delivery failed",
      description: "Laravel, sms.status",
      link: { kind: "delivery", deliveryId: "01DELIVERY" },
    });
  });

  test("stays quiet for events that are not worth a notification", () => {
    expect(
      describeEventForNotification({
        id: "evt_4",
        type: "webhook.delivered",
        created_at: "2026-10-24T16:00:00Z",
        data: {},
      }),
    ).toBeNull();
  });
});
