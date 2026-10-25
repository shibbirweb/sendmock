import {
  BookmarkIcon,
  ChevronDownIcon,
  CircleSlashIcon,
  PencilIcon,
  RotateCcwIcon,
  TerminalIcon,
} from "lucide-react";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isDeliveryRetrying } from "@/features/webhooks/deliveries/delivery-status";
import { EditReplayDialog } from "@/features/webhooks/deliveries/detail/edit-replay-dialog";
import { SaveDeliveryDialog } from "@/features/webhooks/deliveries/detail/save-delivery-dialog";
import { useDeliveryActions } from "@/features/webhooks/deliveries/detail/use-delivery-actions";
import type { WebhookDeliveryDetail } from "@/lib/api/types";

/** Copy as cURL, Replay, Edit and replay, Cancel retries and Save (WH-03.8, WH-05.2). */
export function DeliveryActions({
  deliveryDetail,
}: {
  deliveryDetail: WebhookDeliveryDetail;
}) {
  const deliveryActions = useDeliveryActions(deliveryDetail);
  const recordedRequest = deliveryDetail.request;
  const closeDialog = () => {
    deliveryActions.setPendingDialog(null);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {recordedRequest !== null && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={deliveryActions.copyAsCurl}
          >
            <TerminalIcon />
            Copy as cURL
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={deliveryActions.isReplaying}
              >
                <RotateCcwIcon />
                Replay
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={() => {
                  deliveryActions.replay({ rerender: false });
                }}
              >
                Replay as-is
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  deliveryActions.replay({ rerender: true });
                }}
              >
                Re-render with fresh values
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              deliveryActions.setPendingDialog("edit-replay");
            }}
          >
            <PencilIcon />
            Edit and replay
          </Button>
        </>
      )}
      {isDeliveryRetrying(deliveryDetail) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            deliveryActions.setPendingDialog("cancel");
          }}
        >
          <CircleSlashIcon />
          Cancel retries
        </Button>
      )}
      {recordedRequest !== null && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            deliveryActions.setPendingDialog("save");
          }}
        >
          <BookmarkIcon />
          Save
        </Button>
      )}
      {recordedRequest !== null && (
        <EditReplayDialog
          recordedRequest={recordedRequest}
          isOpen={deliveryActions.pendingDialog === "edit-replay"}
          isSending={deliveryActions.isReplaying}
          onSend={(editedRequest) => {
            deliveryActions.replay({ rerender: false, ...editedRequest });
          }}
          onClose={closeDialog}
        />
      )}
      <ConfirmActionDialog
        isOpen={deliveryActions.pendingDialog === "cancel"}
        title="Cancel the remaining retries?"
        consequence="This delivery will not be attempted again. The attempts so far stay in the log."
        confirmLabel="Cancel retries"
        cancelLabel="Keep retrying"
        onConfirm={deliveryActions.cancelRetries}
        onClose={closeDialog}
      />
      {deliveryActions.pendingDialog === "save" && (
        <SaveDeliveryDialog
          isOpen
          suggestedName={`${deliveryDetail.event_type} to ${deliveryDetail.endpoint_name}`}
          isSaving={deliveryActions.isSaving}
          onSave={deliveryActions.save}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
