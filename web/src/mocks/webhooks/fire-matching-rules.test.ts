import { describe, expect, test } from "vitest";

import type { AppEvent } from "@/lib/api/types";
import { mockDatabase, replaceMockDatabase } from "@/mocks/db/mock-database";
import { fireMatchingRules } from "@/mocks/webhooks/fire-matching-rules";
import { buildReplayDelivery } from "@/mocks/webhooks/replay-delivery";

function buildSmsStatusEvent(): AppEvent {
  const smsMessage = mockDatabase.smsMessages[0];
  if (smsMessage === undefined) {
    throw new Error("The fixtures need an SMS.");
  }

  return {
    id: "evt_test",
    type: "sms.status",
    created_at: new Date().toISOString(),
    data: { id: smsMessage.id, status: "delivered" },
  };
}

describe("fireMatchingRules", () => {
  test("creates one delivery per enabled matching rule", () => {
    replaceMockDatabase("standard");
    const deliveryCountBefore = mockDatabase.webhookDeliveries.length;

    fireMatchingRules(buildSmsStatusEvent());

    const newDelivery = mockDatabase.webhookDeliveries[0];
    expect(mockDatabase.webhookDeliveries).toHaveLength(
      deliveryCountBefore + 1,
    );
    expect(newDelivery).toMatchObject({
      event_type: "sms.status",
      trigger: "auto",
      attempt: 1,
    });
    expect(newDelivery?.endpoint_name).toBe("SMS status callbacks");
  });

  test("skips disabled rules and disabled endpoints", () => {
    replaceMockDatabase("standard");
    for (const webhookRule of mockDatabase.webhookRules) {
      webhookRule.is_enabled = false;
    }
    const deliveryCountBefore = mockDatabase.webhookDeliveries.length;

    fireMatchingRules(buildSmsStatusEvent());

    expect(mockDatabase.webhookDeliveries).toHaveLength(deliveryCountBefore);
  });

  test("ignores webhook events so a delivery never triggers another", () => {
    replaceMockDatabase("standard");
    const deliveryCountBefore = mockDatabase.webhookDeliveries.length;

    fireMatchingRules({ ...buildSmsStatusEvent(), type: "webhook.delivered" });

    expect(mockDatabase.webhookDeliveries).toHaveLength(deliveryCountBefore);
  });
});

describe("buildReplayDelivery", () => {
  test("WH-05.2 replays as-is, re-rendered or edited, and refuses unsent deliveries", () => {
    replaceMockDatabase("standard");
    const sentDelivery = mockDatabase.webhookDeliveries.find(
      (webhookDelivery) => webhookDelivery.request !== null,
    );
    const unsentDelivery = mockDatabase.webhookDeliveries.find(
      (webhookDelivery) => webhookDelivery.status === "render_failed",
    );
    if (sentDelivery?.request == null || unsentDelivery === undefined) {
      throw new Error("The fixtures need sent and unsent deliveries.");
    }

    const asIsReplay = buildReplayDelivery(sentDelivery, { rerender: false });
    const rerenderedReplay = buildReplayDelivery(sentDelivery, {
      rerender: true,
    });
    const editedReplay = buildReplayDelivery(sentDelivery, {
      rerender: false,
      body: '{"edited":true}',
      headers: { "x-test": "1" },
    });

    expect(asIsReplay?.request).toEqual(sentDelivery.request);
    expect(asIsReplay).toMatchObject({
      trigger: "replay",
      attempt: 1,
      status: "succeeded",
    });
    expect(rerenderedReplay?.request?.headers["webhook-id"]).toBe(
      rerenderedReplay?.event_id,
    );
    expect(editedReplay?.request).toMatchObject({
      body: '{"edited":true}',
      headers: { "x-test": "1" },
    });
    expect(buildReplayDelivery(unsentDelivery, { rerender: false })).toBeNull();
  });
});
