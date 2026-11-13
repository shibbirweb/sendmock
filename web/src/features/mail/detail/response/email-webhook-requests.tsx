import { Link } from "@tanstack/react-router";

import { HttpStatusBadge } from "@/components/common/http-status-badge";
import { describeDeliveryStatus } from "@/features/webhooks/deliveries/delivery-status";
import { useSubjectDeliveries } from "@/lib/api/hooks/use-webhook-delivery-queries";
import type { WebhookDelivery } from "@/lib/api/types";

function DeliveryOutcome({ delivery }: { delivery: WebhookDelivery }) {
  const statusCode = delivery.response?.status_code;
  if (statusCode !== undefined) {
    return <HttpStatusBadge statusCode={statusCode} />;
  }

  return (
    <span className="shrink-0 text-xs text-muted-foreground">
      {delivery.error_message ?? describeDeliveryStatus(delivery)}
    </span>
  );
}

/**
 * Each webhook request an incoming email caused, with its URL and status,
 * moving from pending to the answer as webhook events arrive (EM-22.5).
 * `isExpectingRequests` says routes or rules matched, so an empty list right
 * after sending means "not queued yet" rather than "nothing received it".
 */
export function EmailWebhookRequests({
  emailId,
  isExpectingRequests,
}: {
  emailId: string;
  isExpectingRequests?: boolean;
}) {
  const deliveriesQuery = useSubjectDeliveries(emailId);
  const deliveries = deliveriesQuery.data?.items ?? [];
  if (deliveriesQuery.isPending) {
    return null;
  }
  if (deliveries.length === 0) {
    return isExpectingRequests === true ? (
      <p className="text-xs text-muted-foreground">Sending to your app...</p>
    ) : (
      <p className="text-xs text-muted-foreground">
        Nothing received it.{" "}
        <Link to="/webhooks/inbound-routes" className="underline">
          Add a route in Webhooks &gt; Inbound routes
        </Link>
      </p>
    );
  }

  return (
    <ul aria-label="Webhook requests" className="grid gap-1">
      {deliveries.map((delivery) => (
        <li key={delivery.id} className="flex min-w-0 items-center gap-2">
          <Link
            to="/webhooks/deliveries"
            search={{ delivery: delivery.id }}
            className="min-w-0 truncate font-mono text-xs hover:underline"
          >
            {delivery.url ?? delivery.endpoint_name}
          </Link>
          <DeliveryOutcome delivery={delivery} />
        </li>
      ))}
    </ul>
  );
}
