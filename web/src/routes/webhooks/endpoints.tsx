import { createFileRoute } from "@tanstack/react-router";
import { SendIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/webhooks/endpoints")({
  component: WebhookEndpointsPage,
});

function WebhookEndpointsPage() {
  return (
    <PagePlaceholder
      icon={SendIcon}
      title="Webhook endpoints"
      description="Where mss sends webhooks: URL, template, secret and retry policy."
      plannedPhase="Phase U2"
    />
  );
}
