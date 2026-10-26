import { createFileRoute } from "@tanstack/react-router";

import { MessageProvidersPage } from "@/features/providers/message-providers-page";

function EmailProvidersPage() {
  return <MessageProvidersPage providerArea="email" />;
}

/** Outside the Mail layout (`mail_`), so the inbox list does not wrap it. */
export const Route = createFileRoute("/mail_/providers")({
  component: EmailProvidersPage,
});
