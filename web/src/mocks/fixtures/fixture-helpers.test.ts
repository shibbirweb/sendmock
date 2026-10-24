import { describe, expect, test } from "vitest";

import {
  createMockUlid,
  extractFixtureData,
} from "@/mocks/fixtures/fixture-helpers";

describe("extractFixtureData", () => {
  test("EM-05.1 finds a code that follows a keyword", () => {
    expect(extractFixtureData("Your verification code is 482913.").otp).toEqual(
      ["482913"],
    );
  });

  test("EM-05.1 finds a code that comes before 'is your'", () => {
    expect(extractFixtureData("550199 is your Acme code").otp).toEqual([
      "550199",
    ]);
  });

  test("EM-05.2 extracts each link once", () => {
    expect(
      extractFixtureData(
        "Reset: https://acme.test/reset?token=9f8e and again https://acme.test/reset?token=9f8e",
      ).links,
    ).toEqual(["https://acme.test/reset?token=9f8e"]);
  });

  test("ignores numbers without an OTP keyword nearby", () => {
    expect(extractFixtureData("Order 10293 shipped in 2026").otp).toEqual([]);
  });
});

describe("createMockUlid", () => {
  test("IDs sort by creation time", () => {
    const olderId = createMockUlid(1_700_000_000_000);
    const newerId = createMockUlid(1_800_000_000_000);

    expect(olderId.length).toBe(26);
    expect(newerId > olderId).toBe(true);
  });
});
