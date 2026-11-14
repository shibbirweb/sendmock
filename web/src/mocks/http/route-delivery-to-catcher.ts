import type { WebhookDelivery } from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import {
  captureHttpRequest,
  isCatcherUrl,
} from "@/mocks/http/capture-http-request";

/**
 * A delivery to SendMock's own `/catch/...` URL lands in the HTTP catcher
 * and records the catcher's reply, as a real send would.
 */
export function routeDeliveryToCatcher(
  mockDatabase: MockDatabase,
  webhookDelivery: WebhookDelivery,
): WebhookDelivery {
  const sentRequest = webhookDelivery.request;
  if (sentRequest === null || !isCatcherUrl(sentRequest.url)) {
    return webhookDelivery;
  }

  const capturedRequest = captureHttpRequest(mockDatabase, sentRequest);
  const isSuccess =
    capturedRequest.response_status >= 200 &&
    capturedRequest.response_status < 300;

  return {
    ...webhookDelivery,
    status: isSuccess ? "succeeded" : "failed",
    response: {
      status_code: capturedRequest.response_status,
      headers: capturedRequest.response_headers,
      body: capturedRequest.response_body,
      is_body_truncated: false,
    },
    duration_ms: capturedRequest.duration_ms,
    error_message: isSuccess ? null : `HTTP ${capturedRequest.response_status}`,
  };
}
