import { createFileRoute } from "@tanstack/react-router";
import { ActivityIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export type WebhookDeliveriesSearchParams = {
  /** ID of the delivery to open, linked from the Overview's recent failures. */
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

function WebhookDeliveriesPage() {
  return (
    <PagePlaceholder
      icon={ActivityIcon}
      title="Webhook deliveries"
      description="Live log of every delivery with request, response, replay and retry controls."
      plannedPhase="Phase U2"
    />
  );
}
