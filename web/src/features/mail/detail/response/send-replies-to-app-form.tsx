import { Link } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/form-field";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveInboundRoute } from "@/lib/api/hooks/use-inbound-route-queries";
import type { InboundRouteInput } from "@/lib/api/types";
import { buildExactAddressPattern } from "@/lib/inbound-routes/escape-route-pattern";
import { validateInboundRoute } from "@/lib/inbound-routes/validate-inbound-route";

type RouteScope = "recipient" | "every_email";

/** The editor's default priority, so a quick route sorts like one made there. */
const quickRoutePriority = 10;

export function buildQuickRouteInput(
  appUrl: string,
  routeScope: RouteScope,
  recipientAddress: string,
): InboundRouteInput {
  const isEveryEmail = routeScope === "every_email";

  return {
    priority: quickRoutePriority,
    description: isEveryEmail
      ? "Every incoming email to my app"
      : `Mail to ${recipientAddress} to my app`,
    filter: isEveryEmail
      ? { kind: "catch_all" }
      : {
          kind: "match_recipient",
          pattern: buildExactAddressPattern(recipientAddress),
        },
    actions: [{ kind: "forward_url", url: appUrl.trim() }],
  };
}

/**
 * One-step route to your app's URL, shown when nothing receives the email
 * yet (EM-22.4); the full editor is in Webhooks > Inbound routes.
 */
export function SendRepliesToAppForm({
  recipientAddress,
  onDone,
}: {
  recipientAddress: string;
  onDone: () => void;
}) {
  const appUrlFieldId = React.useId();
  const saveRoute = useSaveInboundRoute();
  const [appUrl, setAppUrl] = React.useState("");
  const [routeScope, setRouteScope] = React.useState<RouteScope>("recipient");
  const [hasTriedSaving, setHasTriedSaving] = React.useState(false);
  const routeInput = buildQuickRouteInput(appUrl, routeScope, recipientAddress);
  const urlError =
    appUrl.trim() === ""
      ? "Enter your app's URL"
      : validateInboundRoute(routeInput)["actions.0"];

  const createRoute = () => {
    setHasTriedSaving(true);
    if (urlError !== undefined) {
      return;
    }

    saveRoute.mutate(
      { routeId: null, routeInput },
      {
        onSuccess: () => {
          toast("Route created", {
            description: `Incoming email now goes to ${appUrl.trim()}.`,
          });
          onDone();
        },
        onError: () => {
          toast.error("Could not create the route");
        },
      },
    );
  };

  return (
    <div
      role="group"
      aria-label="Send replies to your app"
      className="grid gap-3 rounded-md border bg-muted/30 p-3"
    >
      <FormField
        label="Your app's URL"
        fieldId={appUrlFieldId}
        hint="Receives each incoming email as Mailgun posts it."
        errorMessage={hasTriedSaving ? urlError : undefined}
      >
        <Input
          id={appUrlFieldId}
          type="url"
          placeholder="http://localhost:8000/webhooks/mail"
          value={appUrl}
          onChange={(changeEvent) => {
            setAppUrl(changeEvent.target.value);
          }}
          onKeyDown={(keyEvent) => {
            if (keyEvent.key === "Enter") {
              keyEvent.preventDefault();
              createRoute();
            }
          }}
        />
      </FormField>
      <RadioCardGroup
        legend="Which incoming email"
        selectedValue={routeScope}
        onSelect={setRouteScope}
        options={[
          {
            value: "recipient",
            label: `Only mail to ${recipientAddress}`,
            description: "A match_recipient() route for this address.",
          },
          {
            value: "every_email",
            label: "Every incoming email",
            description: "A catch_all() route.",
          },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={saveRoute.isPending} onClick={createRoute}>
          Create route
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Link
          to="/webhooks/inbound-routes"
          className="text-xs text-muted-foreground hover:underline sm:ml-auto"
        >
          More options in Webhooks &gt; Inbound routes
        </Link>
      </div>
    </div>
  );
}
