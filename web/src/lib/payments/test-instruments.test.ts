import { describe, expect, test } from "vitest";

import {
  checkCardNumber,
  checkWallet,
  passesLuhnCheck,
  readCardBrand,
  testCards,
} from "@/lib/payments/test-instruments";

describe("test cards", () => {
  test("every documented test card passes the Luhn check", () => {
    for (const testCard of testCards) {
      expect(passesLuhnCheck(testCard.number)).toBe(true);
    }
  });

  test("each test card gives its documented outcome, spaces allowed", () => {
    expect(checkCardNumber("4242 4242 4242 4242")).toEqual({
      kind: "test_card",
      outcome: { kind: "succeed" },
    });
    expect(checkCardNumber("4000-0000-0000-9995")).toEqual({
      kind: "test_card",
      outcome: { kind: "decline", reason: "insufficient_funds" },
    });
    expect(checkCardNumber("4000002500003155")).toEqual({
      kind: "test_card",
      outcome: { kind: "three_ds" },
    });
  });

  test("PY-01.1 a real-looking card is refused; an invalid one is invalid", () => {
    expect(checkCardNumber("4111 1111 1111 1111")).toEqual({
      kind: "not_test_card",
    });
    expect(checkCardNumber("4242 4242 4242 4241")).toEqual({ kind: "invalid" });
    expect(checkCardNumber("abc")).toEqual({ kind: "invalid" });
  });

  test("names the brand from the number", () => {
    expect(readCardBrand("4242424242424242")).toBe("visa");
    expect(readCardBrand("5555555555554444")).toBe("mastercard");
  });
});

describe("test wallets", () => {
  test("a wallet needs the test OTP and PIN; each wallet gives its outcome", () => {
    expect(checkWallet("01770000001", "123456", "12121")).toEqual({
      kind: "succeed",
    });
    expect(checkWallet("01770000002", "123456", "12121")).toEqual({
      kind: "decline",
      reason: "insufficient_funds",
    });
    expect(checkWallet("01770000003", "123456", "12121")).toEqual({
      kind: "wrong_pin",
    });
    expect(checkWallet("01770000001", "000000", "12121")).toEqual({
      kind: "error",
      message: "The verification code is wrong",
    });
    expect(checkWallet("01999999999", "123456", "12121")).toEqual({
      kind: "error",
      message: "Use a test wallet",
    });
  });
});
