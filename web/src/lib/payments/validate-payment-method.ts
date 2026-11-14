import type {
  PaymentFlowStep,
  PaymentMethodDefinition,
  PaymentMethodInput,
} from "@/lib/api/types";
import {
  isTestCardRange,
  passesLuhnCheck,
  toCardDigits,
  toTestNumber,
} from "@/lib/payments/test-instruments";

export type PaymentMethodFieldErrors = Partial<
  Record<
    | "key"
    | "name"
    | "flow"
    | "accent"
    | "test_cards"
    | "test_numbers"
    | "otp"
    | "pin"
    | "test_account",
    string
  >
>;

const methodKeyPattern = /^[a-z][a-z0-9_]{1,31}$/;

function findTestCardError(
  methodInput: PaymentMethodInput,
): string | undefined {
  if (methodInput.test_cards.length === 0) {
    return "Add at least one test card";
  }
  const cardNumbers = methodInput.test_cards.map((testCard) =>
    toCardDigits(testCard.number),
  );
  const badNumber = cardNumbers.find(
    (cardDigits) =>
      !passesLuhnCheck(cardDigits) || !isTestCardRange(cardDigits),
  );
  if (badNumber !== undefined) {
    return `${badNumber} is not a test card: use a number from the test ranges (4242 4242 4242..., 4000 00..., 4000 02..., 5555 5555 5555...) that passes the Luhn check`;
  }

  return new Set(cardNumbers).size === cardNumbers.length
    ? undefined
    : "Each test card number appears once";
}

const testNumberRules = {
  account_number: {
    pattern: /^\d{8,15}$/,
    message: "Test numbers are 8 to 15 digits",
  },
  voucher_code: {
    pattern: /^[A-Z0-9]{4,24}$/,
    message: "Voucher codes are 4 to 24 letters or digits",
  },
};

function findTestNumberError(
  methodInput: PaymentMethodInput,
  stepTypes: PaymentFlowStep["type"][],
): string | undefined {
  const numberRule = stepTypes.includes("voucher_code")
    ? testNumberRules.voucher_code
    : testNumberRules.account_number;
  const testNumbers = methodInput.test_numbers.map((testNumber) =>
    toTestNumber(testNumber.number),
  );
  if (testNumbers.length === 0) {
    return "Add at least one test value";
  }
  if (testNumbers.some((testNumber) => !numberRule.pattern.test(testNumber))) {
    return numberRule.message;
  }
  if (
    !stepTypes.includes("pin") &&
    methodInput.test_numbers.some(
      (testNumber) => testNumber.outcome === "wrong_pin",
    )
  ) {
    return "Wrong PIN needs a PIN step in the flow";
  }

  return new Set(testNumbers).size === testNumbers.length
    ? undefined
    : "Each test value appears once";
}

/**
 * Rules for a payment method, shared by the Methods screen and the API
 * (PY-12.1): the test values checked are the ones its flow's steps read
 * (PY-12.6), so a method of an unknown flow is refused.
 */
export function validatePaymentMethod(
  methodInput: PaymentMethodInput,
  existingMethods: Pick<PaymentMethodDefinition, "key">[],
  isNew: boolean,
  flowSteps: PaymentFlowStep[] | undefined,
): PaymentMethodFieldErrors {
  const fieldErrors: PaymentMethodFieldErrors = {};
  if (isNew && !methodKeyPattern.test(methodInput.key)) {
    fieldErrors.key =
      "Use 2 to 32 lowercase letters, digits or _, starting with a letter";
  } else if (
    isNew &&
    existingMethods.some(
      (existingMethod) => existingMethod.key === methodInput.key,
    )
  ) {
    fieldErrors.key = `A method with the key ${methodInput.key} already exists`;
  }
  if (methodInput.name.trim() === "") {
    fieldErrors.name = "Enter a name";
  }
  if (!/^#[0-9a-f]{6}$/i.test(methodInput.accent)) {
    fieldErrors.accent = "Use a colour like #e2136e";
  }
  if (flowSteps === undefined) {
    fieldErrors.flow = "Pick a flow";
  }
  const stepTypes = (flowSteps ?? []).map((flowStep) => flowStep.type);
  if (stepTypes.includes("card_form")) {
    fieldErrors.test_cards = findTestCardError(methodInput);
  }
  if (
    stepTypes.includes("account_number") ||
    stepTypes.includes("voucher_code")
  ) {
    fieldErrors.test_numbers = findTestNumberError(methodInput, stepTypes);
  }
  if (stepTypes.includes("otp") && !/^\d{4,8}$/.test(methodInput.otp)) {
    fieldErrors.otp = "Use 4 to 8 digits";
  }
  if (stepTypes.includes("pin") && !/^\d{4,6}$/.test(methodInput.pin)) {
    fieldErrors.pin = "Use 4 to 6 digits";
  }
  if (
    stepTypes.includes("signed_in_account") &&
    methodInput.test_account.trim() === ""
  ) {
    fieldErrors.test_account = "Enter the test account";
  }

  return Object.fromEntries(
    Object.entries(fieldErrors).filter(
      ([, fieldError]) => fieldError !== undefined,
    ),
  ) as PaymentMethodFieldErrors;
}
