import type { PaymentDetail, PaymentStatus } from "@/lib/api/types";
import { describePayPalAmount } from "@/mocks/payments/paypal/paypal-resource-objects";

/** SSLCommerz writes its times in Dhaka, six hours ahead of UTC. */
const dhakaOffsetMs = 6 * 3_600_000;
const passedOnFields = ["value_a", "value_b", "value_c", "value_d"];
const closingTimelineKinds = ["succeeded", "failed", "canceled"];
const paidStatuses: PaymentStatus[] = [
  "succeeded",
  "refunded",
  "partially_refunded",
  "disputed",
];

/** `YYYY-MM-DD HH:MM:SS` in Dhaka, as SSLCommerz writes `tran_date`. */
export function formatDhakaTime(timestampText: string): string {
  const unixMs = Date.parse(timestampText) || 0;

  return new Date(unixMs + dhakaOffsetMs)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function deriveBankTranId(paymentDetail: PaymentDetail): string {
  const compactDate = formatDhakaTime(paymentDetail.created_at)
    .replace(/\D/g, "")
    .slice(2);

  return `${compactDate}${paymentDetail.id.slice(-10)}`;
}

function readTransactionTime(paymentDetail: PaymentDetail): string {
  const closingEntry = [...paymentDetail.timeline]
    .reverse()
    .find((timelineEvent) => closingTimelineKinds.includes(timelineEvent.kind));

  return formatDhakaTime(closingEntry?.created_at ?? paymentDetail.created_at);
}

/** `card_type`, `card_no`, `card_issuer` and `card_brand` for the way the customer paid. */
function describeInstrument(paymentDetail: PaymentDetail): string[] {
  const paymentMethod = paymentDetail.method;
  const methodKey = (paymentDetail.method_key ?? "").toUpperCase();
  if (paymentMethod?.kind === "card") {
    const cardBrand = paymentMethod.brand.toUpperCase();

    return [
      `${cardBrand}-SendMock Test Bank`,
      `XXXXXXXXXXXX${paymentMethod.last4}`,
      "SENDMOCK TEST BANK",
      cardBrand,
    ];
  }
  if (paymentMethod?.kind === "wallet") {
    return [
      `${methodKey}-${paymentMethod.wallet_name}`,
      paymentMethod.masked_number,
      `${paymentMethod.wallet_name} Mobile Banking`,
      "MOBILEBANKING",
    ];
  }
  if (paymentMethod?.kind === "bank") {
    return [
      `${methodKey}-${paymentMethod.bank_name}`,
      "",
      paymentMethod.bank_name,
      "IB",
    ];
  }

  return ["", "", "", ""];
}

/**
 * The transaction as SSLCommerz posts it in the IPN and the redirects, with
 * `verify_key` naming every field, as the binary builds it.
 */
export function describeSslcommerzTransaction(
  paymentDetail: PaymentDetail,
  transactionStatus: string,
): Record<string, string> {
  const amount = describePayPalAmount(
    paymentDetail.amount_minor,
    paymentDetail.currency,
  ).value;
  const [cardType, cardNo, cardIssuer, cardBrand] =
    describeInstrument(paymentDetail);
  const transactionFields: Record<string, string> = {
    status: transactionStatus,
    tran_date: readTransactionTime(paymentDetail),
    tran_id: paymentDetail.provider_reference,
    val_id: paidStatuses.includes(paymentDetail.status)
      ? (paymentDetail.provider_ids.val_id ?? "")
      : "",
    amount,
    store_amount: amount,
    currency: paymentDetail.currency,
    bank_tran_id: deriveBankTranId(paymentDetail),
    card_type: cardType ?? "",
    card_no: cardNo ?? "",
    card_issuer: cardIssuer ?? "",
    card_brand: cardBrand ?? "",
    card_issuer_country: "Bangladesh",
    card_issuer_country_code: "BD",
    currency_type: paymentDetail.currency,
    currency_amount: amount,
    currency_rate: "1.0000",
    base_fair: "0.00",
  };
  passedOnFields.forEach((fieldName) => {
    transactionFields[fieldName] = paymentDetail.metadata[fieldName] ?? "";
  });
  transactionFields.risk_level = "0";
  transactionFields.risk_title = "Safe";

  return {
    ...transactionFields,
    verify_key: Object.keys(transactionFields).join(","),
  };
}
