import { Link } from "@tanstack/react-router";
import { SendIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SentDeliveryResult } from "@/features/webhooks/deliveries/sent-delivery-result";
import { SendToWebhookForm } from "@/features/webhooks/send/send-to-webhook-form";
import { useSendToWebhook } from "@/features/webhooks/send/use-send-to-webhook";
import { useWebhookEndpoints } from "@/lib/api/hooks/use-webhook-queries";
import type { TemplateRenderRequest, WebhookEndpoint } from "@/lib/api/types";

function SendToWebhookContent({
  webhookEndpoints,
  renderRequest,
  onClose,
}: {
  webhookEndpoints: [WebhookEndpoint, ...WebhookEndpoint[]];
  renderRequest: TemplateRenderRequest;
  onClose: () => void;
}) {
  const sendToWebhook = useSendToWebhook(webhookEndpoints, renderRequest);
  const { sentDelivery, blockingProblems } = sendToWebhook;

  return (
    <>
      <div className="min-h-0 overflow-y-auto pr-1">
        <SendToWebhookForm
          webhookEndpoints={webhookEndpoints}
          sendToWebhook={sendToWebhook}
        />
      </div>
      {sentDelivery !== null && (
        <SentDeliveryResult sentDelivery={sentDelivery} isSavable />
      )}
      <DialogFooter className="items-center">
        {blockingProblems.length > 0 && (
          <p className="mr-auto text-xs text-destructive">
            Fix the errors in the preview to send.
          </p>
        )}
        <Button type="button" variant="ghost" onClick={onClose}>
          {sentDelivery === null ? "Cancel" : "Done"}
        </Button>
        <Button
          type="button"
          disabled={
            sendToWebhook.isSending ||
            blockingProblems.length > 0 ||
            sendToWebhook.requestPreview.previewQuery.data === undefined
          }
          onClick={sendToWebhook.sendNow}
        >
          <SendIcon />
          {sentDelivery === null ? "Send" : "Send again"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Sends one email or SMS to an endpoint on demand (WH-05.1), asking for
 * Prompt variables and overrides (WH-05.5). Mount when opening.
 */
export function SendToWebhookDialog({
  renderRequest,
  messageLabel,
  onClose,
}: {
  /** `{ email_id }` or `{ sms_id }`. */
  renderRequest: TemplateRenderRequest;
  /** The subject or SMS text, for the description. */
  messageLabel: string;
  onClose: () => void;
}) {
  const endpointsQuery = useWebhookEndpoints();
  const enabledEndpoints = (endpointsQuery.data ?? []).filter(
    (webhookEndpoint) => webhookEndpoint.is_enabled,
  );
  const [firstEndpoint, ...otherEndpoints] = enabledEndpoints;

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Send to webhook</DialogTitle>
          <DialogDescription className="truncate">
            Sends "{messageLabel}" to an endpoint now.
          </DialogDescription>
        </DialogHeader>
        {endpointsQuery.isPending && <Skeleton className="h-60 w-full" />}
        {endpointsQuery.isSuccess && firstEndpoint === undefined && (
          <p className="text-sm text-muted-foreground">
            No enabled endpoint yet.{" "}
            <Link to="/webhooks/endpoints" className="underline">
              Add an endpoint
            </Link>{" "}
            to send messages to your app.
          </p>
        )}
        {firstEndpoint !== undefined && (
          <SendToWebhookContent
            webhookEndpoints={[firstEndpoint, ...otherEndpoints]}
            renderRequest={renderRequest}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
