import { HttpStatusBadge } from "@/components/common/http-status-badge";
import { describeDeliveryStatus } from "@/features/webhooks/deliveries/delivery-status";
import type { WebhookDelivery } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** The status code when there was an answer, else the delivery state; errors on hover. */
export function DeliveryStatusBadge({
  webhookDelivery,
}: {
  webhookDelivery: WebhookDelivery;
}) {
  const statusLabel = describeDeliveryStatus(webhookDelivery);
  const hoverText = webhookDelivery.error_message ?? statusLabel;

  return (
    <span className="inline-flex items-center gap-1.5" title={hoverText}>
      {webhookDelivery.response !== null && (
        <HttpStatusBadge statusCode={webhookDelivery.response.status_code} />
      )}
      {(webhookDelivery.response === null ||
        webhookDelivery.status !== "succeeded") && (
        <span
          data-delivery-status={webhookDelivery.status}
          className={cn(
            "text-xs",
            ["failed", "exhausted", "render_failed"].includes(
              webhookDelivery.status,
            )
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {statusLabel}
        </span>
      )}
    </span>
  );
}
