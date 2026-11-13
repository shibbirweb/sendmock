import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  useWebhookTargets,
  type WebhookTargetEvent,
} from "@/features/webhooks/targets/use-webhook-targets";
import { WebhookTargetLinks } from "@/features/webhooks/targets/webhook-target-links";
import {
  type WebhookTargetsPickerRequest,
  WebhookTargetsPicker,
} from "@/features/webhooks/targets/webhook-targets-picker";
import type { WebhookChoice } from "@/lib/api/types";

/**
 * Under a one-click action such as Send sample: the webhooks its event will
 * trigger, and Choose to run it once with others (WH-13.2, WH-13.4).
 */
export function WebhookTargetsInline({
  targetEvent,
  actionLabel,
  onRun,
}: {
  targetEvent: WebhookTargetEvent;
  actionLabel: string;
  onRun: (webhookChoice: WebhookChoice) => void;
}) {
  const webhookTargets = useWebhookTargets(targetEvent);
  const [pickerRequest, setPickerRequest] =
    React.useState<WebhookTargetsPickerRequest | null>(null);
  if (!webhookTargets.isShown) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label={`Webhooks for ${actionLabel}`}
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
    >
      <span>Webhooks:</span>
      {webhookTargets.isChecking ? (
        <span>Checking...</span>
      ) : (
        <WebhookTargetLinks targets={webhookTargets.targets} />
      )}
      <Button
        size="xs"
        variant="ghost"
        aria-label={`Choose webhooks for ${actionLabel}`}
        onClick={() => {
          setPickerRequest({
            actionLabel,
            eventType: targetEvent.eventType,
            initialEndpointIds: webhookTargets.matchedEndpointIds,
            confirmLabel: actionLabel,
            onConfirm: (endpointIds) => {
              onRun({ webhook_endpoint_ids: endpointIds });
            },
          });
        }}
      >
        Choose
      </Button>
      <WebhookTargetsPicker
        pickerRequest={pickerRequest}
        onClose={() => {
          setPickerRequest(null);
        }}
      />
    </div>
  );
}
