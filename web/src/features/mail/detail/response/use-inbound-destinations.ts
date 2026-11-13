import * as React from "react";

import type { EmailComposerMode } from "@/features/mail/detail/response/email-composer-mode";
import { buildIncomingEmailPreview } from "@/features/mail/detail/response/incoming-email-preview";
import type { EmailResponseFormValues } from "@/features/mail/detail/response/use-email-response-form";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInboundRouteMatch } from "@/lib/api/hooks/use-inbound-route-queries";
import type {
  EmailDetail,
  InboundRouteMatchRequest,
  InboundRouteMatchResult,
} from "@/lib/api/types";

/** Waits for a pause in typing before asking where the Forward address goes. */
const matchDebounceMs = 300;

export type InboundDestinations = {
  /** The address the incoming email arrives at; empty until Forward has one. */
  recipientAddress: string;
  matchResult: InboundRouteMatchResult | undefined;
  isChecking: boolean;
  /** True when a route or rule will receive the email. */
  hasDestinations: boolean;
};

/** What will receive the reply or forward, before it is sent (EM-22.3). */
export function useInboundDestinations({
  email,
  composerMode,
  formValues,
}: {
  email: EmailDetail;
  composerMode: EmailComposerMode;
  formValues: EmailResponseFormValues;
}): InboundDestinations {
  // Compared as text, since a fresh object each render would never settle.
  const matchRequestText = useDebouncedValue(
    JSON.stringify(buildIncomingEmailPreview(email, composerMode, formValues)),
    matchDebounceMs,
  );
  const matchRequest = React.useMemo(
    () => JSON.parse(matchRequestText) as InboundRouteMatchRequest,
    [matchRequestText],
  );
  const recipientAddress = matchRequest.to[0] ?? "";
  const matchQuery = useInboundRouteMatch(
    matchRequest,
    recipientAddress !== "",
  );
  const matchResult = recipientAddress === "" ? undefined : matchQuery.data;

  return {
    recipientAddress,
    matchResult,
    isChecking: recipientAddress !== "" && matchQuery.isPending,
    hasDestinations:
      matchResult !== undefined &&
      (matchResult.routes.length > 0 || matchResult.webhook_rules.length > 0),
  };
}
