import { http, HttpResponse } from "msw";

import type {
  EmailAddress,
  EmailDetail,
  EmailForwardRequest,
  EmailReplyRequest,
} from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  buildEmailResponse,
  buildResponseTimelineEntry,
  type EmailResponseSpec,
} from "@/mocks/fixtures/email-response-builder";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
  parseEmailAddress,
} from "@/mocks/handlers/handler-utils";
import { runInboundRoutes } from "@/mocks/inbound-routes/run-inbound-routes";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

const fallbackRecipient: EmailAddress = {
  name: "",
  address: "recipient@example.com",
};

/** Finds the original, refusing incoming emails (EM-17.5). */
function findOriginalEmail(emailId: unknown): EmailDetail | Response {
  const originalEmail = mockDatabase.emails.find(
    (email) => email.id === emailId,
  );
  if (originalEmail === undefined) {
    return createNotFoundResponse("Email");
  }
  if (originalEmail.direction === "inbound") {
    return createErrorResponse(
      409,
      "conflict",
      "Only emails your app sent can be replied to or forwarded",
    );
  }

  return originalEmail;
}

function readResponder(
  originalEmail: EmailDetail,
  fromText: string | undefined,
): EmailAddress {
  if (fromText !== undefined && fromText.trim() !== "") {
    return parseEmailAddress(fromText);
  }

  return originalEmail.to[0] ?? fallbackRecipient;
}

/** Everyone else on the original, for Reply all. */
function listOtherRecipients(
  originalEmail: EmailDetail,
  responder: EmailAddress,
): EmailAddress[] {
  return [...originalEmail.to, ...originalEmail.cc].filter(
    (recipient) => recipient.address !== responder.address,
  );
}

function storeEmailResponse(
  originalEmail: EmailDetail,
  responseSpec: EmailResponseSpec,
) {
  const responseFixture = buildEmailResponse(originalEmail, responseSpec);
  const responseEmail = responseFixture.email;
  mockDatabase.emails.unshift(responseEmail);
  mockDatabase.emailTimelines.set(responseEmail.id, responseFixture.timeline);
  mockDatabase.emailTimelines
    .get(originalEmail.id)
    ?.push(buildResponseTimelineEntry(responseEmail));
  publishMockEvent("email.inbound", {
    id: responseEmail.id,
    subject: responseEmail.subject,
  });
  // Incoming emails run the inbound routes (WH-12.7).
  if (runInboundRoutes(mockDatabase, responseEmail).length > 0) {
    publishMockEvent("webhook.delivered", { id: responseEmail.id });
  }

  return HttpResponse.json(responseEmail, { status: 201 });
}

/** Simulated recipient replies and forwards (EM-17). */
export const emailResponseHandlers = [
  http.post("*/api/v1/emails/:emailId/reply", async ({ params, request }) => {
    await applyMockConditions();
    const originalEmail = findOriginalEmail(params.emailId);
    if (originalEmail instanceof Response) {
      return originalEmail;
    }

    const replyRequest = (await request.json()) as EmailReplyRequest;
    if ((replyRequest.body ?? "").trim() === "") {
      return createErrorResponse(400, "validation_failed", "Write a reply");
    }

    const responder = readResponder(originalEmail, replyRequest.from);

    return storeEmailResponse(originalEmail, {
      kind: "reply",
      from: responder,
      to: [originalEmail.reply_to[0] ?? originalEmail.from],
      cc:
        replyRequest.reply_all === true
          ? listOtherRecipients(originalEmail, responder)
          : [],
      subject: replyRequest.subject,
      body: replyRequest.body,
      includeOriginalText: replyRequest.include_original ?? true,
      includeAttachments: false,
    });
  }),

  http.post("*/api/v1/emails/:emailId/forward", async ({ params, request }) => {
    await applyMockConditions();
    const originalEmail = findOriginalEmail(params.emailId);
    if (originalEmail instanceof Response) {
      return originalEmail;
    }

    const forwardRequest = (await request.json()) as EmailForwardRequest;
    const forwardRecipient = parseEmailAddress(forwardRequest.to ?? "");
    if (!forwardRecipient.address.includes("@")) {
      return createErrorResponse(
        400,
        "validation_failed",
        "Enter the address to forward to",
      );
    }

    return storeEmailResponse(originalEmail, {
      kind: "forward",
      from: readResponder(originalEmail, forwardRequest.from),
      to: [forwardRecipient],
      cc: [],
      subject: forwardRequest.subject,
      body: forwardRequest.body ?? "",
      includeOriginalText: forwardRequest.include_original ?? true,
      includeAttachments: forwardRequest.include_attachments ?? true,
    });
  }),
];
