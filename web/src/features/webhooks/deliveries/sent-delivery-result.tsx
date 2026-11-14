import { Link } from "@tanstack/react-router";
import { BookmarkIcon, ExternalLinkIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { HttpStatusBadge } from "@/components/common/http-status-badge";
import { NamePromptDialog } from "@/components/common/name-prompt-dialog";
import { Button } from "@/components/ui/button";
import { useSaveDelivery } from "@/lib/api/hooks/use-webhook-delivery-queries";
import type { WebhookDelivery } from "@/lib/api/types";
import { formatDurationMs } from "@/lib/format/format-values";

/**
 * The outcome of a send: status, duration, a link to the delivery and,
 * when `isSavable`, Save with a name (WH-05.6, WH-10.1).
 */
export function SentDeliveryResult({
  sentDelivery,
  isSavable = false,
}: {
  sentDelivery: WebhookDelivery;
  isSavable?: boolean;
}) {
  const saveDelivery = useSaveDelivery();
  const [isNamePromptOpen, setNamePromptOpen] = React.useState(false);
  const isRenderFailed = sentDelivery.status === "render_failed";

  return (
    <div
      data-testid="sent-delivery-result"
      className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"
    >
      {sentDelivery.response !== null && (
        <HttpStatusBadge statusCode={sentDelivery.response.status_code} />
      )}
      <span className={isRenderFailed ? "text-destructive" : undefined}>
        {isRenderFailed
          ? `Render failed: ${sentDelivery.error_message ?? ""}`
          : `Sent to ${sentDelivery.endpoint_name}`}
      </span>
      {sentDelivery.duration_ms !== null && (
        <span className="text-muted-foreground">
          in {formatDurationMs(sentDelivery.duration_ms)}
        </span>
      )}
      <div className="ml-auto flex gap-2">
        {isSavable && !isRenderFailed && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setNamePromptOpen(true);
            }}
          >
            <BookmarkIcon />
            Save
          </Button>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link
            to="/webhooks/deliveries"
            search={{ delivery: sentDelivery.id }}
          >
            <ExternalLinkIcon />
            Open delivery
          </Link>
        </Button>
      </div>
      {isNamePromptOpen && (
        <NamePromptDialog
          title="Save this request"
          description="Saved deliveries are kept through pruning and reset, and can be sent again later."
          confirmLabel="Save"
          initialName={`${sentDelivery.event_type} to ${sentDelivery.endpoint_name}`}
          isSubmitting={saveDelivery.isPending}
          onSubmit={(savedName) => {
            saveDelivery.mutate(
              { deliveryId: sentDelivery.id, savedName },
              {
                onSuccess: () => {
                  toast("Saved");
                  setNamePromptOpen(false);
                },
                onError: () => {
                  toast.error("Could not save the request");
                },
              },
            );
          }}
          onClose={() => {
            setNamePromptOpen(false);
          }}
        />
      )}
    </div>
  );
}
