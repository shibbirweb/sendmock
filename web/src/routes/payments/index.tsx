import { createFileRoute } from "@tanstack/react-router";

import { PaymentsPage } from "@/features/payments/payments-page";
import type { PaymentProvider } from "@/lib/api/types";
import type { PaymentStatusFilter } from "@/lib/payments/payment-labels";

export type PaymentsSearchParams = {
  status?: Exclude<PaymentStatusFilter, "all">;
  provider?: PaymentProvider;
  currency?: string;
  /** ID of the payment whose detail is open. */
  payment?: string;
};

const statusFilterValues = [
  "succeeded",
  "pending",
  "failed",
  "refunded",
  "disputed",
];

function readString(searchValue: unknown): string | undefined {
  return typeof searchValue === "string" ? searchValue : undefined;
}

export const Route = createFileRoute("/payments/")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): PaymentsSearchParams => {
    const status = readString(searchParams.status);
    const provider = readString(searchParams.provider);

    return {
      status:
        status !== undefined && statusFilterValues.includes(status)
          ? (status as PaymentsSearchParams["status"])
          : undefined,
      provider: /^[a-z][a-z0-9_]{1,31}$/.test(provider ?? "")
        ? provider
        : undefined,
      currency: readString(searchParams.currency),
      payment: readString(searchParams.payment),
    };
  },
  component: PaymentsPage,
});
