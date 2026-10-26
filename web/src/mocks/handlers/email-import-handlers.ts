import { http, HttpResponse } from "msw";

import type {
  EmailInboundRequest,
  EmailSource,
  NativeSendResult,
} from "@/lib/api/types";
import { parseRawMessage } from "@/mocks/automation/parse-raw-message";
import { mockDatabase } from "@/mocks/db/mock-database";
import { buildEmailFixture } from "@/mocks/fixtures/email-fixture-builder";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
  includesText,
  parseEmailAddress,
} from "@/mocks/handlers/handler-utils";
import { runInboundRoutes } from "@/mocks/inbound-routes/run-inbound-routes";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

type StoredMessageInput = {
  from: string;
  to: string[];
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  source: EmailSource;
  isIncoming: boolean;
};

/** Stores a message and fires its event; incoming mail runs the inbound routes. */
function storeMessage(messageInput: StoredMessageInput) {
  const emailFixture = buildEmailFixture({
    minutesAgo: 0,
    from: parseEmailAddress(messageInput.from),
    to: messageInput.to.map(parseEmailAddress),
    subject: messageInput.subject,
    textBody: messageInput.textBody,
    htmlBody: messageInput.htmlBody,
    source: messageInput.source,
  });
  const storedEmail = {
    ...emailFixture.email,
    direction: messageInput.isIncoming
      ? ("inbound" as const)
      : ("outbound" as const),
  };
  mockDatabase.emails.unshift(storedEmail);
  mockDatabase.emailTimelines.set(storedEmail.id, emailFixture.timeline);
  publishMockEvent(
    messageInput.isIncoming ? "email.inbound" : "email.received",
    {
      id: storedEmail.id,
      subject: storedEmail.subject,
    },
  );
  if (
    messageInput.isIncoming &&
    runInboundRoutes(mockDatabase, storedEmail).length > 0
  ) {
    publishMockEvent("webhook.delivered", { id: storedEmail.id });
  }

  return HttpResponse.json({ id: storedEmail.id } satisfies NativeSendResult, {
    status: 201,
  });
}

function rejectMessage(errorMessage: string) {
  return createErrorResponse(400, "validation_failed", errorMessage);
}

/** The newest email to a recipient, incoming mail, and raw messages (UI-11.5). */
export const emailImportHandlers = [
  http.get("*/api/v1/emails/latest", async ({ request }) => {
    await applyMockConditions();
    const latestQuery = new URL(request.url).searchParams;
    const recipient = latestQuery.get("to") ?? "";
    const subjectText = latestQuery.get("subject") ?? "";
    const latestEmail = mockDatabase.emails.find(
      (email) =>
        email.to.some((address) => includesText(address.address, recipient)) &&
        includesText(email.subject, subjectText),
    );

    return latestEmail === undefined
      ? createNotFoundResponse("Email")
      : HttpResponse.json(latestEmail);
  }),

  http.post("*/api/v1/emails/inbound", async ({ request }) => {
    await applyMockConditions();
    const inboundRequest = (await request.json()) as EmailInboundRequest;
    const messageParts =
      inboundRequest.raw === undefined
        ? {
            from: inboundRequest.from ?? "",
            to: inboundRequest.to ?? [],
            subject: inboundRequest.subject ?? "(no subject)",
            textBody: inboundRequest.text ?? null,
            htmlBody: inboundRequest.html ?? null,
          }
        : parseRawMessage(inboundRequest.raw);
    if (messageParts.from === "" || messageParts.to.length === 0) {
      return rejectMessage("from and to are required");
    }

    return storeMessage({
      ...messageParts,
      source: "simulated",
      isIncoming: true,
    });
  }),

  http.post("*/api/v1/send/raw", async ({ request }) => {
    await applyMockConditions();
    const messageParts = parseRawMessage(await request.text());
    if (messageParts.from === "" || messageParts.to.length === 0) {
      return rejectMessage("The message needs From and To headers");
    }

    return storeMessage({
      ...messageParts,
      source: "sendmail",
      isIncoming: false,
    });
  }),
];
