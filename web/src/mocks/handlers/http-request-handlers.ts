import { faker } from "@faker-js/faker/locale/en";
import { http, HttpResponse } from "msw";

import type { HttpForwardRequest, HttpForwardResult } from "@/lib/api/types";
import { isHttpUrl } from "@/lib/numbers/validate-webhook-url";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
  paginateItems,
} from "@/mocks/handlers/handler-utils";
import { captureHttpRequest } from "@/mocks/http/capture-http-request";

function findCapturedRequest(requestId: unknown) {
  return mockDatabase.capturedHttpRequests.find(
    (capturedRequest) => capturedRequest.id === requestId,
  );
}

export const httpRequestHandlers = [
  http.get("*/api/v1/http/requests", async ({ request }) => {
    await applyMockConditions();
    const requestUrl = new URL(request.url);
    const binFilter = requestUrl.searchParams.get("bin_id");
    const matchingRequests = mockDatabase.capturedHttpRequests.filter(
      (capturedRequest) => !binFilter || capturedRequest.bin_id === binFilter,
    );

    return HttpResponse.json(paginateItems(matchingRequests, requestUrl));
  }),

  http.delete("*/api/v1/http/requests", async ({ request }) => {
    await applyMockConditions();
    const binFilter = new URL(request.url).searchParams.get("bin_id");
    mockDatabase.capturedHttpRequests =
      mockDatabase.capturedHttpRequests.filter(
        (capturedRequest) =>
          binFilter !== null && capturedRequest.bin_id !== binFilter,
      );
    for (const httpBin of mockDatabase.httpBins) {
      if (binFilter === null || httpBin.id === binFilter) {
        httpBin.request_count = 0;
        httpBin.last_request_at = null;
      }
    }

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/v1/http/requests/:requestId", async ({ params }) => {
    await applyMockConditions();
    const capturedRequest = findCapturedRequest(params.requestId);

    return capturedRequest === undefined
      ? createNotFoundResponse("Request")
      : HttpResponse.json(capturedRequest);
  }),

  http.get(
    "*/api/v1/http/requests/:requestId/files/:fileIndex",
    async ({ params }) => {
      await applyMockConditions();
      const capturedRequest = findCapturedRequest(params.requestId);
      const capturedFile = capturedRequest?.files.find(
        (existingFile) => String(existingFile.file_index) === params.fileIndex,
      );
      if (capturedRequest === undefined || capturedFile === undefined) {
        return createNotFoundResponse("File");
      }

      return new HttpResponse(
        mockDatabase.httpFileContents.get(
          `${capturedRequest.id}:${capturedFile.file_index}`,
        ) ?? "",
        {
          headers: {
            "content-type": capturedFile.content_type,
            "content-disposition": `attachment; filename="${capturedFile.filename}"`,
          },
        },
      );
    },
  ),

  http.post(
    "*/api/v1/http/requests/:requestId/forward",
    async ({ params, request }) => {
      await applyMockConditions();
      if (findCapturedRequest(params.requestId) === undefined) {
        return createNotFoundResponse("Request");
      }
      const { url } = (await request.json()) as HttpForwardRequest;
      if (!isHttpUrl(url)) {
        return createErrorResponse(
          400,
          "validation_failed",
          "Enter an http:// or https:// URL",
        );
      }

      // The mock answers for the target; the server sends the real request.
      const forwardResult: HttpForwardResult = {
        status_code: 200,
        duration_ms: faker.number.int({ min: 12, max: 140 }),
        body: '{"received":true}',
      };

      return HttpResponse.json(forwardResult);
    },
  ),

  // Requests to the catcher itself, e.g. fetch("/catch/slack", ...) in the browser.
  http.all("*/catch/*", async ({ request }) => {
    const capturedRequest = captureHttpRequest(mockDatabase, {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers),
      body: await request.text(),
    });

    return new HttpResponse(capturedRequest.response_body, {
      status: capturedRequest.response_status,
      headers: capturedRequest.response_headers,
    });
  }),
];
