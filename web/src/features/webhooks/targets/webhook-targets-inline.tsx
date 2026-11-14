import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  useWebhookTargets,
  type WebhookTargetEvent,
} from "@/features/webhooks/targets/use-webhook-targets";
import {
  type WebhookPayloadRequest,
  WebhookPayloadDialog,
} from "@/features/webhooks/targets/webhook-payload-dialog";
import { toWebhookChoice } from "@/features/webhooks/targets/webhook-request-edits";
import { WebhookTargetLinks } from "@/features/webhooks/targets/webhook-target-links";
import {
  type WebhookTargetsPickerRequest,
  WebhookTargetsPicker,
} from "@/features/webhooks/targets/webhook-targets-picker";
import type { WebhookChoice } from "@/lib/api/types";

/**
 * Under a one-click action such as Send sample: the webhooks its event will
 * trigger, Payload to run it once with an edited payload, and Choose to run
 * it once with others (WH-13.2, WH-13.4, WH-14.2).
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
  const [payloadRequest, setPayloadRequest] =
    React.useState<WebhookPayloadRequest | null>(null);
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
        <WebhookTargetLinks
          targets={webhookTargets.targets}
          payloadControls={{
            editedEndpointIds: [],
            openPayload: (webhookTarget) => {
              setPayloadRequest({
                targetEvent,
                endpointId: webhookTarget.endpointId,
                endpointName: webhookTarget.endpointName,
                editedBody: null,
                confirmLabel: actionLabel,
                onConfirm: (requestEdit) => {
                  onRun(
                    requestEdit === null
                      ? {}
                      : { webhook_requests: [requestEdit] },
                  );
                },
              });
            },
          }}
        />
      )}
      <Button
        size="xs"
        variant="ghost"
        aria-label={`Choose webhooks for ${actionLabel}`}
        onClick={() => {
          setPickerRequest({
            actionLabel,
            targetEvent,
            initialEndpointIds: webhookTargets.matchedEndpointIds,
            initialRequestEdits: [],
            confirmLabel: actionLabel,
            onConfirm: (pickerChoice) => {
              onRun(
                toWebhookChoice({
                  chosenEndpointIds: pickerChoice.endpointIds,
                  targetEndpointIds: pickerChoice.endpointIds,
                  requestEdits: pickerChoice.requestEdits,
                }),
              );
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
      <WebhookPayloadDialog
        payloadRequest={payloadRequest}
        onClose={() => {
          setPayloadRequest(null);
        }}
      />
    </div>
  );
}
