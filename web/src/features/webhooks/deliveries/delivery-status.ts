import type { DeliveryStatus, WebhookDelivery } from "@/lib/api/types";

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  pending: "Pending",
  render_failed: "Render failed",
  in_flight: "Sending",
  succeeded: "Succeeded",
  failed: "Failed",
  exhausted: "Exhausted",
  cancelled: "Cancelled",
};

export type DeliveryStatusFilter = "all" | "succeeded" | "failed" | "pending";

/** Status chips above the log and the statuses each one shows. */
export const deliveryStatusFilters: {
  statusFilter: DeliveryStatusFilter;
  label: string;
  statuses: DeliveryStatus[] | null;
}[] = [
  { statusFilter: "all", label: "All", statuses: null },
  { statusFilter: "succeeded", label: "Succeeded", statuses: ["succeeded"] },
  {
    statusFilter: "failed",
    label: "Failed",
    statuses: ["failed", "exhausted", "render_failed"],
  },
  {
    statusFilter: "pending",
    label: "Pending",
    statuses: ["pending", "in_flight"],
  },
];

/** True while the delivery will run again, so retries can be cancelled. */
export function isDeliveryRetrying(webhookDelivery: WebhookDelivery): boolean {
  if (webhookDelivery.status === "failed") {
    return webhookDelivery.next_attempt_at !== null;
  }

  return (
    webhookDelivery.status === "pending" ||
    webhookDelivery.status === "in_flight"
  );
}

/** "Failed, will retry" while another attempt is scheduled, else the plain label. */
export function describeDeliveryStatus(
  webhookDelivery: WebhookDelivery,
): string {
  if (
    webhookDelivery.status === "failed" &&
    webhookDelivery.next_attempt_at !== null
  ) {
    return "Failed, will retry";
  }

  return deliveryStatusLabels[webhookDelivery.status];
}
