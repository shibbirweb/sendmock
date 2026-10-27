import { createFileRoute } from "@tanstack/react-router";

import { MessageProvidersPage } from "@/features/providers/message-providers-page";
import { readProviderSearch } from "@/features/providers/provider-search";

function SmsProvidersPage() {
  const { provider } = Route.useSearch();

  return (
    <MessageProvidersPage providerArea="sms" initialProviderKey={provider} />
  );
}

export const Route = createFileRoute("/sms/providers")({
  validateSearch: readProviderSearch,
  component: SmsProvidersPage,
});
