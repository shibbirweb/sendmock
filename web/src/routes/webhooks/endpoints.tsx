import { createFileRoute } from "@tanstack/react-router";

import { WebhookEndpointsPage } from "@/features/webhooks/endpoints/webhook-endpoints-page";

export const Route = createFileRoute("/webhooks/endpoints")({
  component: WebhookEndpointsPage,
});
