import { describe, expect, test } from "vitest";

import { createMockDatabase } from "@/mocks/db/mock-database";
import { buildSavedSendDelivery } from "@/mocks/webhooks/send-saved-delivery";

describe("buildSavedSendDelivery", () => {
  test("WH-10.2 sends the stored body to the picked endpoint, re-signed when re-rendered", () => {
    const mockDatabase = createMockDatabase("standard");
    const [savedDelivery] = mockDatabase.savedDeliveries;
    const slackEndpoint = mockDatabase.webhookEndpoints.find(
      (endpointRecord) => endpointRecord.name === "Team Slack alerts",
    );
    if (savedDelivery === undefined || slackEndpoint === undefined) {
      throw new Error(
        "The fixtures need a saved delivery and the Slack endpoint.",
      );
    }

    const plainSend = buildSavedSendDelivery(
      savedDelivery,
      slackEndpoint,
      false,
    );
    const rerenderedSend = buildSavedSendDelivery(
      savedDelivery,
      slackEndpoint,
      true,
    );

    expect(plainSend.request).toMatchObject({
      url: slackEndpoint.url,
      method: slackEndpoint.method,
      body: savedDelivery.request.body,
    });
    expect(plainSend).toMatchObject({
      trigger: "manual",
      endpoint_id: slackEndpoint.id,
      event_type: "sms.inbound",
    });
    expect(plainSend.request?.headers["webhook-signature"]).toBeUndefined();
    expect(rerenderedSend.request?.headers["webhook-id"]).toBe(
      rerenderedSend.event_id,
    );
  });
});
