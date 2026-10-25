import type {
  DeclineReason,
  TestCardValue,
  TestNumberValue,
} from "@/lib/api/types";

/** Stripe's documented test cards: the built-in Card method's values (17-payments). */
export const defaultTestCards: TestCardValue[] = [
  { number: "4242424242424242", outcome: "succeed", decline_reason: null },
  { number: "5555555555554444", outcome: "succeed", decline_reason: null },
  {
    number: "4000000000000002",
    outcome: "decline",
    decline_reason: "generic_decline",
  },
  {
    number: "4000000000009995",
    outcome: "decline",
    decline_reason: "insufficient_funds",
  },
  {
    number: "4000000000000069",
    outcome: "decline",
    decline_reason: "expired_card",
  },
  {
    number: "4000000000000127",
    outcome: "decline",
    decline_reason: "incorrect_cvc",
  },
  { number: "4000002500003155", outcome: "three_ds", decline_reason: null },
  {
    number: "4000000000000259",
    outcome: "succeed_then_dispute",
    decline_reason: null,
  },
];

/**
 * Card ranges reserved for testing; a test card must start with one, so a
 * real card can never be saved as a "test card" (PY-01.1).
 */
export const testCardPrefixes = [
  "424242424242",
  "400000",
  "400002",
  "555555555555",
];

/** Digits only, so "4242 4242 ..." and "4242-4242-..." match the table. */
export function toCardDigits(cardNumber: string): string {
  return cardNumber.replace(/[\s-]/g, "");
}

/** "4242 4242 4242 4242" for display. */
export function formatCardNumber(cardDigits: string): string {
  return cardDigits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** The Luhn checksum every real card number passes. */
export function passesLuhnCheck(cardDigits: string): boolean {
  if (!/^\d{12,19}$/.test(cardDigits)) {
    return false;
  }
  const digitSum = [...cardDigits]
    .reverse()
    .reduce((runningSum, digitText, digitIndex) => {
      const digitValue = Number(digitText);
      const weightedDigit = digitIndex % 2 === 1 ? digitValue * 2 : digitValue;
      return (
        runningSum + (weightedDigit > 9 ? weightedDigit - 9 : weightedDigit)
      );
    }, 0);

  return digitSum % 10 === 0;
}

export function isTestCardRange(cardDigits: string): boolean {
  return testCardPrefixes.some((testPrefix) =>
    cardDigits.startsWith(testPrefix),
  );
}

export type CardCheck =
  | { kind: "invalid" }
  | { kind: "not_test_card" }
  | { kind: "test_card"; testCard: TestCardValue };

/**
 * A typed card number against a method's test cards (PY-01.1): a number
 * that passes the Luhn check but is not one of them is refused, never used.
 */
export function checkCardNumber(
  cardNumber: string,
  testCards: TestCardValue[],
): CardCheck {
  const cardDigits = toCardDigits(cardNumber);
  const testCard = testCards.find(
    (candidateCard) => candidateCard.number === cardDigits,
  );
  if (testCard !== undefined) {
    return { kind: "test_card", testCard };
  }

  return passesLuhnCheck(cardDigits)
    ? { kind: "not_test_card" }
    : { kind: "invalid" };
}

export function readCardBrand(cardDigits: string): string {
  if (cardDigits.startsWith("4")) {
    return "visa";
  }
  if (/^5[1-5]/.test(cardDigits)) {
    return "mastercard";
  }

  return /^3[47]/.test(cardDigits) ? "amex" : "card";
}

const declineReasonWords: Record<DeclineReason, string> = {
  insufficient_funds: "insufficient funds",
  expired_card: "expired card",
  incorrect_cvc: "incorrect CVC",
  generic_decline: "generic decline",
  fraudulent: "fraud",
  authentication_failed: "authentication failed",
};

/** "Declined: insufficient funds", "Requires 3-D Secure" for tables and hints. */
export function describeTestOutcome(
  testValue:
    | Pick<TestCardValue, "outcome" | "decline_reason">
    | Pick<TestNumberValue, "outcome" | "decline_reason">,
): string {
  const outcomeLabels: Record<string, string> = {
    succeed: "Succeeds",
    three_ds: "Requires 3-D Secure",
    succeed_then_dispute: "Succeeds, then a dispute opens",
    wrong_pin: "Wrong PIN (asked again)",
  };
  if (testValue.outcome === "decline") {
    return `Declined: ${declineReasonWords[testValue.decline_reason ?? "generic_decline"]}`;
  }

  return outcomeLabels[testValue.outcome] ?? testValue.outcome;
}

/** "0177-000 0001" and "gift 2024" as stored: no spaces or dashes, upper case. */
export function toTestNumber(typedNumber: string): string {
  return typedNumber.replace(/[\s-]/g, "").toUpperCase();
}

/** The method's test number or voucher code the customer typed, if it is one. */
export function findTestNumber(
  testNumbers: TestNumberValue[],
  typedNumber: string,
): TestNumberValue | undefined {
  const normalizedNumber = toTestNumber(typedNumber);

  return testNumbers.find(
    (testNumber) => toTestNumber(testNumber.number) === normalizedNumber,
  );
}
