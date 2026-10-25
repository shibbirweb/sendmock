import { describe, expect, test } from "vitest";

import { createMockDatabase } from "@/mocks/db/mock-database";
import {
  maskEndpointSecret,
  presentWebhookEndpoint,
} from "@/mocks/webhooks/webhook-endpoint-record";

describe("presentWebhookEndpoint", () => {
  test("WH-01.3 never returns the plain secret", () => {
    const mockDatabase = createMockDatabase("standard");
    const [endpointRecord] = mockDatabase.webhookEndpoints;
    if (endpointRecord === undefined) {
      throw new Error("The fixtures need an endpoint.");
    }

    const presentedEndpoint = presentWebhookEndpoint(
      endpointRecord,
      mockDatabase.webhookDeliveries,
      Date.now(),
    );

    expect(JSON.stringify(presentedEndpoint)).not.toContain(
      endpointRecord.secret,
    );
    expect(presentedEndpoint.masked_secret).toBe(
      maskEndpointSecret(endpointRecord.secret),
    );
    expect(presentedEndpoint.masked_secret).toMatch(/^whsec_••••.{4}$/);
  });

  test("WH-01.7 gives 24 hourly success rates and the 24-hour delivery count", () => {
    const mockDatabase = createMockDatabase("standard");
    const [endpointRecord] = mockDatabase.webhookEndpoints;
    if (endpointRecord === undefined) {
      throw new Error("The fixtures need an endpoint.");
    }

    const presentedEndpoint = presentWebhookEndpoint(
      endpointRecord,
      mockDatabase.webhookDeliveries,
      Date.now(),
    );

    expect(presentedEndpoint.success_history).toHaveLength(24);
    expect(presentedEndpoint.delivery_count_24h).toBeGreaterThan(0);
    expect(
      presentedEndpoint.success_history.every(
        (successRate) =>
          successRate === null || (successRate >= 0 && successRate <= 1),
      ),
    ).toBe(true);
  });
});
