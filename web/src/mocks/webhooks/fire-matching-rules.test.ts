import { describe, expect, test } from "vitest";

import type { AppEvent } from "@/lib/api/types";
import { mockDatabase, replaceMockDatabase } from "@/mocks/db/mock-database";
import { fireMatchingRules } from "@/mocks/webhooks/fire-matching-rules";
import { matchWebhookRules } from "@/mocks/webhooks/match-webhook-rules";
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

  test("WH-13.4 a chosen action delivers to exactly the chosen enabled endpoints", () => {
    replaceMockDatabase("standard");
    const [firstEndpoint, secondEndpoint] = mockDatabase.webhookEndpoints;
    if (firstEndpoint === undefined || secondEndpoint === undefined) {
      throw new Error("The fixtures need two endpoints.");
    }
    firstEndpoint.is_enabled = true;
    secondEndpoint.is_enabled = true;
    const deliveryCountBefore = mockDatabase.webhookDeliveries.length;

    fireMatchingRules(buildSmsStatusEvent(), {
      endpointIds: [firstEndpoint.id, secondEndpoint.id],
      editedRequests: [],
    });

    const newDeliveries = mockDatabase.webhookDeliveries.slice(0, 2);
    expect(mockDatabase.webhookDeliveries).toHaveLength(
      deliveryCountBefore + 2,
    );
    expect(
      newDeliveries.map((webhookDelivery) => webhookDelivery.endpoint_id),
    ).toEqual([secondEndpoint.id, firstEndpoint.id]);
    expect(
      newDeliveries.every(
        (webhookDelivery) =>
          webhookDelivery.trigger === "chosen" &&
          webhookDelivery.rule_id === null,
      ),
    ).toBe(true);
  });

  test("WH-14.3 an edited payload is delivered exactly as written and marked edited", () => {
    replaceMockDatabase("standard");
    const [chosenEndpoint, otherEndpoint] = mockDatabase.webhookEndpoints;
    if (chosenEndpoint === undefined || otherEndpoint === undefined) {
      throw new Error("The fixtures need two endpoints.");
    }
    chosenEndpoint.is_enabled = true;
    otherEndpoint.is_enabled = true;
    const editedBody = '{"edited":true,"note":"  kept as typed "}';

    fireMatchingRules(buildSmsStatusEvent(), {
      endpointIds: [chosenEndpoint.id, otherEndpoint.id],
      editedRequests: [
        {
          endpoint_id: chosenEndpoint.id,
          event_type: "sms.status",
          body: editedBody,
          headers: { "x-tenant": "acme" },
        },
      ],
    });

    const [otherDelivery, chosenDelivery] = mockDatabase.webhookDeliveries;
    expect(chosenDelivery?.request?.body).toBe(editedBody);
    expect(chosenDelivery?.request?.headers["x-tenant"]).toBe("acme");
    expect(chosenDelivery?.is_edited).toBe(true);
    expect(otherDelivery?.request?.body).not.toBe(editedBody);
    expect(otherDelivery?.is_edited).toBe(false);
  });

  test("WH-14.4 an edit for another event leaves this one rendered", () => {
    replaceMockDatabase("standard");
    const [chosenEndpoint] = mockDatabase.webhookEndpoints;
    if (chosenEndpoint === undefined) {
      throw new Error("The fixtures need an endpoint.");
    }
    chosenEndpoint.is_enabled = true;

    fireMatchingRules(buildSmsStatusEvent(), {
      endpointIds: [chosenEndpoint.id],
      editedRequests: [
        {
          endpoint_id: chosenEndpoint.id,
          event_type: "sms.opened",
          body: "edited",
        },
      ],
    });

    expect(mockDatabase.webhookDeliveries[0]?.is_edited).toBe(false);
  });

  test("WH-14.1 the match renders each endpoint's request and stores nothing", () => {
    replaceMockDatabase("standard");
    const [chosenEndpoint] = mockDatabase.webhookEndpoints;
    if (chosenEndpoint === undefined) {
      throw new Error("The fixtures need an endpoint.");
    }
    chosenEndpoint.is_enabled = true;
    const smsStatusEvent = buildSmsStatusEvent();
    const deliveryCountBefore = mockDatabase.webhookDeliveries.length;

    const matched = matchWebhookRules({
      event_type: "sms.status",
      subject_id: String(smsStatusEvent.data.id),
      include_requests: true,
      webhook_endpoint_ids: [chosenEndpoint.id],
    });

    const shownEndpointIds = (matched.webhook_requests ?? []).map(
      (matchedRequest) => matchedRequest.endpoint_id,
    );
    expect(shownEndpointIds).toContain(chosenEndpoint.id);
    for (const matchedRule of matched.webhook_rules) {
      expect(shownEndpointIds).toContain(matchedRule.endpoint_id);
    }
    const chosenRequest = matched.webhook_requests?.find(
      (matchedRequest) => matchedRequest.endpoint_id === chosenEndpoint.id,
    );
    expect(chosenRequest?.event_type).toBe("sms.status");
    expect(chosenRequest?.method).toBe(chosenEndpoint.method);
    expect(mockDatabase.webhookDeliveries).toHaveLength(deliveryCountBefore);
  });

  test("WH-14.1 the match leaves requests out unless asked", () => {
    replaceMockDatabase("standard");

    const matched = matchWebhookRules({ event_type: "sms.status" });

    expect(matched.webhook_requests).toBeUndefined();
  });

  test("WH-13.4 an empty choice sends no webhook", () => {
    replaceMockDatabase("standard");
    const deliveryCountBefore = mockDatabase.webhookDeliveries.length;

    fireMatchingRules(buildSmsStatusEvent(), {
      endpointIds: [],
      editedRequests: [],
    });

    expect(mockDatabase.webhookDeliveries).toHaveLength(deliveryCountBefore);
  });

  test("WH-13.1 the match names what firing the same event then delivers to", () => {
    replaceMockDatabase("standard");
    const smsStatusEvent = buildSmsStatusEvent();
    const matched = matchWebhookRules({
      event_type: "sms.status",
      subject_id: String(smsStatusEvent.data.id),
    });
    const deliveryCountBefore = mockDatabase.webhookDeliveries.length;

    fireMatchingRules(smsStatusEvent);

    const newDeliveries = mockDatabase.webhookDeliveries.slice(
      0,
      mockDatabase.webhookDeliveries.length - deliveryCountBefore,
    );
    expect(matched.webhook_rules.length).toBeGreaterThan(0);
    expect(
      newDeliveries
        .map((webhookDelivery) => webhookDelivery.endpoint_id)
        .sort(),
    ).toEqual(
      matched.webhook_rules
        .map((matchedRule) => matchedRule.endpoint_id)
        .sort(),
    );
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
