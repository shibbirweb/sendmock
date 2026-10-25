import { toCheckoutCard } from "@/features/checkout/steps/card-form-step";
import type { FlowEntries } from "@/features/checkout/steps/step-view-props";
import type {
  CheckoutCompleteRequest,
  PaymentFlowDefinition,
  PaymentMethodDefinition,
} from "@/lib/api/types";

/** What the flow's steps collected, as the complete request; only its own steps' entries are sent. */
export function buildPayRequest(
  paymentMethod: PaymentMethodDefinition,
  paymentFlow: PaymentFlowDefinition,
  flowEntries: FlowEntries,
): CheckoutCompleteRequest {
  const stepTypes = paymentFlow.steps.map((flowStep) => flowStep.type);
  const checkoutCard = stepTypes.includes("card_form")
    ? toCheckoutCard(flowEntries.cardDraft)
    : null;

  return {
    action: "pay",
    method_key: paymentMethod.key,
    ...(checkoutCard === null ? {} : { card: checkoutCard }),
    entries: {
      ...(stepTypes.includes("account_number") ||
      stepTypes.includes("voucher_code")
        ? { number: flowEntries.number }
        : {}),
      ...(stepTypes.includes("otp") ? { otp: flowEntries.otp } : {}),
      ...(stepTypes.includes("pin") ? { pin: flowEntries.pin } : {}),
    },
  };
}

/** A successful payment with the method's first succeeding test values, for the test controls. */
export function buildQuickPayRequest(
  paymentMethod: PaymentMethodDefinition | undefined,
): CheckoutCompleteRequest {
  if (paymentMethod === undefined) {
    return { action: "pay" };
  }
  const succeedingCard = paymentMethod.test_cards.find(
    (testCard) => testCard.outcome === "succeed",
  );
  const succeedingNumber = paymentMethod.test_numbers.find(
    (testNumber) => testNumber.outcome === "succeed",
  );

  return {
    action: "pay",
    method_key: paymentMethod.key,
    ...(succeedingCard === undefined
      ? {}
      : {
          card: {
            number: succeedingCard.number,
            exp_month: 12,
            exp_year: 2034,
            cvc: "123",
            holder_name: "Test Customer",
          },
        }),
    entries: {
      number: succeedingNumber?.number,
      otp: paymentMethod.otp,
      pin: paymentMethod.pin,
    },
  };
}
