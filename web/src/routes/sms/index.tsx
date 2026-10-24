import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/sms/")({
  component: SmsPage,
});

function SmsPage() {
  return (
    <PagePlaceholder
      icon={MessageSquareIcon}
      title="SMS"
      description="Phone-style conversations for every SMS and WhatsApp message, with status ticks and inbound replies."
      plannedPhase="Phase U1"
    />
  );
}
