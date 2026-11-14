import type { HttpResponseRule } from "@/lib/api/types";
import { findFirstFilterError } from "@/lib/webhooks/rule-filter/validate-rule-filter";

export const maxResponseDelayMs = 30_000;

export type ResponseRuleFieldErrors = Partial<
  Record<
    "name" | "path_glob" | "filter" | "status_code" | "delay" | "failure",
    string
  >
>;

function isStatusCode(statusCode: number): boolean {
  return Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599;
}

/** Rules for a response rule, shared by the editor and the API (HC-02.4). */
export function validateResponseRule(
  responseRule: HttpResponseRule,
): ResponseRuleFieldErrors {
  const fieldErrors: ResponseRuleFieldErrors = {};
  const filterError = findFirstFilterError(responseRule.filter);
  const pathGlob = responseRule.path_glob.trim();

  if (responseRule.name.trim() === "") {
    fieldErrors.name = "Enter a name";
  }
  if (pathGlob !== "" && !pathGlob.startsWith("/")) {
    fieldErrors.path_glob = "Start the path with /, e.g. /v1/*";
  }
  if (filterError !== undefined) {
    fieldErrors.filter = filterError;
  }
  if (!isStatusCode(responseRule.response.status_code)) {
    fieldErrors.status_code = "Use a status code from 100 to 599";
  }
  const { delay_min_ms: delayMinMs, delay_max_ms: delayMaxMs } = responseRule;
  if (
    !Number.isInteger(delayMinMs) ||
    !Number.isInteger(delayMaxMs) ||
    delayMinMs < 0 ||
    delayMaxMs > maxResponseDelayMs ||
    delayMinMs > delayMaxMs
  ) {
    fieldErrors.delay = "Use 0 to 30,000 ms, the shortest first";
  }
  if (
    !Number.isInteger(responseRule.failure_rate_percent) ||
    responseRule.failure_rate_percent < 0 ||
    responseRule.failure_rate_percent > 100 ||
    !isStatusCode(responseRule.failure_status_code)
  ) {
    fieldErrors.failure = "Use 0 to 100% and a status code from 100 to 599";
  }

  return fieldErrors;
}
