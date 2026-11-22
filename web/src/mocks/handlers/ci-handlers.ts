import { http, HttpResponse } from "msw";

import type {
  CiFileRequest,
  CiInitRequest,
  SignatureVerifyRequest,
} from "@/lib/api/types";
import { buildCiInitFiles } from "@/mocks/automation/ci-init-files";
import { runCiFile, validateCiFile } from "@/mocks/automation/run-ci-file";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";

/** CI files and webhook signature checks (WH-15). */
export const ciHandlers = [
  http.post("*/api/v1/ci/validate", async ({ request }) => {
    await applyMockConditions();
    const { ci_file: ciFile } = (await request.json()) as CiFileRequest;

    return HttpResponse.json(validateCiFile(ciFile));
  }),

  http.post("*/api/v1/ci/run", async ({ request }) => {
    await applyMockConditions();
    const { ci_file: ciFile } = (await request.json()) as CiFileRequest;
    const ciOutcome = await runCiFile(ciFile);

    return "problems" in ciOutcome
      ? createErrorResponse(400, "invalid_input", ciOutcome.problems.join(" "))
      : HttpResponse.json(ciOutcome);
  }),

  http.post("*/api/v1/ci/init", async ({ request }) => {
    await applyMockConditions();
    const initRequest = (await request.json()) as CiInitRequest;

    return HttpResponse.json({
      provider: initRequest.provider,
      files: buildCiInitFiles(mockDatabase, initRequest),
    });
  }),

  http.post("*/api/v1/webhooks/signatures/verify", async ({ request }) => {
    await applyMockConditions();
    const verifyRequest = (await request.json()) as SignatureVerifyRequest;
    const capturedRequest = mockDatabase.capturedHttpRequests.find(
      (captured) => captured.id === verifyRequest.request_id,
    );
    if (verifyRequest.request_id != null && capturedRequest === undefined) {
      return createNotFoundResponse("Captured request");
    }
    if (verifyRequest.secret.trim() === "") {
      return createErrorResponse(400, "invalid_input", "Enter the secret");
    }

    // The demo cannot recompute signatures, so it reports what a running SendMock checks.
    return HttpResponse.json({
      is_valid: false,
      scheme: verifyRequest.scheme,
      reason:
        "The demo cannot check signatures; a running SendMock does (sendmock webhook signature verify).",
    });
  }),
];
