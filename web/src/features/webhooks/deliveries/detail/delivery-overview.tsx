import { Link } from "@tanstack/react-router";
import { CircleAlertIcon, MailIcon, MessageSquareIcon } from "lucide-react";
import type * as React from "react";

import { DeliveryStatusBadge } from "@/features/webhooks/deliveries/delivery-status-badge";
import type { DeliverySubject, WebhookDeliveryDetail } from "@/lib/api/types";
import { formatDateTime, formatDurationMs } from "@/lib/format/format-values";

function DeliveryFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function SubjectLink({
  deliverySubject,
}: {
  deliverySubject: DeliverySubject;
}) {
  const linkClassName =
    "inline-flex max-w-full items-center gap-1.5 underline-offset-4 hover:underline";
  if (deliverySubject.kind === "email") {
    return (
      <Link
        to="/mail/$emailId"
        params={{ emailId: deliverySubject.id }}
        className={linkClassName}
      >
        <MailIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">
          {deliverySubject.title || "(no subject)"}
        </span>
      </Link>
    );
  }

  return (
    <Link
      to="/sms/$threadId"
      params={{ threadId: deliverySubject.sms_thread_id ?? "" }}
      search={{ message: deliverySubject.id }}
      className={linkClassName}
    >
      <MessageSquareIcon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="truncate">{deliverySubject.title}</span>
    </Link>
  );
}

/** Status, timing, retry state and what caused the delivery (WH-03.8). */
export function DeliveryOverview({
  deliveryDetail,
}: {
  deliveryDetail: WebhookDeliveryDetail;
}) {
  const isRenderFailure = deliveryDetail.status === "render_failed";

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <DeliveryStatusBadge webhookDelivery={deliveryDetail} />
        <span className="font-mono text-sm">{deliveryDetail.event_type}</span>
      </div>
      {deliveryDetail.error_message !== null && (
        <p
          role="alert"
          className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <CircleAlertIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <span>
            {isRenderFailure && (
              <span className="font-medium">Template error: </span>
            )}
            {deliveryDetail.error_message}
            {isRenderFailure && (
              <>
                {" "}
                <Link
                  to="/webhooks/endpoints"
                  className="underline underline-offset-4"
                >
                  Check the endpoint
                </Link>
              </>
            )}
          </span>
        </p>
      )}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <DeliveryFact label="Endpoint">
          {deliveryDetail.endpoint_name}
        </DeliveryFact>
        <DeliveryFact label="Trigger">{deliveryDetail.trigger}</DeliveryFact>
        <DeliveryFact label="Attempt">
          {deliveryDetail.attempt} of {deliveryDetail.max_attempts}
        </DeliveryFact>
        <DeliveryFact label="Time">
          {formatDateTime(deliveryDetail.created_at)}
        </DeliveryFact>
        {deliveryDetail.duration_ms !== null && (
          <DeliveryFact label="Duration">
            {formatDurationMs(deliveryDetail.duration_ms)}
          </DeliveryFact>
        )}
        {deliveryDetail.next_attempt_at !== null && (
          <DeliveryFact label="Next attempt">
            {formatDateTime(deliveryDetail.next_attempt_at)}
          </DeliveryFact>
        )}
        <DeliveryFact label="Event id">
          <code className="font-mono text-xs">{deliveryDetail.event_id}</code>
        </DeliveryFact>
        {deliveryDetail.subject !== null && (
          <DeliveryFact label="Caused by">
            <SubjectLink deliverySubject={deliveryDetail.subject} />
          </DeliveryFact>
        )}
      </dl>
    </div>
  );
}
