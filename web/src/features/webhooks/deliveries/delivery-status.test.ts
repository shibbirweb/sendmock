import { describe, expect, test } from "vitest";

import {
  describeDeliveryStatus,
  isDeliveryRetrying,
} from "@/features/webhooks/deliveries/delivery-status";
import type { WebhookDelivery } from "@/lib/api/types";

function buildDelivery(
  deliveryFields: Partial<WebhookDelivery>,
): WebhookDelivery {
  return {
    status: "failed",
    next_attempt_at: null,
    ...deliveryFields,
  } as WebhookDelivery;
}

describe("delivery status", () => {
  test("WH-03.9 only a delivery with a next attempt, or still pending, is retrying", () => {
    expect(
      isDeliveryRetrying(
        buildDelivery({ next_attempt_at: "2026-10-25T10:00:00Z" }),
      ),
    ).toBe(true);
    expect(isDeliveryRetrying(buildDelivery({}))).toBe(false);
    expect(isDeliveryRetrying(buildDelivery({ status: "pending" }))).toBe(true);
    expect(isDeliveryRetrying(buildDelivery({ status: "exhausted" }))).toBe(
      false,
    );
    expect(isDeliveryRetrying(buildDelivery({ status: "cancelled" }))).toBe(
      false,
    );
  });

  test("says will retry only while a retry is scheduled", () => {
    expect(
      describeDeliveryStatus(
        buildDelivery({ next_attempt_at: "2026-10-25T10:00:00Z" }),
      ),
    ).toBe("Failed, will retry");
    expect(describeDeliveryStatus(buildDelivery({}))).toBe("Failed");
    expect(
      describeDeliveryStatus(buildDelivery({ status: "render_failed" })),
    ).toBe("Render failed");
  });
});
