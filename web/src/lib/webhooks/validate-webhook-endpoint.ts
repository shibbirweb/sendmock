import type { WebhookEndpointInput } from "@/lib/api/types";
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

/**
 * Rules for an endpoint (WH-01.5), shared by the edit sheet and the API:
 * a name, an http(s) URL (templates allowed), timeout 1 to 60 s, 1 to 10
 * attempts and retry delays of 1 s to 24 h.
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
