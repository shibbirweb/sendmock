import type {
  PaymentDetail,
  PaymentLineItem,
  PaymentMethod,
  BuiltinPaymentProvider,
  PaymentSimulateRequest,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import {
  createMockUlid,
  minutesAgoInMs,
} from "@/mocks/fixtures/fixture-helpers";
import { simulatePayment } from "@/mocks/payments/simulate-payment";

type PaymentSpec = {
  provider: BuiltinPaymentProvider;
  amountMinor: number;
  currency: string;
  minutesAgo: number;
  customer: { email: string; name: string; phone?: string };
  lineItems: PaymentLineItem[];
  /** A hosted checkout session (with redirect URLs), else a direct API payment. */
  hasCheckout: boolean;
  method?: PaymentMethod;
  startStatus?: "requires_payment" | "requires_action" | "authorized";
  /** Simulate actions run one minute apart after creation. */
  steps: PaymentSimulateRequest[];
};

const shopUrl = "http://localhost:8000/checkout";

const providerNames: Record<BuiltinPaymentProvider, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  sslcommerz: "SSLCommerz",
  bkash: "bKash",
  native: "Native",
};
const visa4242: PaymentMethod = {
  kind: "card",
  brand: "visa",
  last4: "4242",
  exp_month: 12,
  exp_year: 2034,
};

