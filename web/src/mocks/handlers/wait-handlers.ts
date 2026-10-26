import { http, HttpResponse } from "msw";

import { mockDatabase } from "@/mocks/db/mock-database";
import {
  findLatestLinks,
  findLatestOtp,
} from "@/mocks/automation/find-latest-extracted";
import {
  parseWaitTimeout,
  readWaitSince,
  waitForMatch,
} from "@/mocks/automation/wait-for-match";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
  includesText,
} from "@/mocks/handlers/handler-utils";
import { buildDeliveryDetail } from "@/mocks/webhooks/delivery-detail";

type WaitQuery = URLSearchParams;

function readWaitWindow(waitQuery: WaitQuery) {
  return {
    sinceMs: readWaitSince(waitQuery.get("since"), Date.now()),
    timeoutMs: parseWaitTimeout(waitQuery.get("timeout")),
  };
}

function isAfter(timestamp: string, sinceMs: number): boolean {
  return Date.parse(timestamp) >= sinceMs;
}

/** An empty filter matches everything; otherwise the text must be contained. */
function matchesFilter(actualText: string, wantedText: string | null): boolean {
  return (
    wantedText === null ||
    wantedText === "" ||
    includesText(actualText, wantedText)
  );
}

function createTimeoutResponse(itemName: string) {
  return createErrorResponse(408, "timeout", `No ${itemName} arrived in time`);
}

/** Long-poll helpers for tests (docs/plan/06-api.md, test-automation helpers). */
export const waitHandlers = [
  http.get("*/api/v1/wait/email", async ({ request }) => {
    await applyMockConditions();
    const waitQuery = new URL(request.url).searchParams;
    const { sinceMs, timeoutMs } = readWaitWindow(waitQuery);
    const matchedEmail = await waitForMatch(
      () =>
        mockDatabase.emails.find(
          (email) =>
            isAfter(email.received_at, sinceMs) &&
            matchesFilter(
              email.to.map((address) => address.address).join(" "),
              waitQuery.get("to"),
            ) &&
            matchesFilter(email.subject, waitQuery.get("subject")),
        ),
      timeoutMs,
    );

    return matchedEmail === undefined
      ? createTimeoutResponse("email")
      : HttpResponse.json(matchedEmail);
  }),

  http.get("*/api/v1/wait/sms", async ({ request }) => {
    await applyMockConditions();
    const waitQuery = new URL(request.url).searchParams;
    const { sinceMs, timeoutMs } = readWaitWindow(waitQuery);
    const matchedMessage = await waitForMatch(
      () =>
        mockDatabase.smsMessages.find(
          (smsMessage) =>
            isAfter(smsMessage.created_at, sinceMs) &&
            matchesFilter(smsMessage.to_number, waitQuery.get("to")) &&
            matchesFilter(smsMessage.from_number, waitQuery.get("from")),
        ),
      timeoutMs,
    );

    return matchedMessage === undefined
      ? createTimeoutResponse("SMS")
      : HttpResponse.json(matchedMessage);
  }),

  http.get("*/api/v1/wait/http", async ({ request }) => {
    await applyMockConditions();
    const waitQuery = new URL(request.url).searchParams;
    const { sinceMs, timeoutMs } = readWaitWindow(waitQuery);
    const matchedRequest = await waitForMatch(
      () =>
        mockDatabase.capturedHttpRequests.find(
          (capturedRequest) =>
            isAfter(capturedRequest.created_at, sinceMs) &&
            matchesFilter(capturedRequest.bin_name, waitQuery.get("bin")) &&
            matchesFilter(capturedRequest.method, waitQuery.get("method")),
        ),
      timeoutMs,
    );

    return matchedRequest === undefined
      ? createTimeoutResponse("request")
      : HttpResponse.json(matchedRequest);
  }),

  http.get("*/api/v1/wait/webhook", async ({ request }) => {
    await applyMockConditions();
    const waitQuery = new URL(request.url).searchParams;
    const { sinceMs, timeoutMs } = readWaitWindow(waitQuery);
    const wantedEndpoint = waitQuery.get("endpoint");
    const matchedDelivery = await waitForMatch(
      () =>
        mockDatabase.webhookDeliveries.find((webhookDelivery) => {
          const endpointRecord = mockDatabase.webhookEndpoints.find(
            (candidate) => candidate.id === webhookDelivery.endpoint_id,
          );
          const isEndpointMatch =
            wantedEndpoint === null ||
            wantedEndpoint === "" ||
            webhookDelivery.endpoint_id === wantedEndpoint ||
            endpointRecord?.name === wantedEndpoint;

          return (
            isAfter(webhookDelivery.created_at, sinceMs) &&
            isEndpointMatch &&
            matchesFilter(webhookDelivery.event_type, waitQuery.get("event")) &&
            matchesFilter(webhookDelivery.status, waitQuery.get("status"))
          );
        }),
      timeoutMs,
    );

    return matchedDelivery === undefined
      ? createTimeoutResponse("delivery")
      : HttpResponse.json(buildDeliveryDetail(mockDatabase, matchedDelivery));
  }),

  http.get("*/api/v1/wait/payment", async ({ request }) => {
    await applyMockConditions();
    const waitQuery = new URL(request.url).searchParams;
    const { sinceMs, timeoutMs } = readWaitWindow(waitQuery);
    const matchedPayment = await waitForMatch(
      () =>
        mockDatabase.payments.find(
          (payment) =>
            isAfter(payment.created_at, sinceMs) &&
            matchesFilter(payment.provider, waitQuery.get("provider")) &&
            matchesFilter(payment.status, waitQuery.get("status")),
        ),
      timeoutMs,
    );

    return matchedPayment === undefined
      ? createTimeoutResponse("payment")
      : HttpResponse.json(matchedPayment);
  }),

  http.get("*/api/v1/otp", async ({ request }) => {
    await applyMockConditions();
    const lookupQuery = new URL(request.url).searchParams;
    const findOtp = () =>
      findLatestOtp(
        mockDatabase,
        lookupQuery.get("to") ?? "",
        lookupQuery.get("channel"),
      );
    const timeoutText = lookupQuery.get("timeout");
    if (timeoutText === null) {
      const otpLookup = findOtp();
      return otpLookup === undefined
        ? createNotFoundResponse("Code")
        : HttpResponse.json(otpLookup);
    }
    const otpLookup = await waitForMatch(
      findOtp,
      parseWaitTimeout(timeoutText),
    );

    return otpLookup === undefined
      ? createTimeoutResponse("code")
      : HttpResponse.json(otpLookup);
  }),

  http.get("*/api/v1/links", async ({ request }) => {
    await applyMockConditions();
    const lookupQuery = new URL(request.url).searchParams;
    const findLinks = () =>
      findLatestLinks(mockDatabase.emails, lookupQuery.get("to") ?? "");
    const timeoutText = lookupQuery.get("timeout");
    if (timeoutText === null) {
      const linksLookup = findLinks();
      return linksLookup === undefined
        ? createNotFoundResponse("Links")
        : HttpResponse.json(linksLookup);
    }
    const linksLookup = await waitForMatch(
      findLinks,
      parseWaitTimeout(timeoutText),
    );

    return linksLookup === undefined
      ? createTimeoutResponse("links")
      : HttpResponse.json(linksLookup);
  }),
];
