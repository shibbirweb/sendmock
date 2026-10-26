import { createFileRoute } from "@tanstack/react-router";

import { MessageProvidersPage } from "@/features/providers/message-providers-page";

function SmsProvidersPage() {
  return <MessageProvidersPage providerArea="sms" />;
}

export const Route = createFileRoute("/sms/providers")({
  component: SmsProvidersPage,
});
