import { http, HttpResponse } from "msw";

import type {
  EmailDeliveryStatus,
  EmailDetail,
  NativeSendRequest,
  NativeSendResult,
} from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { buildEmailFixture } from "@/mocks/fixtures/email-fixture-builder";
import { parseNativeAttachments } from "@/mocks/fixtures/native-attachments";
import {
  applyMockConditions,
  createErrorResponse,
  parseEmailAddress,
} from "@/mocks/handlers/handler-utils";
import { recordNativeApiRequest } from "@/mocks/handlers/record-api-request";
import { applyEmailOutcome } from "@/mocks/realtime/apply-email-outcome";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import {
  type EmailOutcomePlan,
  planEmailOutcome,
} from "@/mocks/realtime/outcome-plans";

const sendPath = "/api/v1/send";

/** Outcome kinds as the delivery events they fire. */
const plannedEmailEvents: Record<
  Exclude<EmailOutcomePlan["outcome"], "reject">,
  EmailDeliveryStatus
> = {
  delivered: "delivered",
  hard_bounce: "bounced",
  soft_bounce: "deferred",
  complaint: "complained",
  unsubscribe: "unsubscribed",
};

function applyPlannedEmailOutcome(
  email: EmailDetail,
  outcomePlan: EmailOutcomePlan,
) {
  if (outcomePlan.outcome === "reject") {
    return;
  }

  const codeText =
    outcomePlan.smtpCode === null ? "" : `, ${outcomePlan.smtpCode}`;
  applyEmailOutcome(
    email,
    plannedEmailEvents[outcomePlan.outcome],
    `${outcomePlan.recipientAddress}: ${outcomePlan.outcome.replace("_", " ")}${codeText} (${outcomePlan.sourceLabel})`,
  );
}

/** The logged request keeps attachment names and sizes, not their base64. */
function summarizeForLog(nativeSendRequest: NativeSendRequest) {
  return {
    ...nativeSendRequest,
    attachments: nativeSendRequest.attachments?.map((nativeAttachment) => ({
      ...nativeAttachment,
      content: `<${(nativeAttachment.content ?? "").length} base64 characters>`,
    })),
  };
}

function rejectSend(
  nativeSendRequest: NativeSendRequest,
  errorMessage: string,
) {
  recordNativeApiRequest({
    path: sendPath,
    requestBody: summarizeForLog(nativeSendRequest),
    responseStatus: 400,
    responseBody: {
      error: { code: "validation_failed", message: errorMessage },
    },
  });

  return createErrorResponse(400, "validation_failed", errorMessage);
}

/** Native HTTP send, with base64 attachments (EM-07). */
export const nativeSendHandlers = [
  http.post("*/api/v1/send", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const nativeSendRequest = (await request.json()) as NativeSendRequest;
    if (!nativeSendRequest.from || (nativeSendRequest.to ?? []).length === 0) {
      return rejectSend(nativeSendRequest, "from and to are required");
    }

    const attachmentsResult = parseNativeAttachments(
      nativeSendRequest.attachments,
    );
    if (!attachmentsResult.isValid) {
      return rejectSend(nativeSendRequest, attachmentsResult.errorMessage);
    }

    const outcomePlan = planEmailOutcome(nativeSendRequest.to);
    if (outcomePlan?.outcome === "reject") {
      return rejectSend(
        nativeSendRequest,
        `${outcomePlan.recipientAddress} rejected with ${outcomePlan.smtpCode ?? "550"} (${outcomePlan.sourceLabel})`,
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
      attachments: attachmentsResult.attachments.map((parsedAttachment) => ({
        filename: parsedAttachment.filename,
        content_type: parsedAttachment.content_type,
        content_id: parsedAttachment.content_id,
        is_inline: parsedAttachment.is_inline,
        size_bytes: parsedAttachment.size_bytes,
      })),
    });
    const storedEmail = emailFixture.email;
    for (const [
      attachmentIndex,
      parsedAttachment,
    ] of attachmentsResult.attachments.entries()) {
      mockDatabase.attachmentContents.set(
        `${storedEmail.id}/${attachmentIndex}`,
        parsedAttachment.fileBytes,
      );
    }

    recordNativeApiRequest({
      path: sendPath,
      requestBody: summarizeForLog(nativeSendRequest),
      responseStatus: 201,
      responseBody: { id: storedEmail.id },
      linkedMessage: { kind: "email", id: storedEmail.id, sms_thread_id: null },
    });
    mockDatabase.emails.unshift(storedEmail);
    mockDatabase.emailTimelines.set(storedEmail.id, emailFixture.timeline);
    if (outcomePlan !== null) {
      applyPlannedEmailOutcome(storedEmail, outcomePlan);
    }
    publishMockEvent("email.received", {
      id: storedEmail.id,
      subject: storedEmail.subject,
    });

    return HttpResponse.json(
      { id: storedEmail.id } satisfies NativeSendResult,
      { status: 201 },
    );
  }),
];
