import { http, HttpResponse } from "msw";

import type { ApiRequestLogEntry, SmtpSession } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createNotFoundResponse,
  includesText,
  paginateItems,
} from "@/mocks/handlers/handler-utils";
import { publishTrafficCleared } from "@/mocks/realtime/publish-traffic-cleared";

function matchesSmtpFilters(
  smtpSession: SmtpSession,
  requestUrl: URL,
): boolean {
  const resultFilter = requestUrl.searchParams.get("result");
  const searchText = requestUrl.searchParams.get("query") ?? "";

  if (resultFilter && !resultFilter.split(",").includes(smtpSession.result)) {
    return false;
  }

  return [
    smtpSession.remote_address,
    smtpSession.helo_name,
    smtpSession.auth_user,
  ].some((searchedField) => includesText(searchedField, searchText));
}

function matchesApiRequestFilters(
  apiRequest: ApiRequestLogEntry,
  requestUrl: URL,
): boolean {
  const apiFilter = requestUrl.searchParams.get("api");
  const statusClassFilter = requestUrl.searchParams.get("status_class");
  const pathFilter = requestUrl.searchParams.get("path") ?? "";

  if (apiFilter && apiRequest.api !== apiFilter) {
    return false;
  }
  if (
    statusClassFilter &&
    `${Math.floor(apiRequest.response_status / 100)}xx` !== statusClassFilter
  ) {
    return false;
  }

  return includesText(apiRequest.path, pathFilter);
}

/** SMTP session log and API request log (EM-09, SM-13). */
export const logsHandlers = [
  http.get("*/api/v1/logs/smtp", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const requestUrl = new URL(request.url);

    return HttpResponse.json(
      paginateItems(
        mockDatabase.smtpSessions.filter((smtpSession) =>
          matchesSmtpFilters(smtpSession, requestUrl),
        ),
        requestUrl,
      ),
    );
  }),

  http.get("*/api/v1/logs/smtp/:sessionId", async ({ params }) => {
    await applyMockConditions();
    const smtpSession = mockDatabase.smtpSessions.find(
      (existingSession) => existingSession.id === params.sessionId,
    );

    return smtpSession
      ? HttpResponse.json(smtpSession)
      : createNotFoundResponse("SMTP session");
  }),

  http.delete("*/api/v1/logs/smtp", async ({ request }) => {
    await applyMockConditions();
    const requestUrl = new URL(request.url);
    const keptSessions = mockDatabase.smtpSessions.filter(
      (smtpSession) => !matchesSmtpFilters(smtpSession, requestUrl),
    );
    const deletedCount = mockDatabase.smtpSessions.length - keptSessions.length;
    mockDatabase.smtpSessions = keptSessions;
    publishTrafficCleared(["smtp_session"], null, deletedCount);

    return new HttpResponse(null, { status: 204 });
  }),

  http.delete("*/api/v1/logs/smtp/:sessionId", async ({ params }) => {
    await applyMockConditions();
    mockDatabase.smtpSessions = mockDatabase.smtpSessions.filter(
      (smtpSession) => smtpSession.id !== params.sessionId,
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/v1/logs/http", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const requestUrl = new URL(request.url);

    return HttpResponse.json(
      paginateItems(
        mockDatabase.apiRequestLog.filter((apiRequest) =>
          matchesApiRequestFilters(apiRequest, requestUrl),
        ),
        requestUrl,
      ),
    );
  }),

  http.get("*/api/v1/logs/http/:requestId", async ({ params }) => {
    await applyMockConditions();
    const apiRequest = mockDatabase.apiRequestLog.find(
      (existingRequest) => existingRequest.id === params.requestId,
    );

    return apiRequest
      ? HttpResponse.json(apiRequest)
      : createNotFoundResponse("API request");
  }),

  http.delete("*/api/v1/logs/http", async ({ request }) => {
    await applyMockConditions();
    const requestUrl = new URL(request.url);
    const keptRequests = mockDatabase.apiRequestLog.filter(
      (apiRequest) => !matchesApiRequestFilters(apiRequest, requestUrl),
    );
    const deletedCount =
      mockDatabase.apiRequestLog.length - keptRequests.length;
    mockDatabase.apiRequestLog = keptRequests;
    publishTrafficCleared(["api_request"], null, deletedCount);

    return new HttpResponse(null, { status: 204 });
  }),

  http.delete("*/api/v1/logs/http/:requestId", async ({ params }) => {
    await applyMockConditions();
    mockDatabase.apiRequestLog = mockDatabase.apiRequestLog.filter(
      (apiRequest) => apiRequest.id !== params.requestId,
    );

    return new HttpResponse(null, { status: 204 });
  }),
];
