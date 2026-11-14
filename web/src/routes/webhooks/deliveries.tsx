import { createFileRoute } from "@tanstack/react-router";

import { WebhookDeliveriesPage } from "@/features/webhooks/deliveries/webhook-deliveries-page";

export type WebhookDeliveriesSearchParams = {
  /** ID of the delivery whose detail is open. */
  delivery?: string;
  /** Initial status chip, e.g. from the Webhooks overview. */
  status?: "failed";
  /** Initial endpoint filter. */
  endpoint?: string;
};

export const Route = createFileRoute("/webhooks/deliveries")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): WebhookDeliveriesSearchParams => ({
    delivery:
      typeof searchParams.delivery === "string"
        ? searchParams.delivery
        : undefined,
    status: searchParams.status === "failed" ? "failed" : undefined,
    endpoint:
      typeof searchParams.endpoint === "string"
        ? searchParams.endpoint
        : undefined,
  }),
  component: WebhookDeliveriesPage,
});
