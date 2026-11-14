import { describe, expect, test } from "vitest";

import { createMockDatabase } from "@/mocks/db/mock-database";
import { buildManualDelivery } from "@/mocks/webhooks/build-manual-delivery";

function setUpEndpoint() {
  const mockDatabase = createMockDatabase("standard");
  const [endpointRecord] = mockDatabase.webhookEndpoints;
  const [firstEmail] = mockDatabase.emails;
  if (endpointRecord === undefined || firstEmail === undefined) {
    throw new Error("The fixtures need an endpoint and an email.");
  }

  return { mockDatabase, endpointRecord, firstEmail };
}

const composedRaw = (rawBody: string) => ({
  ...setUpEndpoint().endpointRecord,
  body_mode: "raw" as const,
  raw_content_type: "text/plain",
  raw_body: rawBody,
});

describe("buildManualDelivery", () => {
  test("WH-05.1 sends an email as a signed manual delivery in the chosen format", () => {
    const { mockDatabase, endpointRecord, firstEmail } = setUpEndpoint();

    const manualDelivery = buildManualDelivery(mockDatabase, endpointRecord, {
      email_id: firstEmail.id,
      template_id: "slack.incoming_webhook",
    });

    expect(manualDelivery).toMatchObject({
      trigger: "manual",
      status: "succeeded",
      event_type: "email.received",
      subject_id: firstEmail.id,
      endpoint_id: endpointRecord.id,
    });
    expect(manualDelivery?.request?.headers["webhook-signature"]).toMatch(
      /^v1,/,
    );
    expect(manualDelivery?.request?.body).toContain(firstEmail.subject);
  });

  test("WH-05.3 sends a composed request and WH-05.5 send-time values win", () => {
    const { mockDatabase, endpointRecord } = setUpEndpoint();

    const manualDelivery = buildManualDelivery(mockDatabase, endpointRecord, {
      request: composedRaw("{{ vars.reason }} for {{ vars.tenant_id }}"),
      variables: { tenant_id: "globex" },
    });

    expect(manualDelivery?.request?.body).toBe("manual test for globex");
    expect(manualDelivery?.request?.headers["content-type"]).toBe("text/plain");
  });

  test("WH-05.6 a render error stops the send; an edited body is sent as written", () => {
    const { mockDatabase, endpointRecord } = setUpEndpoint();
    const brokenRequest = composedRaw("{{ nope() }}");

    expect(
      buildManualDelivery(mockDatabase, endpointRecord, {
        request: brokenRequest,
      }),
    ).toMatchObject({
      status: "render_failed",
      request: null,
      error_message: "Unknown function: nope",
    });
    expect(
      buildManualDelivery(mockDatabase, endpointRecord, {
        request: brokenRequest,
        body: "edited by hand",
      })?.request?.body,
    ).toBe("edited by hand");
  });

  test("an unknown message gives no delivery", () => {
    const { mockDatabase, endpointRecord } = setUpEndpoint();

    expect(
      buildManualDelivery(mockDatabase, endpointRecord, { sms_id: "missing" }),
    ).toBeNull();
  });
});
