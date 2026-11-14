import type { CapturedHttpRequest, HttpResponseRule } from "@/lib/api/types";

/** A captured request for tests, with any fields replaced. */
export function buildTestCapturedRequest(
  changedFields: Partial<CapturedHttpRequest> = {},
): CapturedHttpRequest {
  return {
    id: "01JREQUEST",
    bin_id: "01JBIN",
    bin_name: "analytics",
    method: "POST",
    url: "http://127.0.0.1:8025/catch/analytics/track",
    path: "/catch/analytics/track",
    query: {},
    headers: {
      "content-type": "application/json",
      "x-test-mode": "rate-limit",
    },
    body: '{"event":"signup"}',
    content_type: "application/json",
    files: [],
    client_ip: "127.0.0.1",
    response_status: 200,
    response_headers: {},
    response_body: "",
    matched_rule_id: null,
    matched_rule_name: null,
    is_simulated_failure: false,
    duration_ms: 1,
    created_at: "2026-10-25T10:00:00.000Z",
    ...changedFields,
  };
}

/** A response rule for tests, with any fields replaced. */
export function buildTestResponseRule(
  changedFields: Partial<HttpResponseRule> = {},
): HttpResponseRule {
  return {
    id: "01JRULE",
    name: "Rate limited",
    is_enabled: true,
    method: null,
    path_glob: "",
    filter: null,
    response: {
      status_code: 429,
      headers: {},
      body: '{"error":"rate_limited"}',
    },
    delay_min_ms: 0,
    delay_max_ms: 0,
    failure_rate_percent: 0,
    failure_status_code: 500,
    ...changedFields,
  };
}
