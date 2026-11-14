import type {
  EmailAddress,
  EmailDetail,
  EmailResponseKind,
  EmailResponseLink,
  EmailTimelineEntry,
} from "@/lib/api/types";
import {
  buildForwardedMessageBlock,
  formatEmailAddress,
  quoteOriginalEmail,
} from "@/lib/email/build-response-text";
import { buildResponseSubject } from "@/lib/email/build-response-subject";
import {
  buildEmailFixture,
  type EmailFixture,
} from "@/mocks/fixtures/email-fixture-builder";

export type EmailResponseSpec = {
  kind: EmailResponseKind;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject?: string;
  body: string;
  /** Add the quote (reply) or forwarded-message block (forward) to the body. */
  includeOriginalText: boolean;
  /** Forward only: carry the original attachments. */
  includeAttachments: boolean;
  minutesAgo?: number;
};

function buildResponseText(
  originalEmail: EmailDetail,
  responseSpec: EmailResponseSpec,
): string {
  const responseParts = [responseSpec.body.trim()];
  if (responseSpec.includeOriginalText) {
    responseParts.push(
      responseSpec.kind === "forward"
        ? buildForwardedMessageBlock(originalEmail)
        : quoteOriginalEmail(originalEmail),
    );
  }

  return responseParts.filter(Boolean).join("\n\n");
}

function buildThreadingHeaders(
  originalEmail: EmailDetail,
  responseKind: EmailResponseKind,
): Record<string, string[]> {
  const originalMessageId = originalEmail.message_id;
  if (originalMessageId === null) {
    return {};
  }

  const references = [
    ...(originalEmail.headers.References ?? []),
    originalMessageId,
  ];

  // Mail clients link a forward to the original only through References.
  return responseKind === "reply"
    ? { "In-Reply-To": [originalMessageId], References: references }
    : { References: references };
}

function toResponseLink(email: EmailDetail): EmailResponseLink {
  return {
    kind: email.response_kind ?? "reply",
    email_id: email.id,
    subject: email.subject,
    from: email.from,
    received_at: email.received_at,
  };
}

/**
 * The incoming email a recipient's reply or forward creates (EM-17.1, EM-17.4),
 * already linked both ways with its original.
 */
export function buildEmailResponse(
  originalEmail: EmailDetail,
  responseSpec: EmailResponseSpec,
): EmailFixture {
  const isForward = responseSpec.kind === "forward";
  const responseFixture = buildEmailFixture({
    minutesAgo: responseSpec.minutesAgo ?? 0,
    from: responseSpec.from,
    to: responseSpec.to,
    subject:
      responseSpec.subject ??
      buildResponseSubject(originalEmail.subject, responseSpec.kind),
    textBody: buildResponseText(originalEmail, responseSpec),
    source: "simulated",
    attachments:
      isForward && responseSpec.includeAttachments
        ? originalEmail.attachments.map((originalAttachment) => ({
            filename: originalAttachment.filename,
            content_type: originalAttachment.content_type,
            size_bytes: originalAttachment.size_bytes,
            content_id: originalAttachment.content_id,
            is_inline: originalAttachment.is_inline,
          }))
        : [],
  });
  const responseEmail = responseFixture.email;
  responseEmail.direction = "inbound";
  responseEmail.response_kind = responseSpec.kind;
  responseEmail.cc = responseSpec.cc;
  responseEmail.headers = {
    ...responseEmail.headers,
    ...buildThreadingHeaders(originalEmail, responseSpec.kind),
    ...(responseSpec.cc.length > 0
      ? { Cc: responseSpec.cc.map(formatEmailAddress) }
      : {}),
  };
  responseEmail.response_to = {
    ...toResponseLink(originalEmail),
    kind: responseSpec.kind,
  };
  responseFixture.timeline[0] = {
    kind: "received",
    at: responseEmail.received_at,
    detail: `Simulated ${isForward ? "forward" : "reply"} from ${responseSpec.from.address}`,
  };

  originalEmail.responses.push(toResponseLink(responseEmail));

  return responseFixture;
}

/** The entry added to the original's timeline for a reply or forward. */
export function buildResponseTimelineEntry(
  responseEmail: EmailDetail,
): EmailTimelineEntry {
  const isForward = responseEmail.response_kind === "forward";

  return {
    kind: isForward ? "forwarded_by_recipient" : "replied",
    at: responseEmail.received_at,
    detail: isForward
      ? `${responseEmail.from.address} forwarded it to ${responseEmail.to.map((recipient) => recipient.address).join(", ")}`
      : `${responseEmail.from.address} replied`,
  };
}
