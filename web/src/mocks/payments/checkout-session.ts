import type {
  CheckoutSession,
  CheckoutState,
  PaymentDetail,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { findGatewayRecord } from "@/mocks/payments/payment-gateway-record";
import { presentPaymentFlow } from "@/mocks/payments/payment-flow-record";
import { listGatewayMethods } from "@/mocks/payments/payment-method-record";

const merchantName = "Acme Shop";

type SessionDatabase = Pick<
  MockDatabase,
  "paymentMethods" | "paymentFlows" | "payments" | "paymentGateways"
>;

/** Where the checkout stands for the customer, from the payment (PY-03.3). */
export function readCheckoutState(paymentDetail: PaymentDetail): CheckoutState {
  if (paymentDetail.status === "requires_action") {
    return "requires_three_ds";
  }
  if (paymentDetail.status === "requires_payment") {
    return paymentDetail.checkout_url === null ? "pending" : "open";
  }
  if (paymentDetail.status === "failed") {
    return "failed";
  }
  if (paymentDetail.status === "canceled") {
    return paymentDetail.failure_code === "expired" ? "expired" : "canceled";
  }

  return "completed";
}

/** What the test checkout page shows: the gateway's methods and the flows they run (PY-12.3, PY-12.6). */
export function toCheckoutSession(
  mockDatabase: SessionDatabase,
  paymentDetail: PaymentDetail,
): CheckoutSession {
  const paymentGateway = findGatewayRecord(
    mockDatabase,
    paymentDetail.provider,
  );
  const gatewayMethods = listGatewayMethods(
    mockDatabase,
    paymentDetail.provider,
  );

  return {
    session_id: paymentDetail.id,
    payment_id: paymentDetail.id,
    provider: paymentDetail.provider,
    provider_name: paymentGateway?.name ?? paymentDetail.provider,
    merchant_name: merchantName,
    amount_minor: paymentDetail.amount_minor,
    currency: paymentDetail.currency,
    line_items: paymentDetail.line_items,
    customer_email: paymentDetail.customer_email,
    accent: paymentGateway?.accent ?? "#0d9488",
    methods: gatewayMethods,
    flows: mockDatabase.paymentFlows
      .filter((flowRecord) =>
        gatewayMethods.some(
          (paymentMethod) => paymentMethod.flow === flowRecord.key,
        ),
      )
      .map((flowRecord) => presentPaymentFlow(mockDatabase, flowRecord)),
    state: readCheckoutState(paymentDetail),
    failure_code: paymentDetail.failure_code,
    redirect: paymentDetail.redirect,
  };
}
