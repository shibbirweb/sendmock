import { faker } from "@faker-js/faker/locale/en";

import type {
  CapturedHttpRequest,
  HttpBin,
  HttpMockResponse,
} from "@/lib/api/types";
import { plainDefaultResponse } from "@/lib/http/http-bin-presets";
import { findAnsweringRule } from "@/lib/http/match-response-rule";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  buildResponseContext,
  renderMockResponse,
} from "@/mocks/http/render-mock-response";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

export type IncomingHttpRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
};

const simulatedFailureResponse = (statusCode: number): HttpMockResponse => ({
  status_code: statusCode,
  headers: { "content-type": "application/json" },
  body: '{"error":"Simulated failure"}',
});

/** `/catch/<bin>/...` names the bin; anything else goes to `default`. */
function readBinName(path: string): string {
  const [, firstSegment, binSegment] = path.split("/");

  return firstSegment === "catch" &&
    binSegment !== undefined &&
    binSegment !== ""
    ? binSegment
    : "default";
}

/** The bin of that name, created on first use without a preset (HC-01.1). */
function findOrCreateBin(mockDatabase: MockDatabase, binName: string): HttpBin {
  const existingBin = mockDatabase.httpBins.find(
    (httpBin) => httpBin.name === binName,
  );
  if (existingBin !== undefined) {
    return existingBin;
  }

  const createdBin: HttpBin = {
    id: createMockUlid(),
    name: binName,
    preset: null,
    request_count: 0,
    last_request_at: null,
    default_response: plainDefaultResponse,
  };
  mockDatabase.httpBins.push(createdBin);
  mockDatabase.httpResponseRules.set(createdBin.id, []);

  return createdBin;
}

/**
 * Records a request to the catcher and answers it as the server would:
 * the first matching enabled rule, else the bin's default reply, with the
 * rule's failure rate and delay applied (HC-01.1, HC-02.1 to HC-02.3).
 */
export function captureHttpRequest(
  mockDatabase: MockDatabase,
  incomingRequest: IncomingHttpRequest,
): CapturedHttpRequest {
  const requestUrl = new URL(incomingRequest.url);
  const httpBin = findOrCreateBin(
    mockDatabase,
    readBinName(requestUrl.pathname),
  );
  const contentType = incomingRequest.headers["content-type"] ?? null;
  const capturedAt = new Date();
  const receivedRequest: CapturedHttpRequest = {
    id: createMockUlid(capturedAt.getTime()),
    bin_id: httpBin.id,
    bin_name: httpBin.name,
    method: incomingRequest.method.toUpperCase(),
    url: incomingRequest.url,
    path: requestUrl.pathname,
    query: Object.fromEntries(requestUrl.searchParams),
    headers: incomingRequest.headers,
    body: incomingRequest.body,
    content_type: contentType,
    files: [],
    client_ip: "127.0.0.1",
    response_status: 0,
    response_headers: {},
    response_body: "",
    matched_rule_id: null,
    matched_rule_name: null,
    is_simulated_failure: false,
    duration_ms: 0,
    created_at: capturedAt.toISOString(),
  };
  const answeringRule = findAnsweringRule(
    mockDatabase.httpResponseRules.get(httpBin.id) ?? [],
    receivedRequest,
  );
  const isSimulatedFailure =
    answeringRule !== null &&
    faker.number.int({ min: 1, max: 100 }) <=
      answeringRule.failure_rate_percent;
  const mockResponse = isSimulatedFailure
    ? simulatedFailureResponse(answeringRule.failure_status_code)
    : (answeringRule?.response ?? httpBin.default_response);
  const { response } = renderMockResponse(
    mockResponse,
    buildResponseContext(receivedRequest, mockDatabase.webhookVariables),
  );
  const capturedRequest: CapturedHttpRequest = {
    ...receivedRequest,
    response_status: response.status_code,
    response_headers: response.headers,
    response_body: response.body,
    matched_rule_id: answeringRule?.id ?? null,
    matched_rule_name: answeringRule?.name ?? null,
    is_simulated_failure: isSimulatedFailure,
    duration_ms:
      answeringRule === null
        ? faker.number.int({ min: 1, max: 4 })
        : faker.number.int({
            min: answeringRule.delay_min_ms,
            max: answeringRule.delay_max_ms,
          }) + 1,
  };
  mockDatabase.capturedHttpRequests.unshift(capturedRequest);
  httpBin.request_count += 1;
  httpBin.last_request_at = capturedRequest.created_at;
  publishMockEvent("http.captured", { id: capturedRequest.id });

  return capturedRequest;
}

/** Whether a webhook URL points at SendMock's own catcher. */
export function isCatcherUrl(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith("/catch/");
  } catch {
    return false;
  }
}
