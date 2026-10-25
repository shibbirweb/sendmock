import { Link } from "@tanstack/react-router";
import type * as React from "react";

import { CopyButton } from "@/components/common/copy-button";
import { PaymentStatusBadge } from "@/features/payments/payment-status-badge";
import type { PaymentDetail, PaymentMethod } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";
import { formatMinorAmount } from "@/lib/payments/format-money";
import { paymentProviderLabels } from "@/lib/payments/payment-labels";

function describeMethod(paymentMethod: PaymentMethod | null): string {
  if (paymentMethod === null) {
    return "Not chosen yet";
  }
  if (paymentMethod.kind === "card") {
    const expiry = `${String(paymentMethod.exp_month).padStart(2, "0")}/${String(paymentMethod.exp_year).slice(-2)}`;
    return `${paymentMethod.brand} ending ${paymentMethod.last4}, expires ${expiry}`;
  }
  if (paymentMethod.kind === "wallet") {
    return `${paymentMethod.wallet_name} ${paymentMethod.masked_number}`;
  }

  return paymentMethod.bank_name;
}

function FactRow({
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

/** Amount, status, provider ids, customer, method, refunds and dispute (PY-09.2). */
export function PaymentOverview({
  paymentDetail,
}: {
  paymentDetail: PaymentDetail;
}) {
  const money = (amountMinor: number) =>
    formatMinorAmount(amountMinor, paymentDetail.currency);

  return (
    <section aria-label="Payment overview" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl font-semibold tabular-nums">
          {money(paymentDetail.amount_minor)}
        </span>
        <PaymentStatusBadge paymentSummary={paymentDetail} />
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <FactRow label="Provider">
          {paymentProviderLabels[paymentDetail.provider]}
        </FactRow>
        {Object.entries(paymentDetail.provider_ids).map(([idName, idValue]) => (
          <FactRow key={idName} label={idName.replaceAll("_", " ")}>
            <span className="inline-flex items-center gap-1 font-mono text-xs">
              {idValue}
              <CopyButton
                copyText={idValue}
                label={`Copy ${idName}`}
                className="size-6"
              />
            </span>
          </FactRow>
        ))}
        <FactRow label="Customer">
          {[
            paymentDetail.customer_name,
            paymentDetail.customer_email,
            paymentDetail.customer_phone,
          ]
            .filter((customerPart) => customerPart !== null)
            .join(", ")}
        </FactRow>
        <FactRow label="Method">{describeMethod(paymentDetail.method)}</FactRow>
        {paymentDetail.refunded_minor > 0 && (
          <FactRow label="Refunded">
            {money(paymentDetail.refunded_minor)}
          </FactRow>
        )}
        {paymentDetail.dispute !== null && (
          <FactRow label="Dispute">
            {paymentDetail.dispute.status.replaceAll("_", " ")} (
            {paymentDetail.dispute.reason})
          </FactRow>
        )}
        {paymentDetail.checkout_url !== null && (
          <FactRow label="Checkout">
            {/* Same tab: in mock mode a new tab would start with fresh demo data. */}
            <Link
              to="/pay/$sessionId"
              params={{ sessionId: paymentDetail.id }}
              className="font-mono text-xs break-all underline underline-offset-4"
            >
              {paymentDetail.checkout_url}
            </Link>
          </FactRow>
        )}
        <FactRow label="Created">
          {formatDateTime(paymentDetail.created_at)}
        </FactRow>
      </dl>
    </section>
  );
}
