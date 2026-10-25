import { createFileRoute } from "@tanstack/react-router";

import { WebhookEndpointsPage } from "@/features/webhooks/endpoints/webhook-endpoints-page";

export type WebhookEndpointsSearchParams = {
  /** Opens the add sheet with this template chosen ("Use in new endpoint"). */
  template?: string;
};

export const Route = createFileRoute("/webhooks/endpoints")({
  validateSearch: (searchParams: Record<string, unknown>): WebhookEndpointsSearchParams => ({
    template: typeof searchParams.template === "string" ? searchParams.template : undefined,
  }),
  component: WebhookEndpointsPage,
});
