import type { PaymentDetail } from "@/lib/api/types";

const completedStatuses = new Set([
  "succeeded",
  "partially_refunded",
  "refunded",
  "disputed",
]);

function readTransactionStatus(paymentDetail: PaymentDetail): string {
  if (completedStatuses.has(paymentDetail.status)) {
    return "completed";
  }

  return paymentDetail.status === "canceled" ? "canceled" : "ready";
}

function describeTransaction(paymentDetail: PaymentDetail) {
  const amountText = String(paymentDetail.amount_minor);

  return {
    id: paymentDetail.provider_ids.transaction ?? "",
    status: readTransactionStatus(paymentDetail),
    custom_data: paymentDetail.metadata,
    origin: "api",
    collection_mode: "automatic",
    currency_code: paymentDetail.currency,
    created_at: paymentDetail.created_at,
    updated_at: paymentDetail.created_at,
    items: paymentDetail.line_items.map((lineItem) => ({
      price: {
        name: lineItem.name,
        unit_price: {
          amount: String(lineItem.unit_amount_minor),
          currency_code: paymentDetail.currency,
        },
      },
      quantity: lineItem.quantity,
    })),
    details: {
      totals: {
        subtotal: amountText,
        tax: "0",
        total: amountText,
        grand_total: amountText,
        currency_code: paymentDetail.currency,
      },
    },
    checkout: { url: paymentDetail.checkout_url },
  };
}

function describeAdjustment(paymentDetail: PaymentDetail) {
  const transactionId = paymentDetail.provider_ids.transaction ?? "";
  const amountText = String(paymentDetail.refunded_minor);

  return {
    id: transactionId.replace("txn_", "adj_"),
    action: "refund",
    transaction_id: transactionId,
    reason: "Refunded in SendMock",
    currency_code: paymentDetail.currency,
    status: "approved",
    totals: {
      subtotal: amountText,
      tax: "0",
      total: amountText,
      currency_code: paymentDetail.currency,
    },
    created_at: paymentDetail.created_at,
  };
}

/** A notification's `occurred_at` and `data`: the adjustment for refunds, else the transaction. */
export function buildPaddleEventObject(
  paymentDetail: PaymentDetail,
  eventName: string,
): Record<string, unknown> {
  const transaction = describeTransaction(paymentDetail);

  return {
    occurred_at: new Date().toISOString(),
    data: eventName.startsWith("adjustment.")
      ? describeAdjustment(paymentDetail)
      : {
          ...transaction,
          status:
            eventName === "transaction.paid" ? "paid" : transaction.status,
        },
  };
}
