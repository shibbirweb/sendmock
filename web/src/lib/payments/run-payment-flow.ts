import type {
  CheckoutCompleteRequest,
  DeclineReason,
  PaymentFlowStep,
  PaymentMethod,
  PaymentMethodDefinition,
  PaymentStepType,
  TestCardValue,
  TestNumberValue,
} from "@/lib/api/types";
import {
  checkCardNumber,
  findTestNumber,
  readCardBrand,
  toCardDigits,
  toTestNumber,
} from "@/lib/payments/test-instruments";

export type FlowOutcome =
  | { kind: "succeed" }
  | { kind: "succeed_then_dispute" }
  | { kind: "three_ds" }
  | { kind: "decline"; reason: DeclineReason };

export type FlowRun =
  | { kind: "refused"; message: string }
  | { kind: "finished"; outcome: FlowOutcome; paidWith: PaymentMethod };

type MethodValues = Pick<
  PaymentMethodDefinition,
  | "name"
  | "test_cards"
  | "test_numbers"
  | "otp"
  | "pin"
  | "default_outcome"
  | "test_account"
>;

type DecidedValue = TestCardValue | TestNumberValue;

/** What one step found: a refusal, or the test value it decided and what was paid with. */
type StepVerdict = {
  refusal?: string;
  decidedValue?: DecidedValue;
  paidWith?: PaymentMethod;
};

type StepCheck = (
  methodValues: MethodValues,
  checkoutRequest: CheckoutCompleteRequest,
  decidedSoFar: DecidedValue | undefined,
) => StepVerdict;

const checkCardForm: StepCheck = (methodValues, checkoutRequest) => {
  const checkoutCard = checkoutRequest.card;
  if (checkoutCard === undefined) {
    return { refusal: "Enter a card" };
  }
  const cardCheck = checkCardNumber(
    checkoutCard.number,
    methodValues.test_cards,
  );
  if (cardCheck.kind === "invalid") {
    return { refusal: "Enter a valid card number" };
  }
  if (cardCheck.kind === "not_test_card") {
    // A real card: refused before anything about it is kept (PY-01.1).
    return { refusal: "Use a test card: real card numbers are never accepted" };
  }
  const cardDigits = toCardDigits(checkoutCard.number);

  return {
    decidedValue: cardCheck.testCard,
    paidWith: {
      kind: "card",
      brand: readCardBrand(cardDigits),
      last4: cardDigits.slice(-4),
      exp_month: checkoutCard.exp_month,
      exp_year: checkoutCard.exp_year,
    },
  };
};

function buildNumberCheck(
  missingMessage: string,
  unknownMessage: string,
  maskNumber: (normalizedNumber: string) => string,
): StepCheck {
  return (methodValues, checkoutRequest) => {
    const typedNumber = checkoutRequest.entries?.number ?? "";
    if (typedNumber.trim() === "") {
      return { refusal: missingMessage };
    }
    const testNumber = findTestNumber(methodValues.test_numbers, typedNumber);
    if (testNumber === undefined) {
      return { refusal: unknownMessage };
    }

    return {
      decidedValue: testNumber,
      paidWith: {
        kind: "wallet",
        wallet_name: methodValues.name,
        masked_number: maskNumber(toTestNumber(typedNumber)),
      },
    };
  };
}

/** One check per step type; a new step type adds an entry (PY-12.6). */
const stepChecks: Record<PaymentStepType, StepCheck> = {
  card_form: checkCardForm,
  account_number: buildNumberCheck(
    "Enter the account number",
    "Use one of the test numbers",
    (normalizedNumber) =>
      `${normalizedNumber.slice(0, 5)}****${normalizedNumber.slice(-2)}`,
  ),
  voucher_code: buildNumberCheck(
    "Enter the voucher code",
    "Use one of the test voucher codes",
    (normalizedCode) => `****${normalizedCode.slice(-4)}`,
  ),
  otp: (methodValues, checkoutRequest) =>
    checkoutRequest.entries?.otp === methodValues.otp
      ? {}
      : { refusal: "The verification code is wrong" },
  pin: (methodValues, checkoutRequest, decidedSoFar) =>
    decidedSoFar?.outcome === "wrong_pin" ||
    checkoutRequest.entries?.pin !== methodValues.pin
      ? { refusal: "Wrong PIN. Try again." }
      : {},
  signed_in_account: (methodValues) => ({
    paidWith: {
      kind: "wallet",
      wallet_name: methodValues.name,
      masked_number: methodValues.test_account,
    },
  }),
  qr_code: () => ({}),
  reference_code: () => ({}),
  confirm: () => ({}),
};

function readOutcome(
  methodValues: MethodValues,
  decidedValue: DecidedValue | undefined,
): FlowOutcome {
  const outcome = decidedValue?.outcome ?? methodValues.default_outcome;
  if (outcome === "decline") {
    return {
      kind: "decline",
      reason: decidedValue?.decline_reason ?? "generic_decline",
    };
  }
  if (outcome === "three_ds" || outcome === "succeed_then_dispute") {
    return { kind: outcome };
  }

  return { kind: "succeed" };
}

/**
 * Checks what the customer entered against a method's test values, one step
 * at a time and in the flow's order (PY-12.6): the first refusal stops it,
 * else the deciding step's test value (or the default outcome) decides.
 */
export function runPaymentFlow(
  flowSteps: PaymentFlowStep[],
  methodValues: MethodValues,
  checkoutRequest: CheckoutCompleteRequest,
): FlowRun {
  let decidedValue: DecidedValue | undefined;
  let paidWith: PaymentMethod = { kind: "bank", bank_name: methodValues.name };
  for (const flowStep of flowSteps) {
    const stepVerdict = stepChecks[flowStep.type](
      methodValues,
      checkoutRequest,
      decidedValue,
    );
    if (stepVerdict.refusal !== undefined) {
      return { kind: "refused", message: stepVerdict.refusal };
    }
    decidedValue = stepVerdict.decidedValue ?? decidedValue;
    paidWith = stepVerdict.paidWith ?? paidWith;
  }

  return {
    kind: "finished",
    outcome: readOutcome(methodValues, decidedValue),
    paidWith,
  };
}
