import { faker } from "@faker-js/faker/locale/en";

import type {
  EmailDetail,
  EmailTimelineEntry,
  WebhookDelivery,
} from "@/lib/api/types";
import {
  fillCapturedGroups,
  matchRouteFilter,
} from "@/lib/inbound-routes/match-route-filter";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import type { InboundRouteRecord } from "@/mocks/fixtures/inbound-route-fixtures";
import {
  sortRoutesByPriority,
  toRoutableEmail,
} from "@/mocks/inbound-routes/inbound-route-record";
import { answerMockAppPost } from "@/mocks/sms-replies/mock-app-responses";

type RouteDatabase = Pick<
  MockDatabase,
  "inboundRoutes" | "webhookDeliveries" | "emailTimelines" | "settings"
>;

const multipartBoundary = "sendmock-route-boundary";

/** Mailgun's parsed-message fields as multipart form data (05-webhooks, Inbound routes). */
function buildMailgunBody(
  email: EmailDetail,
  recipient: string,
  extraFields: Record<string, string>,
): string {
  const timestamp = String(Math.floor(Date.parse(email.received_at) / 1000));
  const mailgunFields: Record<string, string> = {
    recipient,
    sender: email.from.address,
    from:
      email.from.name === ""
        ? email.from.address
        : `${email.from.name} <${email.from.address}>`,
    subject: email.subject,
    "body-plain": email.text_body ?? "",
    "stripped-text":
      (email.text_body ?? "").split(/\n\s*On .+wrote:\s*\n/)[0]?.trim() ?? "",
    "body-html": email.html_body ?? "",
    "attachment-count": String(email.attachments.length),
    "message-headers": JSON.stringify(
      Object.entries(email.headers).flatMap(([headerName, values]) =>
        values.map((headerValue) => [headerName, headerValue]),
      ),
    ),
    timestamp,
    token: faker.string.alphanumeric(50).toLowerCase(),
    signature: faker.string
      .hexadecimal({ length: 64, prefix: "" })
      .toLowerCase(),
    ...extraFields,
  };

  return [
    ...Object.entries(mailgunFields).map(
      ([fieldName, fieldValue]) =>
        `--${multipartBoundary}\r\nContent-Disposition: form-data; name="${fieldName}"\r\n\r\n${fieldValue}\r\n`,
    ),
    `--${multipartBoundary}--\r\n`,
  ].join("");
}

function recordRouteDelivery(
  mockDatabase: RouteDatabase,
  routeRecord: InboundRouteRecord,
  email: EmailDetail,
  requestUrl: string,
  requestBody: string,
  createdAtMs: number,
): WebhookDelivery {
  const mockAnswer = answerMockAppPost(requestUrl);
  const isSucceeded =
    mockAnswer.kind === "response" && mockAnswer.statusCode < 300;
  const routeDelivery: WebhookDelivery = {
    id: createMockUlid(createdAtMs),
    endpoint_id: routeRecord.id,
    endpoint_name: `Route: ${routeRecord.description || "untitled"}`,
    rule_id: null,
    event_id: `evt_${createMockUlid(createdAtMs)}`,
    event_type: "email.inbound",
    subject_id: email.id,
    trigger: "auto",
    attempt: 1,
    status: isSucceeded ? "succeeded" : "failed",
    request: {
      method: "POST",
      url: requestUrl,
      headers: {
        "content-type": `multipart/form-data; boundary=${multipartBoundary}`,
        "user-agent": "mailgun/treq-sendmock",
      },
      body: requestBody,
    },
    response:
      mockAnswer.kind === "response"
        ? {
            status_code: mockAnswer.statusCode,
            headers: { "content-type": mockAnswer.contentType },
            body: mockAnswer.body,
            is_body_truncated: false,
          }
        : null,
    duration_ms: mockAnswer.kind === "response" ? mockAnswer.durationMs : null,
    error_message:
      mockAnswer.kind === "connection_error" ? mockAnswer.message : null,
    next_attempt_at: null,
    created_at: new Date(createdAtMs).toISOString(),
  };
  mockDatabase.webhookDeliveries.unshift(routeDelivery);

  return routeDelivery;
}

function isOnAllowlist(allowlistPatterns: string[], address: string): boolean {
  return allowlistPatterns.some((allowedPattern) =>
    new RegExp(
      `^${allowedPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`,
      "i",
    ).test(address),
  );
}

/**
 * Runs the matching routes on a new incoming email, lowest priority first,
 * until one calls `stop()` (WH-12.1, WH-12.7). Each forward or store is a
 * delivery in the log and an entry in the email's timeline.
 */
export function runInboundRoutes(
  mockDatabase: RouteDatabase,
  email: EmailDetail,
  nowMs: number = Date.now(),
): WebhookDelivery[] {
  const routableEmail = toRoutableEmail(email);
  const timeline = mockDatabase.emailTimelines.get(email.id) ?? [];
  const routeDeliveries: WebhookDelivery[] = [];
  const addTimeline = (timelineEntry: Omit<EmailTimelineEntry, "at">) => {
    timeline.push({ ...timelineEntry, at: new Date(nowMs).toISOString() });
  };
  for (const routeRecord of sortRoutesByPriority(mockDatabase.inboundRoutes)) {
    const filterMatch = matchRouteFilter(routeRecord.filter, routableEmail);
    if (!filterMatch.isMatch) {
      continue;
    }
    const routeName = routeRecord.description || "untitled route";
    let shouldStop = false;
    for (const routeAction of routeRecord.actions) {
      if (routeAction.kind === "stop") {
        shouldStop = true;
        continue;
      }
      if (routeAction.kind === "forward_email") {
        const address = fillCapturedGroups(
          routeAction.address,
          filterMatch.capturedGroups,
        );
        const isAllowed = isOnAllowlist(
          mockDatabase.settings.relay_recipient_allowlist,
          address,
        );
        addTimeline({
          kind: "forwarded",
          detail: isAllowed
            ? `Forwarded by route ${routeName} to ${address}`
            : `Not forwarded to ${address}: not on the release allowlist (route ${routeName})`,
        });
        continue;
      }
      const targetUrl =
        routeAction.kind === "forward_url"
          ? fillCapturedGroups(routeAction.url, filterMatch.capturedGroups)
          : routeAction.notify_url;
      if (targetUrl === null || targetUrl === "") {
        addTimeline({
          kind: "webhook_sent",
          detail: `Stored by route ${routeName}`,
        });
        continue;
      }
      const routeDelivery = recordRouteDelivery(
        mockDatabase,
        routeRecord,
        email,
        targetUrl,
        buildMailgunBody(
          email,
          filterMatch.matchedValue,
          routeAction.kind === "store"
            ? {
                "message-url": `http://127.0.0.1:8025/v3/domains/inbound/messages/${email.id}`,
              }
            : {},
        ),
        nowMs + routeDeliveries.length,
      );
      routeDeliveries.push(routeDelivery);
      addTimeline({
        kind: "webhook_sent",
        detail: `${routeAction.kind === "store" ? "Stored and notified" : "Forwarded"} by route ${routeName} to ${targetUrl} (${routeDelivery.response?.status_code ?? routeDelivery.error_message ?? "no answer"})`,
      });
    }
    if (shouldStop) {
      break;
    }
  }
  mockDatabase.emailTimelines.set(email.id, timeline);

  return routeDeliveries;
}
