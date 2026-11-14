import { Link } from "@tanstack/react-router";

import { HttpStatusBadge } from "@/components/common/http-status-badge";
import type { PaymentDetail } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format/format-values";

/** Each IPN or webhook sent, linking to its delivery in the log (PY-09.2, PY-08.3). */
export function PaymentNotifications({
  paymentDetail,
}: {
  paymentDetail: PaymentDetail;
}) {
  return (
    <section aria-label="Notifications" className="grid gap-2">
      <h3 className="text-sm font-semibold">Notifications</h3>
      {paymentDetail.notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">None sent yet.</p>
      ) : (
        <ul className="grid gap-1">
          {[...paymentDetail.notifications]
            .reverse()
            .map((paymentNotification) => (
              <li key={paymentNotification.delivery_id}>
                <Link
                  to="/webhooks/deliveries"
                  search={{ delivery: paymentNotification.delivery_id }}
                  data-testid="payment-notification"
                  className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/60"
                >
                  {paymentNotification.status_code !== null && (
                    <HttpStatusBadge
                      statusCode={paymentNotification.status_code}
                    />
                  )}
                  <span className="font-mono text-xs">
                    {paymentNotification.provider_event_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {paymentNotification.event_type}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatRelativeTime(paymentNotification.created_at)}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
