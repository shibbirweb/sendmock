import { AlertTriangleIcon, CircleXIcon } from "lucide-react";
import type * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentGatewayForm } from "@/features/payments/gateways/use-payment-gateway-form";
import { usePayments } from "@/lib/api/hooks/use-payment-queries";
import type { PaymentEventType, PaymentRedirect } from "@/lib/api/types";
import { formatMinorAmount } from "@/lib/payments/format-money";

const redirectOutcomes: PaymentRedirect["outcome"][] = [
  "success",
  "fail",
  "cancel",
];

function PreviewPickers({ gatewayForm }: { gatewayForm: PaymentGatewayForm }) {
  const { previewChoice, choosePreview, gatewayInput } = gatewayForm;
  const recentPayments =
    usePayments()
      .data?.pages.flatMap((paymentPage) => paymentPage.items)
      .slice(0, 20) ?? [];
  const previewPaymentId =
    previewChoice.paymentId ??
    gatewayForm.previewQuery.data?.payment_id ??
    undefined;

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Select
        value={previewPaymentId}
        onValueChange={(paymentId) => choosePreview({ paymentId })}
      >
        <SelectTrigger
          aria-label="Preview payment"
          className="h-8 w-full min-w-0 text-xs"
        >
          <SelectValue placeholder="Payment" />
        </SelectTrigger>
        <SelectContent>
          {recentPayments.map((paymentSummary) => (
            <SelectItem key={paymentSummary.id} value={paymentSummary.id}>
              {paymentSummary.customer_name ?? paymentSummary.id},{" "}
              {formatMinorAmount(
                paymentSummary.amount_minor,
                paymentSummary.currency,
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={previewChoice.eventType}
        onValueChange={(eventType) =>
          choosePreview({ eventType: eventType as PaymentEventType })
        }
      >
        <SelectTrigger
          aria-label="Preview event"
          className="h-8 w-full min-w-0 text-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(gatewayInput.event_names).map((eventType) => (
            <SelectItem key={eventType} value={eventType}>
              {eventType}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={previewChoice.redirectOutcome}
        onValueChange={(redirectOutcome) =>
          choosePreview({
            redirectOutcome: redirectOutcome as PaymentRedirect["outcome"],
          })
        }
      >
        <SelectTrigger
          aria-label="Preview redirect outcome"
          className="h-8 w-full min-w-0 text-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {redirectOutcomes.map((redirectOutcome) => (
            <SelectItem key={redirectOutcome} value={redirectOutcome}>
              Redirect on {redirectOutcome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="grid gap-1.5">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}

/** The gateway's redirect and notification rendered live, with problems by part (PY-12.4). */
export function GatewayPreviewPanel({
  gatewayForm,
}: {
  gatewayForm: PaymentGatewayForm;
}) {
  const preview = gatewayForm.previewQuery.data;

  return (
    <div className="grid content-start gap-4" data-testid="gateway-preview">
      <PreviewPickers gatewayForm={gatewayForm} />
      {preview !== undefined && preview.problems.length > 0 && (
        <ul aria-label="Template problems" className="grid gap-1 text-xs">
          {preview.problems.map((problem) => (
            <li
              key={`${problem.part}-${problem.message}`}
              className="flex items-start gap-1.5"
            >
              {problem.severity === "error" ? (
                <CircleXIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              ) : (
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
              )}
              <span>
                <span className="font-medium">{problem.part}:</span>{" "}
                {problem.message}
              </span>
            </li>
          ))}
        </ul>
      )}
      {preview !== undefined && (
        <>
          <PreviewSection title="Redirect">
            <p className="font-mono text-xs break-all">
              {preview.redirect.method} {preview.redirect.url}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
              {Object.entries(preview.redirect.fields).map(
                ([fieldName, fieldValue]) => (
                  <div key={fieldName} className="contents">
                    <dt className="text-muted-foreground">{fieldName}</dt>
                    <dd className="break-all">{fieldValue}</dd>
                  </div>
                ),
              )}
            </dl>
          </PreviewSection>
          <PreviewSection title="Notification">
            {preview.notification === null ? (
              <p className="text-xs text-muted-foreground">
                Nothing is sent for {gatewayForm.previewChoice.eventType}: it
                has no event name.
              </p>
            ) : (
              <>
                <p className="font-mono text-xs">
                  {preview.notification.event_name}
                </p>
                <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
                  {Object.entries(preview.notification.headers)
                    .map(
                      ([headerName, headerValue]) =>
                        `${headerName}: ${headerValue}`,
                    )
                    .join("\n")}
                </pre>
                <pre
                  className="max-h-72 overflow-auto rounded-md bg-muted p-2 text-xs break-all whitespace-pre-wrap"
                  data-testid="notification-body-preview"
                >
                  {preview.notification.body}
                </pre>
              </>
            )}
          </PreviewSection>
        </>
      )}
    </div>
  );
}
