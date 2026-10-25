import { http, HttpResponse } from "msw";

import type {
  ForcedVerificationState,
  VerificationDetail,
  VerificationStatus,
  VerificationTimelineKind,
  VerifyServiceInput,
} from "@/lib/api/types";
import { validateVerifyServiceInput } from "@/lib/verify/validate-verify-service";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createProviderId } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
  includesText,
  paginateItems,
} from "@/mocks/handlers/handler-utils";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

type FinalVerificationStatus = Exclude<VerificationStatus, "pending">;

const forcedStateToStatus: Record<
  ForcedVerificationState,
  FinalVerificationStatus
> = {
  approved: "approved",
  canceled: "canceled",
  expired: "expired",
  max_attempts: "max_attempts_reached",
};

const statusToTimelineKind: Record<
  FinalVerificationStatus,
  VerificationTimelineKind
> = {
  approved: "approved",
  canceled: "canceled",
  expired: "expired",
  max_attempts_reached: "max_attempts_reached",
};

function findVerification(
  verificationSid: unknown,
): VerificationDetail | undefined {
  return mockDatabase.verifications.find(
    (verification) => verification.sid === verificationSid,
  );
}

/** Pending verifications past their expiry become expired, as the server does. */
function expireOverdueVerifications() {
  const now = Date.now();

  for (const verification of mockDatabase.verifications) {
    if (
      verification.status !== "pending" ||
      Date.parse(verification.expires_at) > now
    ) {
      continue;
    }

    verification.status = "expired";
    verification.timeline.push({
      kind: "expired",
      at: verification.expires_at,
      detail: "Not checked before the code expired",
    });
    publishMockEvent("verify.expired", { sid: verification.sid });
  }
}

function matchesVerificationFilters(
  verification: VerificationDetail,
  requestUrl: URL,
): boolean {
  const statusFilter = requestUrl.searchParams.get("status");
  const toFilter = requestUrl.searchParams.get("to") ?? "";
  const channelFilter = requestUrl.searchParams.get("channel");

  if (statusFilter && !statusFilter.split(",").includes(verification.status)) {
    return false;
  }
  if (channelFilter && verification.channel !== channelFilter) {
    return false;
  }

  return includesText(verification.to, toFilter);
}

async function readServiceInput(request: Request) {
  const serviceInput = (await request.json()) as VerifyServiceInput;
  const fieldErrors = validateVerifyServiceInput(serviceInput);
  const firstError = Object.values(fieldErrors)[0];

  return { serviceInput, firstError };
}

/** Verifications, force state and Verify services (VF-01, VF-04). */
export const verifyHandlers = [
  http.get("*/api/v1/verify/services", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockDatabase.verifyServices);
  }),

  http.post("*/api/v1/verify/services", async ({ request }) => {
    await applyMockConditions();
    const { serviceInput, firstError } = await readServiceInput(request);
    if (firstError !== undefined) {
      return createErrorResponse(400, "validation_failed", firstError);
    }

    const verifyService = {
      ...serviceInput,
      friendly_name: serviceInput.friendly_name.trim(),
      sid: createProviderId("VA"),
      created_by: "ui" as const,
    };
    mockDatabase.verifyServices.push(verifyService);

    return HttpResponse.json(verifyService, { status: 201 });
  }),

  http.patch(
    "*/api/v1/verify/services/:serviceSid",
    async ({ params, request }) => {
      await applyMockConditions();
      const verifyService = mockDatabase.verifyServices.find(
        (existingService) => existingService.sid === params.serviceSid,
      );
      if (verifyService === undefined) {
        return createNotFoundResponse("Verify service");
      }

      const { serviceInput, firstError } = await readServiceInput(request);
      if (firstError !== undefined) {
        return createErrorResponse(400, "validation_failed", firstError);
      }

      Object.assign(verifyService, serviceInput, {
        friendly_name: serviceInput.friendly_name.trim(),
      });

      return HttpResponse.json(verifyService);
    },
  ),

  http.delete("*/api/v1/verify/services/:serviceSid", async ({ params }) => {
    await applyMockConditions();
    mockDatabase.verifyServices = mockDatabase.verifyServices.filter(
      (existingService) => existingService.sid !== params.serviceSid,
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/v1/verify", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    expireOverdueVerifications();
    const requestUrl = new URL(request.url);
    // The list includes each timeline too; the UI only reads it from the detail.
    const matchingVerifications = mockDatabase.verifications.filter(
      (verification) => matchesVerificationFilters(verification, requestUrl),
    );

    return HttpResponse.json(paginateItems(matchingVerifications, requestUrl));
  }),

  http.get("*/api/v1/verify/:verificationSid", async ({ params }) => {
    await applyMockConditions();
    expireOverdueVerifications();
    const verification = findVerification(params.verificationSid);

    return verification
      ? HttpResponse.json(verification)
      : createNotFoundResponse("Verification");
  }),

  http.post(
    "*/api/v1/verify/:verificationSid/force",
    async ({ params, request }) => {
      await applyMockConditions();
      const verification = findVerification(params.verificationSid);
      if (!verification) {
        return createNotFoundResponse("Verification");
      }

      const { state } = (await request.json()) as {
        state: ForcedVerificationState;
      };
      const forcedStatus = forcedStateToStatus[state];
      verification.status = forcedStatus;
      verification.timeline.push({
        kind: statusToTimelineKind[forcedStatus],
        at: new Date().toISOString(),
        detail: "Forced from SendMock",
      });
      publishMockEvent(
        forcedStatus === "expired" ? "verify.expired" : "verify.checked",
        { sid: verification.sid, status: verification.status },
      );

      return HttpResponse.json(verification);
    },
  ),
];
