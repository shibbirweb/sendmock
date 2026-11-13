import * as React from "react";

import { Button } from "@/components/ui/button";
import type { WebhookTargetsState } from "@/features/webhooks/targets/use-webhook-targets";
import { WebhookTargetLinks } from "@/features/webhooks/targets/webhook-target-links";
import {
  type WebhookTargetsPickerRequest,
  WebhookTargetsPicker,
} from "@/features/webhooks/targets/webhook-targets-picker";

/**
 * "Webhooks" above a composer's buttons: the endpoints the action's event
 * will reach, with Change to pick others for this action only (WH-13.2,
 * WH-13.4).
 */
export function WebhookTargetsRow({
  webhookTargets,
  actionLabel,
  heading = "Webhooks:",
}: {
  webhookTargets: WebhookTargetsState;
  actionLabel: string;
  /** Defaults to "Webhooks:"; say which variant is previewed when there are several. */
  heading?: string;
}) {
  const [pickerRequest, setPickerRequest] =
    React.useState<WebhookTargetsPickerRequest | null>(null);
  if (!webhookTargets.isShown) {
    return null;
  }
  const isChosen = webhookTargets.chosenEndpointIds !== null;

  return (
    <div
      role="group"
      aria-label="Webhooks"
      className="grid gap-2 rounded-md border border-dashed px-3 py-2 text-sm"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="shrink-0 text-muted-foreground">{heading}</span>
        {webhookTargets.isChecking ? (
          <span className="text-xs text-muted-foreground">Checking...</span>
        ) : (
          <WebhookTargetLinks targets={webhookTargets.targets} />
        )}
        {isChosen && (
          <span className="text-xs text-muted-foreground">
            (chosen for this action)
          </span>
        )}
        <div className="flex gap-1 sm:ml-auto">
          {isChosen && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                webhookTargets.chooseEndpoints(null);
              }}
            >
              Use the rules
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPickerRequest({
                actionLabel,
                eventType: webhookTargets.eventType,
                initialEndpointIds:
                  webhookTargets.chosenEndpointIds ??
                  webhookTargets.matchedEndpointIds,
                confirmLabel: "Use these",
                onConfirm: webhookTargets.chooseEndpoints,
              });
            }}
          >
            Change
          </Button>
        </div>
      </div>
      <WebhookTargetsPicker
        pickerRequest={pickerRequest}
        onClose={() => {
          setPickerRequest(null);
        }}
      />
    </div>
  );
}
