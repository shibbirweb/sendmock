import { describe, expect, test } from "vitest";

import { validateVerifyServiceInput } from "@/lib/verify/validate-verify-service";

const validServiceInput = {
  friendly_name: "Acme Login",
  code_length: 6,
  fixed_code: null,
  ttl_seconds: 600,
};

describe("validateVerifyServiceInput", () => {
  test("VF-01.3 accepts a valid service with a random code", () => {
    expect(validateVerifyServiceInput(validServiceInput)).toEqual({});
  });

  test("VF-01.3 accepts a fixed code of exactly the code length", () => {
    expect(
      validateVerifyServiceInput({
        ...validServiceInput,
        fixed_code: "123456",
      }),
    ).toEqual({});
  });

  test("VF-01.2 keeps the code length between 4 and 10", () => {
    expect(
      validateVerifyServiceInput({ ...validServiceInput, code_length: 3 })
        .code_length,
    ).toBe("Choose 4 to 10 digits");
    expect(
      validateVerifyServiceInput({ ...validServiceInput, code_length: 11 })
        .code_length,
    ).toBe("Choose 4 to 10 digits");
  });

  test("VF-01.3 rejects fixed codes with letters or the wrong length", () => {
    expect(
      validateVerifyServiceInput({ ...validServiceInput, fixed_code: "12ab56" })
        .fixed_code,
    ).toBe("Use digits only");
    expect(
      validateVerifyServiceInput({ ...validServiceInput, fixed_code: "1234" })
        .fixed_code,
    ).toBe("Use exactly 6 digits");
  });

  test("requires a name and a TTL from 1 minute to 24 hours", () => {
    const fieldErrors = validateVerifyServiceInput({
      ...validServiceInput,
      friendly_name: "  ",
      ttl_seconds: 30,
    });

    expect(fieldErrors.friendly_name).toBe("Enter a name");
    expect(fieldErrors.ttl_seconds).toBe("Choose 1 minute to 24 hours");
  });
});
