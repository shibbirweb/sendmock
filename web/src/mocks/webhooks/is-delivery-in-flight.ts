import type { WebhookDelivery } from "@/lib/api/types";

const retryingStatuses: WebhookDelivery["status"][] = [
  "pending",
  "in_flight",
  "failed",
];

/**
 * Queued, being sent, or failed with a retry still due: cancel can stop it, and
 * delete leaves it alone. A failed delivery retries while it has a next attempt time.
 */
export function isDeliveryInFlight(webhookDelivery: WebhookDelivery): boolean {
  return (
    retryingStatuses.includes(webhookDelivery.status) &&
    (webhookDelivery.status !== "failed" ||
      webhookDelivery.next_attempt_at !== null)
  );
}
