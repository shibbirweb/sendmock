import { mockDatabase } from "@/mocks/db/mock-database";
import { captureHttpRequest } from "@/mocks/http/capture-http-request";

/** A Slack notification sent to the `slack` bin, as an app would (HC-01.6). */
export function createSampleHttpRequest(): string {
  const capturedRequest = captureHttpRequest(mockDatabase, {
    method: "POST",
    url: "http://127.0.0.1:8025/catch/slack",
    headers: {
      "content-type": "application/json",
      "user-agent": "acme-app/1.0",
    },
    body: JSON.stringify({
      text: "New signup: *ayesha@example.com* on the _Pro_ plan",
    }),
  });

  return capturedRequest.id;
}
