import { createFileRoute } from "@tanstack/react-router";
import { ActivityIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/webhooks/deliveries")({
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