const paymentSpecs: PaymentSpec[] = [
  {
    provider: "paypal",
    amountMinor: 4200,
    currency: "EUR",
    minutesAgo: 4,
    customer: { email: "omar@example.com", name: "Omar Farouk" },
    lineItems: [
      { name: "Concert ticket", quantity: 1, unit_amount_minor: 4200 },
    ],
    hasCheckout: true,
    steps: [],
  },
  {
    provider: "bkash",
    amountMinor: 120000,
    currency: "BDT",
    minutesAgo: 5,
    customer: {
      email: "ruma@example.com",
      name: "Ruma Begum",
      phone: "+8801770000001",
    },
    lineItems: [{ name: "Bus tickets", quantity: 2, unit_amount_minor: 60000 }],
    hasCheckout: true,
    steps: [],
  },
  {
    provider: "stripe",
    amountMinor: 4900,
    currency: "USD",
    minutesAgo: 3,
    customer: { email: "ayesha@example.com", name: "Ayesha Khan" },
    lineItems: [
      { name: "Pro plan (monthly)", quantity: 1, unit_amount_minor: 4900 },
    ],
    hasCheckout: true,
    steps: [{ action: "succeed" }],
  },
  {
    provider: "stripe",
    amountMinor: 12000,
    currency: "USD",
    minutesAgo: 9,
    customer: { email: "tom@example.com", name: "Tom Becker" },
    lineItems: [{ name: "Team seats", quantity: 4, unit_amount_minor: 3000 }],
    hasCheckout: true,
    method: {
      kind: "card",
      brand: "visa",
      last4: "9995",
      exp_month: 4,
      exp_year: 2031,
    },
    steps: [{ action: "decline", decline_reason: "insufficient_funds" }],
  },
  {
    provider: "stripe",
    amountMinor: 1500,
    currency: "EUR",
    minutesAgo: 14,
    customer: { email: "lena@example.com", name: "Lena Vogel" },
    lineItems: [
      { name: "E-book bundle", quantity: 1, unit_amount_minor: 1500 },
    ],
    hasCheckout: true,
    steps: [],
  },
  {
    provider: "stripe",
    amountMinor: 25000,
    currency: "USD",
    minutesAgo: 25,
    customer: { email: "ops@acme.test", name: "Acme Ops" },
    lineItems: [
      { name: "Hardware deposit", quantity: 1, unit_amount_minor: 25000 },
    ],
    hasCheckout: false,
    method: {
      kind: "card",
      brand: "mastercard",
      last4: "4444",
      exp_month: 8,
      exp_year: 2030,
    },
    startStatus: "authorized",
    steps: [],
  },
  {
    provider: "stripe",
    amountMinor: 8000,
    currency: "USD",
    minutesAgo: 70,
    customer: { email: "ravi@example.com", name: "Ravi Patel" },
    lineItems: [
      { name: "Workshop ticket", quantity: 2, unit_amount_minor: 4000 },
    ],
    hasCheckout: true,
    method: visa4242,
    steps: [
      { action: "succeed" },
      { action: "refund", refund_amount_minor: 3000 },
    ],
  },
  {
    provider: "stripe",
    amountMinor: 5900,
    currency: "USD",
    minutesAgo: 190,
    customer: { email: "unknown@example.net", name: "J. Doe" },
    lineItems: [{ name: "Gift card", quantity: 1, unit_amount_minor: 5900 }],
    hasCheckout: true,
    method: {
      kind: "card",
      brand: "visa",
      last4: "0259",
      exp_month: 1,
      exp_year: 2032,
    },
    steps: [{ action: "succeed" }, { action: "dispute" }],
  },
  {
    provider: "paypal",
    amountMinor: 3550,
    currency: "USD",
    minutesAgo: 40,
    customer: { email: "maria@example.com", name: "Maria Garcia" },
    lineItems: [{ name: "Stickers", quantity: 5, unit_amount_minor: 710 }],
    hasCheckout: true,
    method: {
      kind: "wallet",
      wallet_name: "PayPal",
      masked_number: "ma***@example.com",
    },
    steps: [{ action: "succeed" }],
  },
  {
    provider: "paypal",
    amountMinor: 9900,
    currency: "EUR",
    minutesAgo: 300,
    customer: { email: "pierre@example.com", name: "Pierre Martin" },
    lineItems: [{ name: "Annual plan", quantity: 1, unit_amount_minor: 9900 }],
    hasCheckout: true,
    steps: [{ action: "expire" }],
  },
  {
    provider: "sslcommerz",
    amountMinor: 125000,
    currency: "BDT",
    minutesAgo: 18,
    customer: {
      email: "rahim@example.com",
      name: "Rahim Uddin",
      phone: "+8801700000000",
    },
    lineItems: [
      { name: "Grocery order #4521", quantity: 1, unit_amount_minor: 125000 },
    ],
    hasCheckout: true,
    method: visa4242,
    steps: [{ action: "succeed" }],
  },
  {
    provider: "sslcommerz",
    amountMinor: 50000,
    currency: "BDT",
    minutesAgo: 55,
    customer: {
      email: "karim@example.com",
      name: "Karim Hasan",
      phone: "+8801800000000",
    },
    lineItems: [
      { name: "Mobile recharge", quantity: 1, unit_amount_minor: 50000 },
    ],
    hasCheckout: true,
    steps: [{ action: "decline", decline_reason: "generic_decline" }],
  },
  {
    provider: "sslcommerz",
    amountMinor: 340000,
    currency: "BDT",
    minutesAgo: 6,
    customer: {
      email: "nadia@example.com",
      name: "Nadia Islam",
      phone: "+8801900000000",
    },
    lineItems: [
      { name: "Laptop stand", quantity: 1, unit_amount_minor: 340000 },
    ],
    hasCheckout: true,
    steps: [],
  },
  {
    provider: "bkash",
    amountMinor: 75000,
    currency: "BDT",
    minutesAgo: 30,
    customer: {
      email: "sumon@example.com",
      name: "Sumon Ahmed",
      phone: "+8801770000021",
    },
    lineItems: [{ name: "Ride credit", quantity: 1, unit_amount_minor: 75000 }],
    hasCheckout: true,
    method: {
      kind: "wallet",
      wallet_name: "bKash",
      masked_number: "01770****21",
    },
    steps: [{ action: "succeed" }],
  },
  {
    provider: "bkash",
    amountMinor: 20000,
    currency: "BDT",
    minutesAgo: 120,
    customer: {
      email: "tania@example.com",
      name: "Tania Akter",
      phone: "+8801770000044",
    },
    lineItems: [
      { name: "Food delivery", quantity: 1, unit_amount_minor: 20000 },
    ],
    hasCheckout: true,
    method: {
      kind: "wallet",
      wallet_name: "bKash",
      masked_number: "01770****44",
    },
    steps: [{ action: "decline", decline_reason: "insufficient_funds" }],
  },
  {
    provider: "native",
    amountMinor: 149900,
    currency: "INR",
    minutesAgo: 95,
    customer: { email: "arjun@example.com", name: "Arjun Mehta" },
    lineItems: [
      { name: "Course access", quantity: 1, unit_amount_minor: 149900 },
    ],
    hasCheckout: false,
    method: visa4242,
    steps: [{ action: "succeed" }],
  },
  {
    provider: "native",
    amountMinor: 3000,
    currency: "JPY",
    minutesAgo: 600,
    customer: { email: "yuki@example.com", name: "Yuki Sato" },
    lineItems: [{ name: "Tea set", quantity: 1, unit_amount_minor: 3000 }],
    hasCheckout: false,
    method: visa4242,
    steps: [{ action: "succeed" }, { action: "refund" }],
  },
  {
    provider: "native",
    amountMinor: 999,
    currency: "USD",
    minutesAgo: 2,
    customer: { email: "sam@example.com", name: "Sam Lee" },
    lineItems: [{ name: "Starter plan", quantity: 1, unit_amount_minor: 999 }],
    hasCheckout: true,
    method: {
      kind: "card",
      brand: "visa",
      last4: "3155",
      exp_month: 6,
      exp_year: 2033,
    },
    startStatus: "requires_action",
    steps: [],
  },
];

