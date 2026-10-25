import { createFileRoute } from "@tanstack/react-router";

import { WebhookDeliveriesPage } from "@/features/webhooks/deliveries/webhook-deliveries-page";

export type WebhookDeliveriesSearchParams = {
  /** ID of the delivery whose detail is open. */
  delivery?: string;
};

export const Route = createFileRoute("/webhooks/deliveries")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): WebhookDeliveriesSearchParams => ({
    delivery:
      typeof searchParams.delivery === "string"
        ? searchParams.delivery
        : undefined,
  }),
  component: WebhookDeliveriesPage,
});
