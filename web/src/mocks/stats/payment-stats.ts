import type { AppStats, PaymentDetail, PaymentStatus } from "@/lib/api/types";

const succeededStatuses: PaymentStatus[] = [
  "succeeded",
  "partially_refunded",
  "refunded",
  "disputed",
];
const finishedStatuses: PaymentStatus[] = [
  ...succeededStatuses,
  "failed",
  "canceled",
];

/** The Overview's Payments tile (PY-09.5): count, success rate and test revenue per currency. */
export function calculatePaymentStats(
  payments: PaymentDetail[],
  startOfTodayMs: number,
): Pick<
  AppStats,
  | "payment_count"
  | "payments_today"
  | "payment_success_rate"
  | "payment_revenue"
> {
  const finishedPayments = payments.filter((payment) =>
    finishedStatuses.includes(payment.status),
  );
  const succeededCount = finishedPayments.filter((payment) =>
    succeededStatuses.includes(payment.status),
  ).length;
  const revenueByCurrency = new Map<string, number>();
  payments.forEach((payment) => {
    const netMinor = payment.captured_minor - payment.refunded_minor;
    if (netMinor > 0) {
      revenueByCurrency.set(
        payment.currency,
        (revenueByCurrency.get(payment.currency) ?? 0) + netMinor,
      );
    }
  });

  return {
    payment_count: payments.length,
    payments_today: payments.filter(
      (payment) => Date.parse(payment.created_at) >= startOfTodayMs,
    ).length,
    payment_success_rate:
      finishedPayments.length === 0
        ? null
        : succeededCount / finishedPayments.length,
    payment_revenue: [...revenueByCurrency.entries()]
      .map(([currency, amountMinor]) => ({
        currency,
        amount_minor: amountMinor,
      }))
      .sort((first, second) => second.amount_minor - first.amount_minor),
  };
}
