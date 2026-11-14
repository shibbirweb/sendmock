import type {
  MessageProviderInput,
  ProviderErrorKind,
  ProviderMessagePart,
  ProviderSampleRequest,
} from "@/lib/api/types";

/** Why a request is refused: the error kind, the part and a sentence. */
export type ProviderFailure = {
  kind: ProviderErrorKind;
  part: string;
  reason: string;
};

const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const phonePattern = /^\+[1-9]\d{6,14}$/;

/** The first check the request fails, in the provider's rule order. */
export function findFailure(
  providerInput: MessageProviderInput,
  partValues: Map<ProviderMessagePart, string[]>,
): ProviderFailure | undefined {
  for (const validationRule of providerInput.validation_rules) {
    const values = partValues.get(validationRule.part) ?? [];
    const isFailing =
      (validationRule.check === "required" && values.length === 0) ||
      (validationRule.check === "email_address" &&
        values.some((value) => !emailPattern.test(value))) ||
      (validationRule.check === "e164_number" &&
        values.some((value) => !phonePattern.test(value))) ||
      (validationRule.check === "max_length" &&
        values.some(
          (value) => value.length > (validationRule.max_length ?? Infinity),
        ));
    if (isFailing) {
      return {
        kind: validationRule.error_kind,
        part: validationRule.part,
        reason: `${validationRule.part} failed the ${validationRule.check} check`,
      };
    }
  }

  return undefined;
}

/** Wrong credentials, when the provider checks them: no secret appears in the request. */
export function hasValidCredentials(
  providerInput: MessageProviderInput,
  sampleRequest: ProviderSampleRequest,
): boolean {
  const secretValues = providerInput.credentials
    .filter((credential) => credential.is_secret)
    .map((credential) => credential.value);
  const requestText = `${JSON.stringify(sampleRequest.headers)} ${sampleRequest.body}`;

  return (
    !providerInput.check_credentials ||
    secretValues.length === 0 ||
    secretValues.some((secretValue) => requestText.includes(secretValue))
  );
}
