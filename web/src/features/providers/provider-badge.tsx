import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { useMessageProviders } from "@/lib/api/hooks/use-message-provider-queries";
import type { MessageProviderArea } from "@/lib/api/types";

/**
 * The provider a message was sent through, as a badge that opens its sheet
 * (docs/plan/22, Elsewhere). A provider that no longer exists shows its key
 * and "deleted provider".
 */
export function ProviderBadge({
  providerArea,
  providerKey,
}: {
  providerArea: MessageProviderArea;
  providerKey: string;
}) {
  const messageProvider = (useMessageProviders(providerArea).data ?? []).find(
    (candidate) => candidate.key === providerKey,
  );
  if (messageProvider === undefined) {
    return (
      <Badge variant="outline" title="This provider was deleted">
        {providerKey} (deleted provider)
      </Badge>
    );
  }

  return (
    <Badge variant="outline" asChild>
      <Link
        to={providerArea === "email" ? "/mail/providers" : "/sms/providers"}
        search={{ provider: providerKey }}
        title={`Open ${messageProvider.name} in ${providerArea === "email" ? "Mail" : "SMS"} > Providers`}
      >
        <span
          aria-hidden="true"
          className="size-2 rounded-full"
          style={{ backgroundColor: messageProvider.accent }}
        />
        {messageProvider.name}
      </Link>
    </Badge>
  );
}
