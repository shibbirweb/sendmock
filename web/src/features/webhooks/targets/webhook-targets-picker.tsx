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
import {
  EndpointChoice,
  matchesSearch,
  readChosenEndpointIds,
} from "@/features/webhooks/targets/webhook-endpoint-choice";
import { useWebhookEndpoints } from "@/lib/api/hooks/use-webhook-queries";
import type { AppEventType } from "@/lib/api/types";

export type WebhookTargetsPickerRequest = {
  /** What the action does, e.g. "Hard bounce". */
  actionLabel: string;
  eventType: AppEventType;
  /** Checked at first: the rule matches, or the earlier choice. */
  initialEndpointIds: string[];
  /** The confirm button, e.g. "Use these" or "Simulate". */
  confirmLabel: string;
  onConfirm: (endpointIds: string[]) => void;
};

/**
 * Every enabled endpoint with a checkbox, the rule matches checked at first;
 * the action then sends to exactly the checked ones, and the rules stay as
 * they are (WH-13.4).
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
  const [shownRequest, setShownRequest] =
    React.useState<WebhookTargetsPickerRequest | null>(null);
  if (pickerRequest !== null && pickerRequest !== shownRequest) {
    setShownRequest(pickerRequest);
    setCheckedEndpointIds(pickerRequest.initialEndpointIds);
    setSearchText("");
  }
  const enabledEndpoints = (endpointsQuery.data ?? []).filter(
    (webhookEndpoint) => webhookEndpoint.is_enabled,
  );
  const visibleEndpoints = enabledEndpoints.filter((webhookEndpoint) =>
    matchesSearch(webhookEndpoint, searchText),
  );
  const toggleEndpoint = (endpointId: string, isChecked: boolean) => {
    setCheckedEndpointIds((previousIds) =>
      isChecked
        ? [...previousIds, endpointId]
        : previousIds.filter((previousId) => previousId !== endpointId),
    );
  };

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
            <span className="font-mono">{shownRequest?.eventType}</span>, for
            this action only. To change it for every event of this type, edit
            the{" "}
            <Link
              to="/webhooks/rules"
              search={{ event: shownRequest?.eventType }}
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
                toggleEndpoint(webhookEndpoint.id, isChecked);
              }}
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
              shownRequest?.onConfirm(
                readChosenEndpointIds(enabledEndpoints, checkedEndpointIds),
              );
              onClose();
            }}
          >
            {shownRequest?.confirmLabel ?? "Use these"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
