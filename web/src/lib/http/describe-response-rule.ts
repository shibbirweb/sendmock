import type { HttpResponseRule } from "@/lib/api/types";
import { describeRuleFilter } from "@/lib/webhooks/rule-filter/describe-rule-filter";

function describeDelay(responseRule: HttpResponseRule): string {
  const { delay_min_ms: delayMinMs, delay_max_ms: delayMaxMs } = responseRule;
  if (delayMaxMs === 0) {
    return "";
  }
  const toSeconds = (delayMs: number) => `${delayMs / 1000}`;

  return delayMinMs === delayMaxMs
    ? ` after ${toSeconds(delayMaxMs)} s`
    : ` after ${toSeconds(delayMinMs)} to ${toSeconds(delayMaxMs)} s`;
}

/**
 * One line for the rules list, e.g. "POST /v1/* when header x-env is
 * test: 429 after 0.5 to 2 s, 10% fail with 500" (HC-02.4).
 */
export function describeResponseRule(responseRule: HttpResponseRule): string {
  const matchParts = [
    responseRule.method ?? "Any method",
    responseRule.path_glob.trim() === "" ? "any path" : responseRule.path_glob,
  ];
  const filterSummary =
    responseRule.filter === null
      ? ""
      : ` when ${describeRuleFilter(responseRule.filter)}`;
  const failureSummary =
    responseRule.failure_rate_percent > 0
      ? `, ${responseRule.failure_rate_percent}% fail with ${responseRule.failure_status_code}`
      : "";

  return `${matchParts.join(" ")}${filterSummary}: ${responseRule.response.status_code}${describeDelay(responseRule)}${failureSummary}`;
}