/** Each provider's own ids for a payment; a custom gateway gets one reference. */
export function buildProviderIds(
  provider: string,
  createdAtMs: number,
): Record<string, string> {
  const suffix = createMockUlid(createdAtMs).slice(-12);
  const providerIdsByProvider: Record<
    BuiltinPaymentProvider,
    Record<string, string>
  > = {
    stripe: {
      checkout_session: `cs_test_${suffix}`,
      payment_intent: `pi_${suffix}`,
    },
    paypal: { order: suffix.slice(0, 10).toUpperCase() },
    sslcommerz: { tran_id: `TXN${suffix}`, val_id: `VAL${suffix}` },
    bkash: { payment_id: `TR00${suffix}`, trx_id: `TRX${suffix.slice(0, 8)}` },
    native: { payment: `pay_${suffix}` },
  };

  return (
    providerIdsByProvider[provider as BuiltinPaymentProvider] ?? {
      reference: `${provider.toUpperCase()}-${suffix}`,
    }
  );
}

/** Which built-in method a fixture's chosen method stands for. */
function readFixtureMethodKey(
  paymentMethod: PaymentMethod | undefined,
): string | null {
  if (paymentMethod === undefined) {
    return null;
  }
  if (paymentMethod.kind === "card") {
    return "card";
  }

  return paymentMethod.kind === "wallet" &&
    paymentMethod.wallet_name === "PayPal"
    ? "paypal_account"
    : "bkash";
}

function buildPayment(paymentSpec: PaymentSpec): PaymentDetail {
  const createdAtMs = minutesAgoInMs(paymentSpec.minutesAgo);
  const providerIds = buildProviderIds(paymentSpec.provider, createdAtMs);
  const paymentId = createMockUlid(createdAtMs);
  const startStatus = paymentSpec.startStatus ?? "requires_payment";
  const createdAt = new Date(createdAtMs).toISOString();

  return {
    id: paymentId,
    provider: paymentSpec.provider,
    provider_name: providerNames[paymentSpec.provider],
    provider_reference: Object.values(providerIds)[0] ?? paymentId,
    provider_ids: providerIds,
    amount_minor: paymentSpec.amountMinor,
    currency: paymentSpec.currency,
    status: startStatus,
    customer_email: paymentSpec.customer.email,
    customer_name: paymentSpec.customer.name,
    customer_phone: paymentSpec.customer.phone ?? null,
    failure_code: null,
    refunded_minor: 0,
    captured_minor: 0,
    method: paymentSpec.method ?? null,
    method_key: readFixtureMethodKey(paymentSpec.method),
    line_items: paymentSpec.lineItems,
    metadata: { order_id: `ord_${paymentId.slice(-6)}` },
    success_url: paymentSpec.hasCheckout ? `${shopUrl}/success` : null,
    fail_url: paymentSpec.hasCheckout ? `${shopUrl}/fail` : null,
    cancel_url: paymentSpec.hasCheckout ? `${shopUrl}/cancel` : null,
    checkout_url:
      paymentSpec.hasCheckout && startStatus !== "authorized"
        ? `http://127.0.0.1:8025/pay/${paymentId}`
        : null,
    redirect: null,
    dispute: null,
    timeline: [
      {
        kind: "created",
        description: paymentSpec.hasCheckout
          ? "Checkout session created"
          : "Payment created",
        created_at: createdAt,
      },
      ...(startStatus === "requires_action"
        ? [
            {
              kind: "three_ds" as const,
              description: "Waiting for the 3-D Secure challenge",
              created_at: createdAt,
            },
          ]
        : []),
      ...(startStatus === "authorized"
        ? [
            {
              kind: "authorized" as const,
              description: "Authorized, waiting for capture",
              created_at: createdAt,
            },
          ]
        : []),
    ],
    notifications: [],
    created_at: createdAt,
  };
}

/**
 * Payments in every state, built by running the same Simulate steps the UI
 * uses, so timelines and notification deliveries are consistent (PY-09).
 */
export function buildPaymentFixtures(
  mockDatabase: Pick<
    MockDatabase,
    "webhookEndpoints" | "webhookDeliveries" | "paymentGateways"
  >,
): PaymentDetail[] {
  return paymentSpecs.map((paymentSpec) => {
    const paymentDetail = buildPayment(paymentSpec);
    paymentSpec.steps.forEach((simulateRequest, stepIndex) => {
      const stepAtMs = minutesAgoInMs(
        paymentSpec.minutesAgo - (stepIndex + 1) * 0.5,
      );
      simulatePayment(mockDatabase, paymentDetail, simulateRequest, stepAtMs);
    });

    return paymentDetail;
  });
}
