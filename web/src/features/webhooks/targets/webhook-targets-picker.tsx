import { Link } from "@tanstack/react-router";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  WebhookPickerChoice,
  WebhookTargetEvent,
} from "@/features/webhooks/targets/use-webhook-targets";
import {
  EndpointChoice,
  matchesSearch,
  readChosenEndpointIds,
} from "@/features/webhooks/targets/webhook-endpoint-choice";
import {
  type WebhookPayloadRequest,
  WebhookPayloadDialog,
} from "@/features/webhooks/targets/webhook-payload-dialog";
import {
  findRequestEdit,
  replaceRequestEdit,
} from "@/features/webhooks/targets/webhook-request-edits";
import { TargetPayloadButton } from "@/features/webhooks/targets/webhook-target-links";
import { useWebhookEndpoints } from "@/lib/api/hooks/use-webhook-queries";
import type { WebhookEndpoint, WebhookRequestEdit } from "@/lib/api/types";

export type WebhookTargetsPickerRequest = {
  /** What the action does, e.g. "Hard bounce". */
  actionLabel: string;
  /** The event the action fires, for the payloads. */
  targetEvent: WebhookTargetEvent;
  /** Checked at first: the rule matches, or the earlier choice. */
  initialEndpointIds: string[];
  /** Payloads edited earlier for this action. */
  initialRequestEdits: WebhookRequestEdit[];
  /** The confirm button, e.g. "Use these" or "Simulate". */
  confirmLabel: string;
  onConfirm: (pickerChoice: WebhookPickerChoice) => void;
};

/** The endpoints matching the search, each with its checkbox and, once checked, its Payload button. */
function PickerEndpointList({
  enabledEndpoints,
  searchText,
  checkedEndpointIds,
  requestEdits,
  onToggle,
  onOpenPayload,
}: {
  enabledEndpoints: WebhookEndpoint[];
  searchText: string;
  checkedEndpointIds: string[];
  requestEdits: WebhookRequestEdit[];
  onToggle: (endpointId: string, isChecked: boolean) => void;
  onOpenPayload: (webhookEndpoint: WebhookEndpoint) => void;
}) {
  const visibleEndpoints = enabledEndpoints.filter((webhookEndpoint) =>
    matchesSearch(webhookEndpoint, searchText),
  );

  return (
    <ul
      aria-label="Webhook endpoints"
      className="grid max-h-72 gap-0.5 overflow-y-auto"
    >
      {visibleEndpoints.map((webhookEndpoint) => (
        <EndpointChoice
          key={webhookEndpoint.id}
          webhookEndpoint={webhookEndpoint}
          isChecked={checkedEndpointIds.includes(webhookEndpoint.id)}
          onCheckedChange={(isChecked) => {
            onToggle(webhookEndpoint.id, isChecked);
          }}
          payloadControls={
            <TargetPayloadButton
              endpointName={webhookEndpoint.name}
              isEdited={
                findRequestEdit(requestEdits, webhookEndpoint.id) !== null
              }
              onOpen={() => {
                onOpenPayload(webhookEndpoint);
              }}
            />
          }
        />
      ))}
      {visibleEndpoints.length === 0 && (
        <li className="px-2 py-4 text-sm text-muted-foreground">
          {enabledEndpoints.length === 0
            ? "No enabled endpoint yet."
            : "No endpoint matches the search."}
        </li>
      )}
    </ul>
  );
}

/**
 * Every enabled endpoint with a checkbox, the rule matches checked at first,
 * and each checked one's payload shown and editable; the action then sends to
 * exactly the checked ones, and the rules stay as they are (WH-13.4, WH-14.2).
 */
export function WebhookTargetsPicker({
  pickerRequest,
  onClose,
}: {
  pickerRequest: WebhookTargetsPickerRequest | null;
  onClose: () => void;
}) {
  const endpointsQuery = useWebhookEndpoints();
  const [searchText, setSearchText] = React.useState("");
  const [checkedEndpointIds, setCheckedEndpointIds] = React.useState<string[]>(
    [],
  );
  const [requestEdits, setRequestEdits] = React.useState<WebhookRequestEdit[]>(
    [],
  );
  const [payloadRequest, setPayloadRequest] =
    React.useState<WebhookPayloadRequest | null>(null);
  const [shownRequest, setShownRequest] =
    React.useState<WebhookTargetsPickerRequest | null>(null);
  if (pickerRequest !== null && pickerRequest !== shownRequest) {
    setShownRequest(pickerRequest);
    setCheckedEndpointIds(pickerRequest.initialEndpointIds);
    setRequestEdits(pickerRequest.initialRequestEdits);
    setSearchText("");
  }
  const enabledEndpoints = (endpointsQuery.data ?? []).filter(
    (webhookEndpoint) => webhookEndpoint.is_enabled,
  );
  const eventType = shownRequest?.targetEvent.eventType;

  return (
    <Dialog
      open={pickerRequest !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose webhooks</DialogTitle>
          <DialogDescription>
            Where {shownRequest?.actionLabel ?? "this action"} sends{" "}
            <span className="font-mono">{eventType}</span>, for this action
            only. To change it for every event of this type, edit the{" "}
            <Link
              to="/webhooks/rules"
              search={{ event: eventType }}
              target="_blank"
              rel="noopener"
              className="underline underline-offset-4"
            >
              rules
            </Link>
            .
          </DialogDescription>
        </DialogHeader>
        <Input
          type="search"
          aria-label="Search endpoints"
          placeholder="Search endpoints"
          value={searchText}
          onChange={(changeEvent) => {
            setSearchText(changeEvent.target.value);
          }}
        />
        <PickerEndpointList
          enabledEndpoints={enabledEndpoints}
          searchText={searchText}
          checkedEndpointIds={checkedEndpointIds}
          requestEdits={requestEdits}
          onToggle={(endpointId, isChecked) => {
            setCheckedEndpointIds((previousIds) =>
              isChecked
                ? [...previousIds, endpointId]
                : previousIds.filter((previousId) => previousId !== endpointId),
            );
          }}
          onOpenPayload={(webhookEndpoint) => {
            if (shownRequest === null) {
              return;
            }
            setPayloadRequest({
              targetEvent: shownRequest.targetEvent,
              endpointId: webhookEndpoint.id,
              endpointName: webhookEndpoint.name,
              editedBody:
                findRequestEdit(requestEdits, webhookEndpoint.id)?.body ?? null,
              confirmLabel: "Use this payload",
              onConfirm: (requestEdit) => {
                setRequestEdits((previousEdits) =>
                  replaceRequestEdit(
                    previousEdits,
                    webhookEndpoint.id,
                    requestEdit,
                  ),
                );
              },
            });
          }}
        />
        <DialogFooter>
          <p className="mr-auto self-center text-xs text-muted-foreground">
            {checkedEndpointIds.length === 0
              ? "No webhook will be sent"
              : `${checkedEndpointIds.length} chosen`}
          </p>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const endpointIds = readChosenEndpointIds(
                enabledEndpoints,
                checkedEndpointIds,
              );
              shownRequest?.onConfirm({
                endpointIds,
                requestEdits: requestEdits.filter((requestEdit) =>
                  endpointIds.includes(requestEdit.endpoint_id),
                ),
              });
              onClose();
            }}
          >
            {shownRequest?.confirmLabel ?? "Use these"}
          </Button>
        </DialogFooter>
        <WebhookPayloadDialog
          payloadRequest={payloadRequest}
          onClose={() => {
            setPayloadRequest(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
