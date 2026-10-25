import type { CapturedHttpRequest, HttpResponseRule } from "@/lib/api/types";
import { evaluateRuleFilter } from "@/lib/webhooks/rule-filter/evaluate-rule-filter";
import { globToRegex } from "@/lib/webhooks/rule-filter/rule-operators";

/** `/catch/slack/v1/send` in bin `slack` is `/v1/send`; the bin root is `/`. */
export function readPathInBin(capturedPath: string, binName: string): string {
  const binPrefix = `/catch/${binName}`;
  const pathInBin = capturedPath.startsWith(binPrefix)
    ? capturedPath.slice(binPrefix.length)
    : capturedPath;

  return pathInBin === "" ? "/" : pathInBin;
}

/** Whether a rule answers a request, and why not (HC-02.1). */
export function matchResponseRule(
  responseRule: HttpResponseRule,
  capturedRequest: CapturedHttpRequest,
): { isMatch: boolean; mismatchReason: string | null } {
  const pathInBin = readPathInBin(
    capturedRequest.path,
    capturedRequest.bin_name,
  );
  if (
    responseRule.method !== null &&
    responseRule.method !== capturedRequest.method.toUpperCase()
  ) {
    return {
      isMatch: false,
      mismatchReason: `Method is ${capturedRequest.method}, not ${responseRule.method}`,
    };
  }
  if (
    responseRule.path_glob.trim() !== "" &&
    !globToRegex(responseRule.path_glob.trim()).test(pathInBin)
  ) {
    return {
      isMatch: false,
      mismatchReason: `Path ${pathInBin} does not match ${responseRule.path_glob}`,
    };
  }
  if (
    !evaluateRuleFilter(responseRule.filter, {
      messageKind: "http",
      capturedRequest,
    })
  ) {
    return {
      isMatch: false,
      mismatchReason: "The header and body conditions do not match",
    };
  }

  return { isMatch: true, mismatchReason: null };
}

/** The first enabled rule that matches, or null for the default reply. */
export function findAnsweringRule(
  responseRules: HttpResponseRule[],
  capturedRequest: CapturedHttpRequest,
): HttpResponseRule | null {
  return (
    responseRules.find(
      (responseRule) =>
        responseRule.is_enabled &&
        matchResponseRule(responseRule, capturedRequest).isMatch,
    ) ?? null
  );
}
