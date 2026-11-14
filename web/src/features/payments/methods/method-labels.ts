import type {
  PaymentFlowDefinition,
  PaymentMethodDefinition,
  PaymentMethodInput,
  PaymentStepType,
  TestNumberValue,
} from "@/lib/api/types";
import { defaultTestCards } from "@/lib/payments/test-instruments";

function hasStep(
  paymentFlow: Pick<PaymentFlowDefinition, "steps"> | undefined,
  stepType: PaymentStepType,
): boolean {
  return (paymentFlow?.steps ?? []).some(
    (flowStep) => flowStep.type === stepType,
  );
}

/** What a method's test values come to, for the table: they follow its flow (PY-12.6). */
export function countTestValues(
  paymentMethod: PaymentMethodDefinition,
  paymentFlow: PaymentFlowDefinition | undefined,
): string {
  if (hasStep(paymentFlow, "card_form")) {
    return `${paymentMethod.test_cards.length} test cards`;
  }
  if (hasStep(paymentFlow, "account_number")) {
    return `${paymentMethod.test_numbers.length} test numbers`;
  }
  if (hasStep(paymentFlow, "voucher_code")) {
    return `${paymentMethod.test_numbers.length} test codes`;
  }
  if (hasStep(paymentFlow, "signed_in_account")) {
    return paymentMethod.test_account;
  }

  return `Always ${paymentMethod.default_outcome === "decline" ? "declines" : "succeeds"}`;
}

function buildTestNumbers(
  paymentFlow: PaymentFlowDefinition,
): TestNumberValue[] {
  if (hasStep(paymentFlow, "voucher_code")) {
    return [
      { number: "GIFT0001", outcome: "succeed", decline_reason: null },
      {
        number: "GIFT0002",
        outcome: "decline",
        decline_reason: "insufficient_funds",
      },
    ];
  }
  if (!hasStep(paymentFlow, "account_number")) {
    return [];
  }

  return [
    { number: "01600000001", outcome: "succeed", decline_reason: null },
    {
      number: "01600000002",
      outcome: "decline",
      decline_reason: "insufficient_funds",
    },
    ...(hasStep(paymentFlow, "pin")
      ? [
          {
            number: "01600000003",
            outcome: "wrong_pin" as const,
            decline_reason: null,
          },
        ]
      : []),
  ];
}

/** A new method's starting values for its flow's steps (PY-12.1, PY-12.6). */
export function buildNewMethodInput(
  paymentFlow: PaymentFlowDefinition,
  name: string,
  key: string,
): PaymentMethodInput {
  return {
    key,
    name,
    flow: paymentFlow.key,
    accent: "#0d9488",
    is_enabled: true,
    test_cards: hasStep(paymentFlow, "card_form")
      ? defaultTestCards.slice(0, 3)
      : [],
    test_numbers: buildTestNumbers(paymentFlow),
    otp: "123456",
    pin: "12121",
    default_outcome: "succeed",
    test_account: hasStep(paymentFlow, "signed_in_account")
      ? "test-buyer@example.com"
      : "",
  };
}
