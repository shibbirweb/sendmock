import { Link } from "@tanstack/react-router";

import { HttpStatusBadge } from "@/components/common/http-status-badge";
import { deliveryStatusLabels } from "@/features/webhooks/deliveries/delivery-status";
import type { WebhookDeliveryDetail } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

/** Every attempt of the same event; each opens its own detail (WH-03.8). */
export function DeliveryAttemptsList({
  deliveryDetail,
}: {
  deliveryDetail: WebhookDeliveryDetail;
}) {
  return (
    <section aria-label="Attempts" className="grid gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">
        Attempts of this event
      </h3>
      <ol className="grid gap-1">
        {deliveryDetail.attempts.map((deliveryAttempt) => {
          const isCurrentAttempt =
            deliveryAttempt.delivery_id === deliveryDetail.id;

          return (
            <li key={deliveryAttempt.delivery_id}>
              <Link
                to="/webhooks/deliveries"
                search={{ delivery: deliveryAttempt.delivery_id }}
                aria-current={isCurrentAttempt ? "true" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isCurrentAttempt && "border-primary bg-muted/60",
                )}
              >
                <span className="w-20 shrink-0">
                  Attempt {deliveryAttempt.attempt}
                </span>
                {deliveryAttempt.status_code !== null && (
                  <HttpStatusBadge statusCode={deliveryAttempt.status_code} />
                )}
                <span className="text-xs text-muted-foreground">
                  {deliveryStatusLabels[deliveryAttempt.status]}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDateTime(deliveryAttempt.created_at)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
