import type {
  AppSettings,
  PaymentCheckoutCreateRequest,
  PaymentDetail,
  PaymentSimulateRequest,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import { buildProviderIds } from "@/mocks/fixtures/payment-fixtures";
import { readGatewayName } from "@/mocks/payments/payment-gateway-record";
import { recordPaymentNotification } from "@/mocks/payments/record-payment-notification";
import { simulatePayment } from "@/mocks/payments/simulate-payment";

const shopUrl = "http://localhost:8000/checkout";

const declineRequest: PaymentSimulateRequest = {
  action: "decline",
  decline_reason: "generic_decline",
};

/** What the outcome profile does to a new checkout; null waits for the page (PY-09.4). */
function readAutomaticOutcome(
  appSettings: Pick<
    AppSettings,
    "payment_outcome_profile" | "payment_random_success_rate_percent"
  >,
  randomValue: number,
): PaymentSimulateRequest | null {
  const outcomesByProfile: Record<
    AppSettings["payment_outcome_profile"],
    PaymentSimulateRequest | null
  > = {
    interactive: null,
    auto_success: { action: "succeed" },
    auto_decline: declineRequest,
    random:
      randomValue * 100 < appSettings.payment_random_success_rate_percent
        ? { action: "succeed" }
        : declineRequest,
  };

  return outcomesByProfile[appSettings.payment_outcome_profile];
}

/**
 * A hosted test checkout for any gateway, custom ones included
 * (`POST /payments/checkout`, PY-12.3), newest first in the list.
 */
export function createTestCheckout(
  mockDatabase: Pick<
    MockDatabase,
    | "payments"
    | "paymentGateways"
    | "webhookEndpoints"
    | "webhookDeliveries"
    | "settings"
  >,
  checkoutRequest: PaymentCheckoutCreateRequest,
  nowMs: number = Date.now(),
  randomValue: number = Math.random(),
): PaymentDetail {
  const paymentId = createMockUlid(nowMs);
  const providerIds = buildProviderIds(checkoutRequest.provider, nowMs);
  const createdAt = new Date(nowMs).toISOString();
  const lineItems = checkoutRequest.line_items ?? [
    {
      name: "Test order",
      quantity: 1,
      unit_amount_minor: checkoutRequest.amount_minor,
    },
  ];
  const paymentDetail: PaymentDetail = {
    id: paymentId,
    provider: checkoutRequest.provider,
    provider_name: readGatewayName(mockDatabase, checkoutRequest.provider),
    provider_reference: Object.values(providerIds)[0] ?? paymentId,
    provider_ids: providerIds,
    amount_minor: checkoutRequest.amount_minor,
    currency:
      checkoutRequest.currency ??
      mockDatabase.settings.payment_default_currency,
    status: "requires_payment",
    customer_email: checkoutRequest.customer_email ?? "test@example.com",
    customer_name: "Test Customer",
    customer_phone: null,
    failure_code: null,
    refunded_minor: 0,
    captured_minor: 0,
    method: null,
    method_key: null,
    line_items: lineItems,
    metadata: { order_id: `ord_${paymentId.slice(-6)}` },
    success_url: `${shopUrl}/success`,
    fail_url: `${shopUrl}/fail`,
    cancel_url: `${shopUrl}/cancel`,
    checkout_url: `http://127.0.0.1:8025/pay/${paymentId}`,
    redirect: null,
    dispute: null,
    timeline: [
      {
        kind: "created",
        description: "Test checkout session created",
        created_at: createdAt,
      },
    ],
    notifications: [],
    created_at: createdAt,
  };
  mockDatabase.payments.unshift(paymentDetail);
  recordPaymentNotification(
    mockDatabase,
    paymentDetail,
    "payment.created",
    nowMs,
  );
  const automaticOutcome = readAutomaticOutcome(
    mockDatabase.settings,
    randomValue,
  );
  if (automaticOutcome !== null) {
    simulatePayment(mockDatabase, paymentDetail, automaticOutcome, nowMs + 1);
  }

  return paymentDetail;
}
