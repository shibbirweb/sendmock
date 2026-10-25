import type {
  PaymentProvider,
  PaymentStatus,
  PaymentSummary,
} from "@/lib/api/types";

export const paymentProviderLabels: Record<PaymentProvider, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  sslcommerz: "SSLCommerz",
  bkash: "bKash",
  native: "Native",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  requires_payment: "Awaiting payment",
  requires_action: "Needs 3-D Secure",
  authorized: "Authorized",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
  disputed: "Disputed",
};

export type PaymentStatusFilter =
  "all" | "succeeded" | "pending" | "failed" | "refunded" | "disputed";

/** The status chips and the statuses each one covers (PY-09.1). */
export const paymentStatusFilters: {
  statusFilter: PaymentStatusFilter;
  label: string;
  statuses: PaymentStatus[] | null;
}[] = [
  { statusFilter: "all", label: "All", statuses: null },
  { statusFilter: "succeeded", label: "Succeeded", statuses: ["succeeded"] },
  {
    statusFilter: "pending",
    label: "Pending",
    statuses: ["requires_payment", "requires_action", "authorized"],
  },
  { statusFilter: "failed", label: "Failed", statuses: ["failed", "canceled"] },
  {
    statusFilter: "refunded",
    label: "Refunded",
    statuses: ["refunded", "partially_refunded"],
  },
  { statusFilter: "disputed", label: "Disputed", statuses: ["disputed"] },
];

/** "Failed: insufficient funds" style text for the list and detail. */
export function describePaymentStatus(
  paymentSummary: Pick<PaymentSummary, "status" | "failure_code">,
): string {
  const statusLabel = paymentStatusLabels[paymentSummary.status];

  return paymentSummary.failure_code === null
    ? statusLabel
    : `${statusLabel}: ${paymentSummary.failure_code.replaceAll("_", " ")}`;
}
