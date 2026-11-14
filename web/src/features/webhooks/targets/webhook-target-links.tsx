import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WebhookTarget } from "@/features/webhooks/targets/list-webhook-targets";

/** The Payload button beside each name, and which payloads are edited (WH-14.2). */
export type TargetPayloadControls = {
  editedEndpointIds: string[];
  openPayload: (webhookTarget: WebhookTarget) => void;
};

/** "Payload" for one webhook, with an Edited badge once its body was edited. */
export function TargetPayloadButton({
  endpointName,
  isEdited,
  onOpen,
}: {
  endpointName: string;
  isEdited: boolean;
  onOpen: () => void;
}) {
  return (
    <>
      <Button
        size="xs"
        variant="ghost"
        aria-label={`Payload to ${endpointName}`}
        onClick={onOpen}
      >
        Payload
      </Button>
      {isEdited && <Badge variant="secondary">Edited</Badge>}
    </>
  );
}

/**
 * Each endpoint's name, opening its details in a new tab so the form or menu
 * stays as it was (WH-13.3), with its Payload button when given; "No webhook"
 * when there is none.
 */
export function WebhookTargetLinks({
  targets,
  payloadControls,
}: {
  targets: WebhookTarget[];
  payloadControls?: TargetPayloadControls;
}) {
  if (targets.length === 0) {
    return <span>No webhook</span>;
  }

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {targets.map((webhookTarget) => (
        <li key={webhookTarget.endpointId} className="flex items-center gap-1">
          <Link
            to="/webhooks/endpoints"
            search={{ endpoint: webhookTarget.endpointId }}
            target="_blank"
            rel="noopener"
            title={webhookTarget.endpointUrl}
            className="font-medium underline-offset-4 hover:underline"
          >
            {webhookTarget.endpointName}
          </Link>
          {payloadControls !== undefined && (
            <TargetPayloadButton
              endpointName={webhookTarget.endpointName}
              isEdited={payloadControls.editedEndpointIds.includes(
                webhookTarget.endpointId,
              )}
              onOpen={() => {
                payloadControls.openPayload(webhookTarget);
              }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
