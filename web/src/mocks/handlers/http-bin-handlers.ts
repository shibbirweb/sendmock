import { http, HttpResponse } from "msw";

import type {
  HttpBin,
  HttpBinInput,
  HttpMockResponse,
  HttpResponseRule,
  HttpRulePreviewRequest,
  HttpRulePreviewResult,
} from "@/lib/api/types";
import { readPresetDefaultResponse } from "@/lib/http/http-bin-presets";
import { matchResponseRule } from "@/lib/http/match-response-rule";
import { validateHttpBinName } from "@/lib/http/validate-http-bin";
import { validateResponseRule } from "@/lib/http/validate-response-rule";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import {
  buildResponseContext,
  renderMockResponse,
} from "@/mocks/http/render-mock-response";

function findBin(binId: unknown): HttpBin | undefined {
  return mockDatabase.httpBins.find((httpBin) => httpBin.id === binId);
}

export const httpBinHandlers = [
  http.get("*/api/v1/http/bins", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockDatabase.httpBins);
  }),

  http.post("*/api/v1/http/bins", async ({ request }) => {
    await applyMockConditions();
    const binInput = (await request.json()) as HttpBinInput;
    const nameError = validateHttpBinName(binInput, mockDatabase.httpBins);
    if (nameError !== null) {
      const isTaken = mockDatabase.httpBins.some(
        (httpBin) => httpBin.name === binInput.name,
      );
      return createErrorResponse(
        isTaken ? 409 : 400,
        isTaken ? "bin_exists" : "validation_failed",
        nameError,
      );
    }

    const createdBin: HttpBin = {
      id: createMockUlid(),
      name: binInput.name,
      preset: binInput.preset,
      request_count: 0,
      last_request_at: null,
      default_response: readPresetDefaultResponse(binInput.preset),
    };
    mockDatabase.httpBins.push(createdBin);
    mockDatabase.httpResponseRules.set(createdBin.id, []);

    return HttpResponse.json(createdBin, { status: 201 });
  }),

  http.patch("*/api/v1/http/bins/:binId", async ({ params, request }) => {
    await applyMockConditions();
    const httpBin = findBin(params.binId);
    if (httpBin === undefined) {
      return createNotFoundResponse("Bin");
    }

    const { default_response: defaultResponse } = (await request.json()) as {
      default_response: HttpMockResponse;
    };
    httpBin.default_response = defaultResponse;

    return HttpResponse.json(httpBin);
  }),

  http.delete("*/api/v1/http/bins/:binId", async ({ params }) => {
    await applyMockConditions();
    if (findBin(params.binId) === undefined) {
      return createNotFoundResponse("Bin");
    }

    mockDatabase.httpBins = mockDatabase.httpBins.filter(
      (httpBin) => httpBin.id !== params.binId,
    );
    mockDatabase.capturedHttpRequests =
      mockDatabase.capturedHttpRequests.filter(
        (capturedRequest) => capturedRequest.bin_id !== params.binId,
      );
    mockDatabase.httpResponseRules.delete(String(params.binId));

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/v1/http/bins/:binId/responses", async ({ params }) => {
    await applyMockConditions();
    if (findBin(params.binId) === undefined) {
      return createNotFoundResponse("Bin");
    }

    return HttpResponse.json(
      mockDatabase.httpResponseRules.get(String(params.binId)) ?? [],
    );
  }),

  http.put(
    "*/api/v1/http/bins/:binId/responses",
    async ({ params, request }) => {
      await applyMockConditions();
      if (findBin(params.binId) === undefined) {
        return createNotFoundResponse("Bin");
      }

      const responseRules = (await request.json()) as HttpResponseRule[];
      const firstError = responseRules
        .map(
          (responseRule) =>
            Object.values(validateResponseRule(responseRule))[0],
        )
        .find((ruleError) => ruleError !== undefined);
      if (firstError !== undefined) {
        return createErrorResponse(400, "validation_failed", firstError);
      }
      // New rules arrive without an id.
      const savedRules = responseRules.map((responseRule) => ({
        ...responseRule,
        id: responseRule.id === "" ? createMockUlid() : responseRule.id,
      }));
      mockDatabase.httpResponseRules.set(String(params.binId), savedRules);

      return HttpResponse.json(savedRules);
    },
  ),

  http.post(
    "*/api/v1/http/bins/:binId/responses/preview",
    async ({ request }) => {
      await applyMockConditions();
      const previewRequest = (await request.json()) as HttpRulePreviewRequest;
      const capturedRequest = mockDatabase.capturedHttpRequests.find(
        (existingRequest) => existingRequest.id === previewRequest.request_id,
      );
      if (capturedRequest === undefined) {
        return createNotFoundResponse("Request");
      }

      const ruleMatch = matchResponseRule(previewRequest.rule, capturedRequest);
      const renderedResponse = renderMockResponse(
        previewRequest.rule.response,
        buildResponseContext(capturedRequest, mockDatabase.webhookVariables),
      );
      const previewResult: HttpRulePreviewResult = {
        is_match: ruleMatch.isMatch,
        mismatch_reason: ruleMatch.mismatchReason,
        response: renderedResponse.response,
        problems: renderedResponse.problems,
      };

      return HttpResponse.json(previewResult);
    },
  ),
];
