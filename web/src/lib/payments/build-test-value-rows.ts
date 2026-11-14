import type {
  PaymentFlowDefinition,
  PaymentGatewayDefinition,
  PaymentMethodDefinition,
  PaymentStepType,
} from "@/lib/api/types";
import {
  describeTestOutcome,
  formatCardNumber,
} from "@/lib/payments/test-instruments";

export type TestValueRow = {
  methodName: string;
  /** Gateway names, or "No gateway yet". */
  offeredBy: string;
  /** What is typed; null when nothing is (the signed-in or fixed-outcome rows). */
  testValue: string | null;
  copyValue: string | null;
  outcome: string;
  /** "OTP 123456, PIN 12121", only what the flow asks for; empty otherwise. */
  codes: string;
};

export type TestValueTables = {
  cardRows: TestValueRow[];
  numberRows: TestValueRow[];
  otherRows: TestValueRow[];
};

function readStepTypes(
  paymentFlow: PaymentFlowDefinition | undefined,
): PaymentStepType[] {
  return (paymentFlow?.steps ?? []).map((flowStep) => flowStep.type);
}

function describeCodes(
  paymentMethod: PaymentMethodDefinition,
  stepTypes: PaymentStepType[],
): string {
  return [
    stepTypes.includes("otp") ? `OTP ${paymentMethod.otp}` : null,
    stepTypes.includes("pin") ? `PIN ${paymentMethod.pin}` : null,
  ]
    .filter((codePart) => codePart !== null)
    .join(", ");
}

function describeOtherMethod(
  paymentMethod: PaymentMethodDefinition,
  stepTypes: PaymentStepType[],
): string {
  const fixedOutcome =
    paymentMethod.default_outcome === "decline"
      ? "Always declined"
      : "Always succeeds";

  return stepTypes.includes("signed_in_account")
    ? `Signed in as ${paymentMethod.test_account}; ${fixedOutcome.toLowerCase()}`
    : fixedOutcome;
}

/**
 * The Settings > Payments test values (PY-09.4): every enabled method, read
 * through its flow so only what its checkout asks for is shown, each with the
 * gateways that offer it.
 */
export function buildTestValueTables(
  paymentMethods: PaymentMethodDefinition[],
  paymentFlows: PaymentFlowDefinition[],
  paymentGateways: PaymentGatewayDefinition[],
): TestValueTables {
  const testValueTables: TestValueTables = {
    cardRows: [],
    numberRows: [],
    otherRows: [],
  };
  paymentMethods
    .filter((paymentMethod) => paymentMethod.is_enabled)
    .forEach((paymentMethod) => {
      const stepTypes = readStepTypes(
        paymentFlows.find(
          (paymentFlow) => paymentFlow.key === paymentMethod.flow,
        ),
      );
      const gatewayNames = paymentGateways
        .filter((paymentGateway) =>
          paymentGateway.method_keys.includes(paymentMethod.key),
        )
        .map((paymentGateway) => paymentGateway.name);
      const baseRow = {
        methodName: paymentMethod.name,
        offeredBy:
          gatewayNames.length === 0
            ? "No gateway yet"
            : gatewayNames.join(", "),
        codes: describeCodes(paymentMethod, stepTypes),
      };
      if (stepTypes.includes("card_form")) {
        testValueTables.cardRows.push(
          ...paymentMethod.test_cards.map((testCard) => ({
            ...baseRow,
            testValue: formatCardNumber(testCard.number),
            copyValue: testCard.number,
            outcome: describeTestOutcome(testCard),
          })),
        );
      } else if (
        stepTypes.includes("account_number") ||
        stepTypes.includes("voucher_code")
      ) {
        testValueTables.numberRows.push(
          ...paymentMethod.test_numbers.map((testNumber) => ({
            ...baseRow,
            testValue: testNumber.number,
            copyValue: testNumber.number,
            outcome: describeTestOutcome(testNumber),
          })),
        );
      } else {
        testValueTables.otherRows.push({
          ...baseRow,
          testValue: null,
          copyValue: null,
          outcome: describeOtherMethod(paymentMethod, stepTypes),
        });
      }
    });

  return testValueTables;
}
