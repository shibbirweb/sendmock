import { createFileRoute } from "@tanstack/react-router";
import { FileCode2Icon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/webhooks/templates")({
  component: WebhookTemplatesPage,
});

function WebhookTemplatesPage() {
  return (
    <PagePlaceholder
      icon={FileCode2Icon}
      title="Webhook templates"
      description="Built-in payload templates for Twilio, Mailgun, SendGrid, Slack and more, plus your own."
      plannedPhase="Phase U2"
    />
  );
}
