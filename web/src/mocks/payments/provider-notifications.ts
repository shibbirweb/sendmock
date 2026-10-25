import { faker } from "@faker-js/faker/locale/en";

import type {
  AppEventType,
  PaymentDetail,
  PaymentProvider,
} from "@/lib/api/types";

type PaymentEventType = Extract<
  AppEventType,
  `payment.${string}` | `checkout.${string}`
>;

/** Each provider's own name for a native payment event (17-payments). */
const providerEventNames: Record<
  Exclude<PaymentProvider, "native">,
  Partial<Record<PaymentEventType, string>>
> = {
  stripe: {
    "payment.created": "payment_intent.created",
    "payment.authorized": "payment_intent.amount_capturable_updated",
    "payment.succeeded": "payment_intent.succeeded",
    "payment.failed": "payment_intent.payment_failed",
    "payment.canceled": "payment_intent.canceled",
    "payment.refunded": "charge.refunded",
    "payment.partially_refunded": "charge.refunded",
    "payment.dispute_opened": "charge.dispute.created",
    "payment.dispute_closed": "charge.dispute.closed",
    "checkout.completed": "checkout.session.completed",
    "checkout.expired": "checkout.session.expired",
  },
  paypal: {
    "payment.authorized": "PAYMENT.AUTHORIZATION.CREATED",
    "payment.succeeded": "PAYMENT.CAPTURE.COMPLETED",
    "payment.failed": "PAYMENT.CAPTURE.DENIED",
    "payment.canceled": "PAYMENT.AUTHORIZATION.VOIDED",
    "payment.refunded": "PAYMENT.CAPTURE.REFUNDED",
    "payment.partially_refunded": "PAYMENT.CAPTURE.REFUNDED",
    "payment.dispute_opened": "CUSTOMER.DISPUTE.CREATED",
    "payment.dispute_closed": "CUSTOMER.DISPUTE.RESOLVED",
    "checkout.completed": "CHECKOUT.ORDER.APPROVED",
    "checkout.expired": "CHECKOUT.ORDER.VOIDED",
  },
  sslcommerz: {
    "payment.succeeded": "VALID",
    "payment.failed": "FAILED",
    "payment.canceled": "CANCELLED",
    "payment.refunded": "REFUNDED",
    "payment.partially_refunded": "REFUNDED",
    "checkout.expired": "EXPIRED",
  },
  bkash: {
    "payment.succeeded": "success",
    "payment.failed": "failure",
    "payment.canceled": "cancel",
    "payment.refunded": "refunded",
    "payment.partially_refunded": "refunded",
    "checkout.expired": "cancel",
  },
};

/** Whether an event is one a payment notification can carry. */
export function isPaymentEventType(
  eventType: AppEventType,
): eventType is PaymentEventType {
  return eventType.startsWith("payment.") || eventType.startsWith("checkout.");
}

/** Whether the provider sends anything for this event; SSLCommerz has no checkout event. */
export function hasProviderEvent(
  provider: PaymentProvider,
  eventType: PaymentEventType,
): boolean {
  return (
    provider === "native" ||
    providerEventNames[provider][eventType] !== undefined
  );
}

export function readProviderEventName(
  provider: PaymentProvider,
  eventType: PaymentEventType,
): string {
  return provider === "native"
    ? eventType
    : (providerEventNames[provider][eventType] ?? eventType);
}

function toMajorText(paymentDetail: PaymentDetail): string {
  return paymentDetail.currency === "JPY"
    ? String(paymentDetail.amount_minor)
    : (paymentDetail.amount_minor / 100).toFixed(2);
}

/**
 * The request a provider sends for an event: its payload shape, content
 * type and signature headers (mock signatures, PY-08.2 shapes).
 */
export function buildProviderNotification(
  paymentDetail: PaymentDetail,
  eventType: PaymentEventType,
  timestampSeconds: number,
): {
  providerEventName: string;
  headers: Record<string, string>;
  body: string;
} {
  const providerEventName = readProviderEventName(
    paymentDetail.provider,
    eventType,
  );
  const jsonHeaders = { "content-type": "application/json" };
  if (paymentDetail.provider === "stripe") {
    return {
      providerEventName,
      headers: {
        ...jsonHeaders,
        "stripe-signature": `t=${timestampSeconds},v1=${faker.string.hexadecimal({ length: 64, prefix: "" }).toLowerCase()}`,
      },
      body: JSON.stringify(
        {
          id: `evt_${faker.string.alphanumeric(24)}`,
          object: "event",
          type: providerEventName,
          created: timestampSeconds,
          data: {
            object: {
              id: paymentDetail.provider_reference,
              amount: paymentDetail.amount_minor,
              currency: paymentDetail.currency.toLowerCase(),
              status: paymentDetail.status,
            },
          },
        },
        null,
        2,
      ),
    };
  }
  if (paymentDetail.provider === "paypal") {
    return {
      providerEventName,
      headers: {
        ...jsonHeaders,
        "paypal-transmission-id": faker.string.uuid(),
        "paypal-transmission-time": new Date(
          timestampSeconds * 1000,
        ).toISOString(),
        "paypal-transmission-sig": faker.string.alphanumeric(88),
        "paypal-auth-algo": "SHA256withRSA",
      },
      body: JSON.stringify(
        {
          id: `WH-${faker.string.alphanumeric(17).toUpperCase()}`,
          event_type: providerEventName,
          resource: {
            id: paymentDetail.provider_reference,
            amount: {
              currency_code: paymentDetail.currency,
              value: toMajorText(paymentDetail),
            },
            status: paymentDetail.status.toUpperCase(),
          },
        },
        null,
        2,
      ),
    };
  }
  if (paymentDetail.provider === "sslcommerz") {
    return {
      providerEventName,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        tran_id: paymentDetail.provider_reference,
        val_id: paymentDetail.provider_ids.val_id ?? "",
        amount: toMajorText(paymentDetail),
        currency: paymentDetail.currency,
        status: providerEventName,
        verify_key: "amount,currency,status,tran_id,val_id",
        verify_sign: faker.string
          .hexadecimal({ length: 32, prefix: "" })
          .toLowerCase(),
      }).toString(),
    };
  }
  if (paymentDetail.provider === "bkash") {
    return {
      providerEventName,
      headers: jsonHeaders,
      body: JSON.stringify(
        {
          paymentID: paymentDetail.provider_reference,
          trxID: paymentDetail.provider_ids.trx_id ?? null,
          transactionStatus: providerEventName,
          amount: toMajorText(paymentDetail),
          currency: paymentDetail.currency,
        },
        null,
        2,
      ),
    };
  }

  return {
    providerEventName,
    headers: jsonHeaders,
    body: JSON.stringify(
      {
        type: eventType,
        data: {
          id: paymentDetail.id,
          amount_minor: paymentDetail.amount_minor,
          currency: paymentDetail.currency,
          status: paymentDetail.status,
        },
      },
      null,
      2,
    ),
  };
}

export type { PaymentEventType };
