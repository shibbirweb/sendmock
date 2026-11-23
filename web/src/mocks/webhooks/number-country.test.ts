import { describe, expect, test } from "vitest";

import { findNumberCountry } from "@/mocks/webhooks/number-country";

describe("findNumberCountry", () => {
  test("SM-22.2 names a number's country from its longest calling code, or none", () => {
    expect(findNumberCountry("+8801711000000")).toBe("BD");
    expect(findNumberCountry("+15550001111")).toBe("US");
    expect(findNumberCountry("+8613800000000")).toBe("");
  });
});
