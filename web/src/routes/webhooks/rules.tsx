import { createFileRoute } from "@tanstack/react-router";
import { ListChecksIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/webhooks/rules")({
  component: WebhookRulesPage,
});

function WebhookRulesPage() {
  return (
    <PagePlaceholder
      icon={ListChecksIcon}
      title="Webhook rules"
      description="Which events go to which endpoint, with a visual filter builder."
      plannedPhase="Phase U2"
    />
  );
}
