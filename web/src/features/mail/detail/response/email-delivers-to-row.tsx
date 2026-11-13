import { Link } from "@tanstack/react-router";
import { SendIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  type InboundDestination,
  listInboundDestinations,
} from "@/features/mail/detail/response/list-inbound-destinations";
import { SendRepliesToAppForm } from "@/features/mail/detail/response/send-replies-to-app-form";
import type { InboundDestinations } from "@/features/mail/detail/response/use-inbound-destinations";
import type { WebhookTarget } from "@/features/webhooks/targets/list-webhook-targets";

function DestinationLink({ destination }: { destination: InboundDestination }) {
  const linkContent = (
    <>
      <span className="font-mono text-xs break-all">{destination.target}</span>
      <span className="text-xs text-muted-foreground">
        {destination.sourceLabel}
      </span>
    </>
  );
  const linkClassName = "flex flex-wrap items-baseline gap-x-2 hover:underline";

  if (destination.source.kind === "chosen") {
    return (
      <Link
        to="/webhooks/endpoints"
        search={{ endpoint: destination.source.endpointId }}
        target="_blank"
        rel="noopener"
        className={linkClassName}
      >
        {linkContent}
      </Link>
    );
  }

  return destination.source.kind === "route" ? (
    <Link
      to="/webhooks/inbound-routes"
      search={{ route: destination.source.routeId }}
      className={linkClassName}
    >
      {linkContent}
    </Link>
  ) : (
    <Link
      to="/webhooks/rules"
      search={{ endpoint: destination.source.endpointId }}
      className={linkClassName}
    >
      {linkContent}
    </Link>
  );
}

/**
 * "Delivers to" above the composer's buttons: each URL or address a matching
 * route or webhook rule sends the incoming email to (EM-22.3), or a one-step
 * route to your app when nothing would (EM-22.4).
 */
export function EmailDeliversToRow({
  inboundDestinations,
  chosenTargets,
}: {
  inboundDestinations: InboundDestinations;
  /** The endpoints chosen for this send, shown instead of the rule matches. */
  chosenTargets: WebhookTarget[] | null;
}) {
  const [isFormOpen, setFormOpen] = React.useState(false);
  const { matchResult, recipientAddress, isChecking } = inboundDestinations;
  if (recipientAddress === "") {
    return null;
  }
  const destinations =
    matchResult === undefined
      ? []
      : listInboundDestinations(matchResult, chosenTargets);
  const hasNoDestination =
    matchResult !== undefined &&
    (chosenTargets === null
      ? !inboundDestinations.hasDestinations
      : matchResult.routes.length === 0 && chosenTargets.length === 0);

  return (
    <div
      role="group"
      aria-label="Delivers to"
      className="grid gap-2 rounded-md border border-dashed px-3 py-2 text-sm"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="shrink-0 text-muted-foreground">Delivers to:</span>
        {isChecking && (
          <span className="text-xs text-muted-foreground">Checking...</span>
        )}
        {hasNoDestination && (
          <>
            <span>Nothing receives this yet</span>
            {!isFormOpen && (
              <Button
                size="sm"
                variant="outline"
                className="sm:ml-auto"
                onClick={() => setFormOpen(true)}
              >
                <SendIcon />
                Send replies to your app
              </Button>
            )}
          </>
        )}
      </div>
      {destinations.length > 0 && (
        <ul className="grid gap-1">
          {destinations.map((destination) => (
            <li key={destination.key}>
              <DestinationLink destination={destination} />
            </li>
          ))}
        </ul>
      )}
      {hasNoDestination && isFormOpen && (
        <SendRepliesToAppForm
          recipientAddress={recipientAddress}
          onDone={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}
