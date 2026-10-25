import type { VerifyServiceInput } from "@/lib/api/types";

export const verifyCodeLengthRange = { min: 4, max: 10 };
export const verifyTtlSecondsRange = { min: 60, max: 86_400 };
const maxFriendlyNameLength = 64;

export type VerifyServiceFieldErrors = Partial<
  Record<keyof VerifyServiceInput, string>
>;

function isWholeNumberBetween(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * The Verify service rules (VF-01.2, VF-01.3), shared by the Services form
 * and the API: code length 4 to 10, an optional all-digit fixed code of
 * exactly that length, and a TTL from 1 minute to 24 hours.
 */
export function validateVerifyServiceInput(
  serviceInput: VerifyServiceInput,
): VerifyServiceFieldErrors {
  const fieldErrors: VerifyServiceFieldErrors = {};
  const friendlyName = serviceInput.friendly_name.trim();

  if (friendlyName === "") {
    fieldErrors.friendly_name = "Enter a name";
  } else if (friendlyName.length > maxFriendlyNameLength) {
    fieldErrors.friendly_name = `Use at most ${maxFriendlyNameLength} characters`;
  }
  if (
    !isWholeNumberBetween(
      serviceInput.code_length,
      verifyCodeLengthRange.min,
      verifyCodeLengthRange.max,
    )
  ) {
    fieldErrors.code_length = `Choose ${verifyCodeLengthRange.min} to ${verifyCodeLengthRange.max} digits`;
  }
  if (serviceInput.fixed_code !== null) {
    if (!/^\d+$/.test(serviceInput.fixed_code)) {
      fieldErrors.fixed_code = "Use digits only";
    } else if (serviceInput.fixed_code.length !== serviceInput.code_length) {
      fieldErrors.fixed_code = `Use exactly ${serviceInput.code_length} digits`;
    }
  }
  if (
    !isWholeNumberBetween(
      serviceInput.ttl_seconds,
      verifyTtlSecondsRange.min,
      verifyTtlSecondsRange.max,
    )
  ) {
    fieldErrors.ttl_seconds = "Choose 1 minute to 24 hours";
  }

  return fieldErrors;
}
