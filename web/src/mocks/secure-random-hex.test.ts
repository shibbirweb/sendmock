import { afterEach, describe, expect, test, vi } from "vitest";

import { createSecureRandomHex } from "./secure-random-hex";

describe("createSecureRandomHex", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("makes the requested number of lowercase hex digits", () => {
    expect(createSecureRandomHex(32)).toMatch(/^[0-9a-f]{32}$/);
    expect(createSecureRandomHex(7)).toMatch(/^[0-9a-f]{7}$/);
  });

  test("takes its digits from crypto.getRandomValues, never Math.random", () => {
    const secureSource = vi.spyOn(crypto, "getRandomValues");
    const insecureSource = vi.spyOn(Math, "random");

    createSecureRandomHex(32);

    expect(secureSource).toHaveBeenCalledTimes(1);
    expect(insecureSource).not.toHaveBeenCalled();
  });
});
