import type { PaymentStatus, PaymentSummary } from "@/lib/api/types";
import { describePaymentStatus } from "@/lib/payments/payment-labels";
import { cn } from "@/lib/utils";

const statusToneClassNames: Record<PaymentStatus, string> = {
  requires_payment: "bg-muted text-muted-foreground",
  requires_action: "bg-muted text-muted-foreground",
  authorized: "bg-muted text-foreground",
  succeeded: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  canceled: "bg-destructive/10 text-destructive",
  refunded: "bg-muted text-foreground",
  partially_refunded: "bg-muted text-foreground",
  disputed: "bg-warning/10 text-warning",
};

/** The payment's state in words, tinted by kind; the text carries the meaning. */
export function PaymentStatusBadge({
  paymentSummary,
}: {
  paymentSummary: Pick<PaymentSummary, "status" | "failure_code">;
}) {
  return (
    <span
      data-payment-status={paymentSummary.status}
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        statusToneClassNames[paymentSummary.status],
      )}
    >
      {describePaymentStatus(paymentSummary)}
    </span>
  );
}
