import type { EndpointBodyField, WebhookEndpointInput } from "@/lib/api/types";
import { httpUrlError, isHttpUrl } from "@/lib/numbers/validate-webhook-url";

export const endpointTimeoutLimitsMs = { minimum: 1_000, maximum: 60_000 };
export const maxAttemptLimits = { minimum: 1, maximum: 10 };
export const retryDelayLimitsSeconds = { minimum: 1, maximum: 86_400 };

export type WebhookEndpointFieldErrors = Partial<
  Record<keyof WebhookEndpointInput | "backoff_seconds", string>
>;

/** An absolute http(s) URL, or one whose templated parts start the URL or follow the scheme. */
function isEndpointUrl(urlText: string): boolean {
  if (!urlText.includes("{{")) {
    return isHttpUrl(urlText);
  }

  return /^(https?:\/\/|\{\{)/.test(urlText.trim());
}

function isWholeNumberBetween(
  numberValue: number,
  { minimum, maximum }: { minimum: number; maximum: number },
): boolean {
  return (
    Number.isInteger(numberValue) &&
    numberValue >= minimum &&
    numberValue <= maximum
  );
}

/** A fixed value (no `{{ }}`) that cannot become its type, or null; rendered values are checked by the preview. */
function findFixedValueError(bodyField: EndpointBodyField): string | null {
  const fieldValue = bodyField.value.trim();
  if (fieldValue.includes("{{")) {
    return null;
  }
  if (
    bodyField.value_type === "number" &&
    (fieldValue === "" || !Number.isFinite(Number(fieldValue)))
  ) {
    return `${bodyField.name} must be a number`;
  }
  if (
    bodyField.value_type === "boolean" &&
    fieldValue !== "true" &&
    fieldValue !== "false"
  ) {
    return `${bodyField.name} must be true or false`;
  }
  if (bodyField.value_type === "json") {
    try {
      JSON.parse(fieldValue);
    } catch {
      return `${bodyField.name} must be valid JSON`;
    }
  }

  return null;
}

/** Fields mode always encodes a valid body: named, unique fields whose fixed values fit their type (WH-07.14). */
function findBodyFieldsError(bodyFields: EndpointBodyField[]): string | null {
  const fieldNames = bodyFields.map((bodyField) => bodyField.name);
  if (fieldNames.some((fieldName) => fieldName === "")) {
    return "Every field needs a name";
  }
  const repeatedName = fieldNames.find(
    (fieldName, fieldIndex) => fieldNames.indexOf(fieldName) !== fieldIndex,
  );
  if (repeatedName !== undefined) {
    return `${repeatedName} is used twice`;
  }

  return (
    bodyFields
      .map(findFixedValueError)
      .find((valueError) => valueError !== null) ?? null
  );
}

/**
 * Rules for an endpoint (WH-01.5), shared by the edit sheet and the API:
 * a name, an http(s) URL (templates allowed), a valid Fields or Raw body,
 * timeout 1 to 60 s, 1 to 10 attempts and retry delays of 1 s to 24 h.
 */
export function validateWebhookEndpointInput(
  endpointInput: WebhookEndpointInput,
): WebhookEndpointFieldErrors {
  const fieldErrors: WebhookEndpointFieldErrors = {};
  const { retry_policy: retryPolicy } = endpointInput;

  if (endpointInput.name.trim() === "") {
    fieldErrors.name = "Enter a name";
  }
  if (!isEndpointUrl(endpointInput.url)) {
    fieldErrors.url = httpUrlError;
  }
  const bodyFieldsError =
    endpointInput.body_mode === "fields"
      ? findBodyFieldsError(endpointInput.body_fields)
      : null;
  if (bodyFieldsError !== null) {
    fieldErrors.body_fields = bodyFieldsError;
  }
  if (
    endpointInput.body_mode === "raw" &&
    endpointInput.raw_content_type.trim() === ""
  ) {
    fieldErrors.raw_content_type = "Enter a content type";
  }
  if (
    !isWholeNumberBetween(endpointInput.timeout_ms, endpointTimeoutLimitsMs)
  ) {
    fieldErrors.timeout_ms = "Use 1 to 60 seconds";
  }
  if (!isWholeNumberBetween(retryPolicy.max_attempts, maxAttemptLimits)) {
    fieldErrors.retry_policy = "Use 1 to 10 attempts";
  }
  if (
    retryPolicy.max_attempts > 1 &&
    retryPolicy.backoff_seconds.length === 0
  ) {
    fieldErrors.backoff_seconds = "Add at least one retry delay";
  } else if (
    retryPolicy.backoff_seconds.some(
      (delaySeconds) =>
        !isWholeNumberBetween(delaySeconds, retryDelayLimitsSeconds),
    )
  ) {
    fieldErrors.backoff_seconds = "Each delay must be 1 second to 24 hours";
  }

  return fieldErrors;
}
