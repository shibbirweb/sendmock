import { http, HttpResponse } from "msw";

import type { EmailClickRequest } from "@/lib/api/types";
import {
  clickTimelineDetails,
  describeMockClick,
  isEmailLink,
  recordMockClick,
} from "@/mocks/clicks/record-mock-click";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { runWithWebhookChoice } from "@/mocks/realtime/webhook-choice-scope";
import { refuseUnavailableEndpoint } from "@/mocks/webhooks/webhook-choice";

function findEmail(emailId: unknown) {
  return mockDatabase.emails.find((email) => email.id === emailId);
}

/** `POST` and `GET /emails/{emailId}/clicks` (EM-20). */
export const emailClickHandlers = [
  http.post("*/api/v1/emails/:emailId/clicks", async ({ params, request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }
    const email = findEmail(params.emailId);
    if (!email) {
      return createNotFoundResponse("Email");
    }
    const clickRequest = (await request.json()) as EmailClickRequest;
    const choiceRefusal = refuseUnavailableEndpoint(clickRequest);
    if (choiceRefusal) {
      return choiceRefusal;
    }
    if (!isEmailLink(email, clickRequest.url ?? "")) {
      return createErrorResponse(
        422,
        "unknown_link",
        `${clickRequest.url ?? "That URL"} is not one of the email's links: ${email.extracted.links.join(", ") || "it has none"}`,
      );
    }

    const recordedClick = recordMockClick(
      email,
      clickRequest,
      mockDatabase.emailClicks,
    );
    mockDatabase.emailTimelines.get(email.id)?.push({
      kind: "clicked",
      at: recordedClick.clickRecord.clicked_at,
      detail: `${clickTimelineDetails[recordedClick.clickRecord.source]}: ${recordedClick.clickRecord.url}`,
    });
    runWithWebhookChoice(clickRequest, () => {
      publishMockEvent(
        "email.clicked",
        describeMockClick(email, recordedClick),
      );
    });

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/v1/emails/:emailId/clicks", async ({ params }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }
    const email = findEmail(params.emailId);
    if (!email) {
      return createNotFoundResponse("Email");
    }

    return HttpResponse.json(mockDatabase.emailClicks.get(email.id) ?? []);
  }),
];
