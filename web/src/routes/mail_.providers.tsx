import { createFileRoute } from "@tanstack/react-router";

import { MessageProvidersPage } from "@/features/providers/message-providers-page";
import { readProviderSearch } from "@/features/providers/provider-search";

function EmailProvidersPage() {
  const { provider } = Route.useSearch();

  return (
    <MessageProvidersPage providerArea="email" initialProviderKey={provider} />
  );
}

/** Outside the Mail layout (`mail_`), so the inbox list does not wrap it. */
export const Route = createFileRoute("/mail_/providers")({
  validateSearch: readProviderSearch,
  component: EmailProvidersPage,
});
