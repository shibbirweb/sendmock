import { createFileRoute } from "@tanstack/react-router";
import { VariableIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/webhooks/variables")({
  component: WebhookVariablesPage,
});

function WebhookVariablesPage() {
  return (
    <PagePlaceholder
      icon={VariableIcon}
      title="Webhook variables"
      description="Static, secret, dynamic, random, computed and prompt variables for templates."
      plannedPhase="Phase U2"
    />
  );
}
