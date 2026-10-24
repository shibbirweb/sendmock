import { delay, http, HttpResponse } from "msw";

import type { EmailDetail } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  buildHtmlCheckReport,
  buildLinkCheckResults,
  buildListUnsubscribeReport,
  buildSpamCheckReport,
} from "@/mocks/fixtures/email-check-builder";
import {
  buildEmailMimeTree,
  buildRawEmailSource,
} from "@/mocks/fixtures/email-source-builder";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

function findEmail(emailId: unknown): EmailDetail | undefined {
  return mockDatabase.emails.find((email) => email.id === emailId);
}

/** A labelled placeholder image, used for image attachments and thumbnails. */
function buildPlaceholderImage(label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><rect width="320" height="200" fill="#e4e4e7"/><text x="160" y="105" font-family="sans-serif" font-size="16" fill="#52525b" text-anchor="middle">${label}</text></svg>`;
}

/** Wraps a handler that needs the email, answering 404 when it is missing. */
function withEmail(
  respond: (
    email: EmailDetail,
    request: Request,
    attachmentIndex: number,
  ) => Response | Promise<Response>,
) {
  return async ({
    params,
    request,
  }: {
    params: Record<string, unknown>;
    request: Request;
  }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const email = findEmail(params.emailId);
    if (!email) {
      return createNotFoundResponse("Email");
    }

    return respond(email, request, Number(params.attachmentIndex ?? 0));
  };
}

export const emailDetailHandlers = [
  http.get(
    "*/api/v1/emails/:emailId/raw",
    withEmail(
      (email) =>
        new HttpResponse(buildRawEmailSource(email), {
          headers: { "Content-Type": "message/rfc822; charset=utf-8" },
        }),
    ),
  ),

  http.get(
    "*/api/v1/emails/:emailId/mime",
    withEmail((email) => HttpResponse.json(buildEmailMimeTree(email))),
  ),

  http.get(
    "*/api/v1/emails/:emailId/attachments/:attachmentIndex",
    withEmail((email, _request, attachmentIndex) => {
      const attachment = email.attachments[attachmentIndex];
      if (!attachment) {
        return createNotFoundResponse("Attachment");
      }
      if (attachment.content_type.startsWith("image/")) {
        return new HttpResponse(buildPlaceholderImage(attachment.filename), {
          headers: { "Content-Type": "image/svg+xml" },
        });
      }

      return new HttpResponse(`Demo content of ${attachment.filename}`, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Disposition": `attachment; filename="${attachment.filename}.txt"`,
        },
      });
    }),
  ),

  http.get(
    "*/api/v1/emails/:emailId/parts/:attachmentIndex/thumbnail",
    withEmail(
      (email, _request, attachmentIndex) =>
        new HttpResponse(
          buildPlaceholderImage(
            email.attachments[attachmentIndex]?.filename ?? "image",
          ),
          { headers: { "Content-Type": "image/svg+xml" } },
        ),
    ),
  ),

  http.get(
    "*/api/v1/emails/:emailId/html-check",
    withEmail((email) => HttpResponse.json(buildHtmlCheckReport(email))),
  ),

  http.post(
    "*/api/v1/emails/:emailId/link-check",
    withEmail(async (email) => {
      await delay(900);

      return HttpResponse.json(buildLinkCheckResults(email));
    }),
  ),

  http.post(
    "*/api/v1/emails/:emailId/spam-check",
    withEmail((email) => HttpResponse.json(buildSpamCheckReport(email))),
  ),

  http.get(
    "*/api/v1/emails/:emailId/list-unsubscribe",
    withEmail((email) => HttpResponse.json(buildListUnsubscribeReport(email))),
  ),

  http.post(
    "*/api/v1/emails/:emailId/release",
    withEmail(async (email, request) => {
      const { to } = (await request.json()) as { to?: string[] };
      const recipientAddresses = to?.length ? to : email.envelope_to;
      if (recipientAddresses.length === 0) {
        return createErrorResponse(
          400,
          "invalid_request",
          "No recipients to release to",
        );
      }

      mockDatabase.emailTimelines.get(email.id)?.push({
        kind: "released",
        at: new Date().toISOString(),
        detail: `Released to ${recipientAddresses.join(", ")} (demo: nothing was sent)`,
      });
      publishMockEvent("email.released", { id: email.id });

      return new HttpResponse(null, { status: 204 });
    }),
  ),
];
