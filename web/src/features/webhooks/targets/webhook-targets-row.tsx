import * as React from "react";

import { Button } from "@/components/ui/button";
import type { WebhookTargetsState } from "@/features/webhooks/targets/use-webhook-targets";
import {
  type WebhookPayloadRequest,
  WebhookPayloadDialog,
} from "@/features/webhooks/targets/webhook-payload-dialog";
import { findRequestEdit } from "@/features/webhooks/targets/webhook-request-edits";
import { WebhookTargetLinks } from "@/features/webhooks/targets/webhook-target-links";
import {
  type WebhookTargetsPickerRequest,
  WebhookTargetsPicker,
} from "@/features/webhooks/targets/webhook-targets-picker";

/**
 * "Webhooks" above a composer's buttons: the endpoints the action's event
 * will reach, each with its Payload to see and edit, and Change to pick
 * others, for this action only (WH-13.2, WH-13.4, WH-14.2).
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
  const [payloadRequest, setPayloadRequest] =
    React.useState<WebhookPayloadRequest | null>(null);
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
          <WebhookTargetLinks
            targets={webhookTargets.targets}
            payloadControls={{
              editedEndpointIds: webhookTargets.requestEdits.map(
                (requestEdit) => requestEdit.endpoint_id,
              ),
              openPayload: (webhookTarget) => {
                setPayloadRequest({
                  targetEvent: webhookTargets.targetEvent,
                  endpointId: webhookTarget.endpointId,
                  endpointName: webhookTarget.endpointName,
                  editedBody:
                    findRequestEdit(
                      webhookTargets.requestEdits,
                      webhookTarget.endpointId,
                    )?.body ?? null,
                  confirmLabel: "Use this payload",
                  onConfirm: (requestEdit) => {
                    webhookTargets.saveRequestEdit(
                      webhookTarget.endpointId,
                      requestEdit,
                    );
                  },
                });
              },
            }}
          />
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
                targetEvent: webhookTargets.targetEvent,
                initialEndpointIds:
                  webhookTargets.chosenEndpointIds ??
                  webhookTargets.matchedEndpointIds,
                initialRequestEdits: webhookTargets.requestEdits,
                confirmLabel: "Use these",
                onConfirm: webhookTargets.applyChoice,
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
      <WebhookPayloadDialog
        payloadRequest={payloadRequest}
        onClose={() => {
          setPayloadRequest(null);
        }}
      />
    </div>
  );
}
