import { http, HttpResponse } from "msw";

import type { CreatedSample, SampleKind } from "@/lib/api/types";
import {
  applyMockConditions,
  createErrorResponse,
} from "@/mocks/handlers/handler-utils";
import { createSampleEmail } from "@/mocks/samples/create-sample-email";
import { createSampleSms } from "@/mocks/samples/create-sample-sms";
import { createSampleVerification } from "@/mocks/samples/create-sample-verification";

/** One creator per sample kind; each returns the new item's ID. */
const sampleCreators: Record<SampleKind, () => string> = {
  email: createSampleEmail,
  sms: createSampleSms,
  verification: createSampleVerification,
};

function isSampleKind(kindText: unknown): kindText is SampleKind {
  return typeof kindText === "string" && kindText in sampleCreators;
}

export const samplesHandlers = [
  http.post("*/api/v1/samples/:kind", async ({ params }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }
    if (!isSampleKind(params.kind)) {
      return createErrorResponse(
        404,
        "unknown_sample_kind",
        "Sample kind must be email, sms or verification.",
      );
    }

    const createdSample: CreatedSample = {
      kind: params.kind,
      id: sampleCreators[params.kind](),
    };

    return HttpResponse.json(createdSample, { status: 201 });
  }),
];
