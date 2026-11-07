import type {
  PaymentDetail,
  PaymentSimulateRequest,
  PaymentSubscription,
  TestCardValue,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { createTestCheckout } from "@/mocks/payments/create-test-checkout";
import { simulatePayment } from "@/mocks/payments/simulate-payment";

export type SubscriptionDatabase = Pick<
  MockDatabase,
  | "payments"
  | "paymentGateways"
  | "paymentMethods"
  | "paymentSubscriptions"
  | "webhookEndpoints"
  | "webhookDeliveries"
  | "settings"
>;

/** The card method's test card with this number, or none for a real card. */
export function findTestCard(
  mockDatabase: Pick<MockDatabase, "paymentMethods">,
  cardNumber: string,
): TestCardValue | undefined {
  const cardMethod = mockDatabase.paymentMethods.find(
    (paymentMethod) => paymentMethod.key === "card",
  );

  return cardMethod?.test_cards.find(
    (testCard) => testCard.number === cardNumber.replaceAll(" ", ""),
  );
}

function readCardOutcome(testCard: TestCardValue): PaymentSimulateRequest {
  return testCard.outcome === "decline"
    ? {
        action: "decline",
        decline_reason: testCard.decline_reason ?? "generic_decline",
      }
    : { action: "succeed" };
}

/** Charges one period through the gateway as a payment and answers it. */
export function chargeSubscription(
  mockDatabase: SubscriptionDatabase,
  subscription: PaymentSubscription,
  testCard: TestCardValue,
  nowMs: number,
): PaymentDetail {
  const renewalPayment = createTestCheckout(
    mockDatabase,
    {
      provider: subscription.provider,
      amount_minor: subscription.amount_minor,
      currency: subscription.currency,
      customer_email: subscription.customer_email,
      line_items: [
        {
          name: subscription.plan_name,
          quantity: 1,
          unit_amount_minor: subscription.amount_minor,
        },
      ],
    },
    nowMs,
  );
  renewalPayment.metadata = { subscription_id: subscription.id };
  if (renewalPayment.status === "requires_payment") {
    simulatePayment(
      mockDatabase,
      renewalPayment,
      readCardOutcome(testCard),
      nowMs + 1,
    );
  }
  subscription.payment_ids.push(renewalPayment.id);

  return renewalPayment;
}
