import type { VirtualNumberInput } from "@/lib/api/types";
import { httpUrlError, isHttpUrl } from "@/lib/numbers/validate-webhook-url";

const e164Pattern = /^\+[1-9]\d{6,14}$/;

export type VirtualNumberFieldErrors = Partial<
  Record<keyof VirtualNumberInput, string>
>;

/**
 * Rules for a virtual number (SM-12.3), shared by the form and the API:
 * E.164, not registered yet, at least one channel, http(s) URLs.
 * `registeredNumbers` excludes the number being edited.
 */
export function validateVirtualNumberInput(
  numberInput: VirtualNumberInput,
  registeredNumbers: string[],
): VirtualNumberFieldErrors {
  const fieldErrors: VirtualNumberFieldErrors = {};

  if (!e164Pattern.test(numberInput.number)) {
    fieldErrors.number = "Use E.164, for example +15550001111";
  } else if (registeredNumbers.includes(numberInput.number)) {
    fieldErrors.number = "This number is already registered";
  }
  if (numberInput.label.trim() === "") {
    fieldErrors.label = "Enter a label";
  }
  if (numberInput.channels.length === 0) {
    fieldErrors.channels = "Pick at least one channel";
  }

  const urlFields = [
    "inbound_url",
    "inbound_fallback_url",
    "status_callback_url",
  ] as const;
  for (const urlField of urlFields) {
    const urlValue = numberInput[urlField];
    if (urlValue !== null && !isHttpUrl(urlValue)) {
      fieldErrors[urlField] = httpUrlError;
    }
  }

  return fieldErrors;
}
