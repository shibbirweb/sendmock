import { describe, expect, test } from "vitest";

import {
  isEmailAddressText,
  parseEmailAddress,
  splitAddressList,
} from "@/lib/email/email-address-text";

describe("parseEmailAddress", () => {
  test("EM-17.6 reads a quoted name with a comma and an escaped quote", () => {
    expect(
      parseEmailAddress('"[ABC] Pat Lee, Jr" <office@example.test>'),
    ).toEqual({ name: "[ABC] Pat Lee, Jr", address: "office@example.test" });
    expect(parseEmailAddress('"Pat \\"PL\\" Lee" <pat@example.test>')).toEqual({
      name: 'Pat "PL" Lee',
      address: "pat@example.test",
    });
  });

  test("reads a plain name or a bare address", () => {
    expect(parseEmailAddress("Ann Lee <ann@example.test>")).toEqual({
      name: "Ann Lee",
      address: "ann@example.test",
    });
    expect(parseEmailAddress(" ann@example.test ")).toEqual({
      name: "",
      address: "ann@example.test",
    });
  });
});

describe("splitAddressList", () => {
  test("EM-17.7 splits on commas and semicolons outside quotes and brackets", () => {
    expect(
      splitAddressList(
        '"[ABC] Pat Lee, Jr" <office@example.test>, ann@example.test; Bo <bo@example.test>,',
      ),
    ).toEqual([
      '"[ABC] Pat Lee, Jr" <office@example.test>',
      "ann@example.test",
      "Bo <bo@example.test>",
    ]);
  });
});

describe("isEmailAddressText", () => {
  test("EM-17.7 accepts an address with a mailbox and a domain only", () => {
    expect(isEmailAddressText("Ann <ann@example.test>")).toBe(true);
    expect(isEmailAddressText("ann@example.test")).toBe(true);
    expect(isEmailAddressText("ann")).toBe(false);
    expect(isEmailAddressText("[ABC] Pat Lee")).toBe(false);
  });
});
