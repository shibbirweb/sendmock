import { describe, expect, test } from "vitest";

import {
  checkCardNumber,
  defaultTestCards,
  describeTestOutcome,
  findTestNumber,
  isTestCardRange,
  passesLuhnCheck,
  readCardBrand,
  toTestNumber,
} from "@/lib/payments/test-instruments";

const bkashNumbers = [
  { number: "01770000001", outcome: "succeed" as const, decline_reason: null },
  {
    number: "01770000002",
    outcome: "decline" as const,
    decline_reason: "insufficient_funds" as const,
  },
];

describe("test cards", () => {
  test("every default test card passes the Luhn check and sits in a test range", () => {
    for (const testCard of defaultTestCards) {
      expect(passesLuhnCheck(testCard.number)).toBe(true);
      expect(isTestCardRange(testCard.number)).toBe(true);
    }
  });

  test("each test card gives its outcome, spaces allowed", () => {
    expect(
      checkCardNumber("4242 4242 4242 4242", defaultTestCards),
    ).toMatchObject({
      kind: "test_card",
      testCard: { outcome: "succeed" },
    });
    expect(
      checkCardNumber("4000-0000-0000-9995", defaultTestCards),
    ).toMatchObject({
      kind: "test_card",
      testCard: { outcome: "decline", decline_reason: "insufficient_funds" },
    });
  });

  test("PY-01.1 a real-looking card is refused; an invalid one is invalid", () => {
    expect(checkCardNumber("4111 1111 1111 1111", defaultTestCards)).toEqual({
      kind: "not_test_card",
    });
    expect(checkCardNumber("4242 4242 4242 4241", defaultTestCards)).toEqual({
      kind: "invalid",
    });
    expect(isTestCardRange("4111111111111111")).toBe(false);
  });

  test("names the brand and describes outcomes", () => {
    expect(readCardBrand("5555555555554444")).toBe("mastercard");
    expect(
      describeTestOutcome({
        outcome: "decline",
        decline_reason: "incorrect_cvc",
      }),
    ).toBe("Declined: incorrect CVC");
    expect(
      describeTestOutcome({ outcome: "three_ds", decline_reason: null }),
    ).toBe("Requires 3-D Secure");
  });
});

describe("test numbers", () => {
  test("a typed number matches its test value with spaces, dashes or lower case", () => {
    expect(findTestNumber(bkashNumbers, "01770-000 001")).toEqual(
      bkashNumbers[0],
    );
    expect(findTestNumber(bkashNumbers, "01999999999")).toBeUndefined();
    expect(toTestNumber("gift 00-01")).toBe("GIFT0001");
  });
});
