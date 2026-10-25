import { faker } from "@faker-js/faker/locale/en";

import type { ManualSendRequest, WebhookDelivery } from "@/lib/api/types";
import {
  buildSendEndpointInput,
  findBlockingProblems,
  pickEndpointInput,
} from "@/lib/webhooks/manual-send-request";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import { buildSignatureHeaders } from "@/mocks/webhooks/build-signature-headers";
import { renderEndpointRequest } from "@/mocks/webhooks/render-endpoint-request";
import type { WebhookEndpointRecord } from "@/mocks/webhooks/webhook-endpoint-record";

/**
 * A `manual` delivery as the server would record it (WH-05.1, WH-05.3):
 * rendered with the send-time variables, or `render_failed` when an error
 * stops it. An edited body is sent as written, so body errors no longer
 * count (WH-05.6). Null when the message does not exist.
 */
export function buildManualDelivery(
  mockDatabase: MockDatabase,
  endpointRecord: WebhookEndpointRecord,
  sendRequest: ManualSendRequest,
): WebhookDelivery | null {
  const previewResult = renderEndpointRequest(mockDatabase, {
    endpoint: buildSendEndpointInput(
      pickEndpointInput(endpointRecord),
      sendRequest,
    ),
    endpoint_id: endpointRecord.id,
    email_id: sendRequest.email_id,
    sms_id: sendRequest.sms_id,
    http_request_id: sendRequest.http_request_id,
    variables: sendRequest.variables,
  });
  if (previewResult === null) {
    return null;
  }

  const eventId = `evt_${createMockUlid()}`;
  const timestampSeconds = Math.floor(Date.now() / 1000);
  const blockingErrors = findBlockingProblems(
    previewResult.problems,
    sendRequest.body !== undefined,
  );
  const deliveryBase = {
    id: createMockUlid(),
    endpoint_id: endpointRecord.id,
    endpoint_name: endpointRecord.name,
    rule_id: null,
    event_id: eventId,
    event_type: previewResult.event_type,
    subject_id:
      sendRequest.email_id ??
      sendRequest.sms_id ??
      sendRequest.http_request_id ??
      null,
    trigger: "manual" as const,
    attempt: 1,
    next_attempt_at: null,
    created_at: new Date(timestampSeconds * 1000).toISOString(),
  };
  if (blockingErrors.length > 0) {
    return {
      ...deliveryBase,
      status: "render_failed",
      request: null,
      response: null,
      duration_ms: null,
      error_message: blockingErrors
        .map((renderProblem) => renderProblem.message)
        .join("; "),
    };
  }

  return {
    ...deliveryBase,
    status: "succeeded",
    request: {
      method: previewResult.method,
      url: previewResult.url,
      headers: {
        ...previewResult.headers,
        ...buildSignatureHeaders(endpointRecord, eventId, timestampSeconds),
      },
      body: sendRequest.body ?? previewResult.body,
    },
    response: {
      status_code: 200,
      headers: { "content-type": "application/json" },
      body: '{"received":true}',
      is_body_truncated: false,
    },
    duration_ms: faker.number.int({ min: 24, max: 180 }),
    error_message: null,
  };
}
