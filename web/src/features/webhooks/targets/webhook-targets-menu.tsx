import * as React from "react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  useWebhookTargets,
  type WebhookTargetEvent,
} from "@/features/webhooks/targets/use-webhook-targets";
import {
  type WebhookTargetsPickerRequest,
  WebhookTargetsPicker,
} from "@/features/webhooks/targets/webhook-targets-picker";
import type { WebhookChoice } from "@/lib/api/types";

type OpenPicker = (pickerRequest: WebhookTargetsPickerRequest) => void;

const PickerOpenerContext = React.createContext<OpenPicker | null>(null);

/**
 * Wraps a simulate menu so its items can open the picker: a menu unmounts
 * its items when it closes, so the picker lives here, outside it.
 */
export function WebhookTargetsMenuScope({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pickerRequest, setPickerRequest] =
    React.useState<WebhookTargetsPickerRequest | null>(null);

  return (
    <PickerOpenerContext.Provider value={setPickerRequest}>
      {children}
      <WebhookTargetsPicker
        pickerRequest={pickerRequest}
        onClose={() => {
          setPickerRequest(null);
        }}
      />
    </PickerOpenerContext.Provider>
  );
}

/** "Webhooks: Receipts, Audit" or "No webhook" under a menu item's label. */
function describeTargets(
  webhookTargets: ReturnType<typeof useWebhookTargets>,
): string {
  if (webhookTargets.isChecking) {
    return "Checking webhooks...";
  }
  if (webhookTargets.targets.length === 0) {
    return "No webhook";
  }

  return `Webhooks: ${webhookTargets.targets
    .map((webhookTarget) => webhookTarget.endpointName)
    .join(", ")}`;
}

/**
 * A simulate menu item that names the webhooks its event will trigger under
 * its label, with Choose beside it to send to others for this action only
 * (WH-13.2, WH-13.4). Picking the item itself lets the rules decide.
 */
export function WebhookTargetsMenuItem({
  targetEvent,
  actionLabel,
  onSimulate,
  children,
}: {
  targetEvent: WebhookTargetEvent;
  actionLabel: string;
  onSimulate: (webhookChoice: WebhookChoice) => void;
  children: React.ReactNode;
}) {
  const openPicker = React.useContext(PickerOpenerContext);
  const webhookTargets = useWebhookTargets(targetEvent);
  const labelId = React.useId();
  const targetsHintId = React.useId();

  return (
    <div className="flex items-stretch gap-0.5">
      {/* The action is the item's name and its webhooks the description, so
          a screen reader announces "Hard bounce", then where it goes. */}
      <DropdownMenuItem
        className="flex-1"
        aria-labelledby={labelId}
        aria-describedby={webhookTargets.isShown ? targetsHintId : undefined}
        onSelect={() => {
          onSimulate({});
        }}
      >
        <div className="grid min-w-0 gap-0.5">
          <span id={labelId} className="flex items-center gap-2">
            {children}
          </span>
          {webhookTargets.isShown && (
            <span
              id={targetsHintId}
              className="truncate text-xs text-muted-foreground"
            >
              {describeTargets(webhookTargets)}
            </span>
          )}
        </div>
      </DropdownMenuItem>
      {webhookTargets.isShown && openPicker !== null && (
        <DropdownMenuItem
          aria-label={`Choose webhooks for ${actionLabel}`}
          className="shrink-0 text-xs text-muted-foreground"
          onSelect={() => {
            openPicker({
              actionLabel,
              eventType: targetEvent.eventType,
              initialEndpointIds: webhookTargets.matchedEndpointIds,
              confirmLabel: actionLabel,
              onConfirm: (endpointIds) => {
                onSimulate({ webhook_endpoint_ids: endpointIds });
              },
            });
          }}
        >
          Choose
        </DropdownMenuItem>
      )}
    </div>
  );
}
