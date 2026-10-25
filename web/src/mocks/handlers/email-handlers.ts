import { http, HttpResponse } from "msw";

import type {
  EmailDetail,
  EmailSummary,
  EmailUpdate,
  NativeSendRequest,
  OpenSource,
  SimulatedEmailOutcome,
} from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { buildEmailFixture } from "@/mocks/fixtures/email-fixture-builder";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
  includesText,
  paginateItems,
  parseEmailAddress,
} from "@/mocks/handlers/handler-utils";
import { recordNativeApiRequest } from "@/mocks/handlers/record-api-request";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

function toEmailSummary(email: EmailDetail): EmailSummary {
  return {
    id: email.id,
    received_at: email.received_at,
    from: email.from,
    to: email.to,
    subject: email.subject,
    snippet: email.snippet,
    size_bytes: email.size_bytes,
    attachment_count: email.attachment_count,
    is_read: email.is_read,
    tags: email.tags,
    source: email.source,
    delivery_status: email.delivery_status,
    open_count: email.open_count,
    has_otp: email.has_otp,
    direction: email.direction,
    response_kind: email.response_kind,
  };
}

function matchesEmailFilters(email: EmailDetail, requestUrl: URL): boolean {
  const searchParameters = requestUrl.searchParams;
  const searchQuery = searchParameters.get("query");
  const fromFilter = searchParameters.get("from");
  const toFilter = searchParameters.get("to");
  const tagFilter = searchParameters.get("tag");
  const sourceFilter = searchParameters.get("source");
  const directionFilter = searchParameters.get("direction");

  if (
    searchQuery &&
    !includesText(email.subject, searchQuery) &&
    !includesText(email.snippet, searchQuery) &&
    !includesText(email.from.address, searchQuery)
  ) {
    return false;
  }
  if (fromFilter && !includesText(email.from.address, fromFilter)) {
    return false;
  }
  if (
    toFilter &&
    !email.to.some((recipient) => includesText(recipient.address, toFilter))
  ) {
    return false;
  }
  if (tagFilter && !email.tags.includes(tagFilter)) {
    return false;
  }
  if (sourceFilter && email.source !== sourceFilter) {
    return false;
  }
  if (directionFilter && email.direction !== directionFilter) {
    return false;
  }
  if (searchParameters.get("is_unread") === "true" && email.is_read) {
    return false;
  }
  if (
    searchParameters.get("has_attachment") === "true" &&
    email.attachment_count === 0
  ) {
    return false;
  }

  return true;
}

function findEmail(emailId: unknown): EmailDetail | undefined {
  return mockDatabase.emails.find((email) => email.id === emailId);
}

export const emailHandlers = [
  http.post("*/api/v1/send", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const nativeSendRequest = (await request.json()) as NativeSendRequest;
    if (!nativeSendRequest.from || (nativeSendRequest.to ?? []).length === 0) {
      recordNativeApiRequest({
        path: "/api/v1/send",
        requestBody: nativeSendRequest,
        responseStatus: 400,
        responseBody: {
          error: {
            code: "invalid_request",
            message: "from and to are required",
          },
        },
      });

      return createErrorResponse(
        400,
        "invalid_request",
        "from and to are required",
      );
    }

    const emailFixture = buildEmailFixture({
      minutesAgo: 0,
      from: parseEmailAddress(nativeSendRequest.from),
      to: nativeSendRequest.to.map(parseEmailAddress),
      subject: nativeSendRequest.subject,
      textBody: nativeSendRequest.text ?? null,
      htmlBody: nativeSendRequest.html ?? null,
      tags: nativeSendRequest.tags ?? [],
      source: "native_api",
    });
    recordNativeApiRequest({
      path: "/api/v1/send",
      requestBody: nativeSendRequest,
      responseStatus: 201,
      responseBody: { id: emailFixture.email.id },
      linkedMessage: {
        kind: "email",
        id: emailFixture.email.id,
        sms_thread_id: null,
      },
    });
    mockDatabase.emails.unshift(emailFixture.email);
    mockDatabase.emailTimelines.set(
      emailFixture.email.id,
      emailFixture.timeline,
    );
    publishMockEvent("email.received", {
      id: emailFixture.email.id,
      subject: emailFixture.email.subject,
    });

    return HttpResponse.json({ id: emailFixture.email.id }, { status: 201 });
  }),

  http.get("*/api/v1/emails", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const requestUrl = new URL(request.url);
    const matchingEmails = mockDatabase.emails
      .filter((email) => matchesEmailFilters(email, requestUrl))
      .map(toEmailSummary);

    return HttpResponse.json(paginateItems(matchingEmails, requestUrl));
  }),

  http.get("*/api/v1/emails/:emailId", async ({ params }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const email = findEmail(params.emailId);

    return email ? HttpResponse.json(email) : createNotFoundResponse("Email");
  }),

  http.get("*/api/v1/emails/:emailId/timeline", async ({ params }) => {
    await applyMockConditions();

    return HttpResponse.json(
      mockDatabase.emailTimelines.get(String(params.emailId)) ?? [],
    );
  }),

  http.patch("*/api/v1/emails/:emailId", async ({ params, request }) => {
    await applyMockConditions();
    const email = findEmail(params.emailId);
    if (!email) {
      return createNotFoundResponse("Email");
    }

    const emailUpdate = (await request.json()) as EmailUpdate;
    Object.assign(email, {
      is_read: emailUpdate.is_read ?? email.is_read,
      tags: emailUpdate.tags ?? email.tags,
    });

    return HttpResponse.json(toEmailSummary(email));
  }),

  http.post("*/api/v1/emails/:emailId/open", async ({ params, request }) => {
    await applyMockConditions();
    const email = findEmail(params.emailId);
    if (!email) {
      return createNotFoundResponse("Email");
    }

    const { source } = (await request.json()) as { source?: OpenSource };
    email.open_count += 1;
    email.opened_at = email.opened_at ?? new Date().toISOString();
    publishMockEvent("email.opened", {
      id: email.id,
      source: source ?? "api",
      open_count: email.open_count,
    });

    return new HttpResponse(null, { status: 204 });
  }),

  http.post(
    "*/api/v1/emails/:emailId/simulate",
    async ({ params, request }) => {
      await applyMockConditions();
      const email = findEmail(params.emailId);
      if (!email) {
        return createNotFoundResponse("Email");
      }

      const simulatedOutcome = (await request.json()) as SimulatedEmailOutcome;
      email.delivery_status = simulatedOutcome.event;
      mockDatabase.emailTimelines.get(email.id)?.push({
        kind: simulatedOutcome.event,
        at: new Date().toISOString(),
        detail: `Simulated ${simulatedOutcome.event}`,
      });
      publishMockEvent(`email.${simulatedOutcome.event}`, { id: email.id });

      return new HttpResponse(null, { status: 204 });
    },
  ),

  http.delete("*/api/v1/emails/:emailId", async ({ params }) => {
    await applyMockConditions();
    mockDatabase.emails = mockDatabase.emails.filter(
      (email) => email.id !== params.emailId,
    );
    publishMockEvent("email.deleted", { id: params.emailId });

    return new HttpResponse(null, { status: 204 });
  }),

  http.delete("*/api/v1/emails", async () => {
    await applyMockConditions();
    mockDatabase.emails = [];
    publishMockEvent("email.deleted", { id: null });

    return new HttpResponse(null, { status: 204 });
  }),
];
