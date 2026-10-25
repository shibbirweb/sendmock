import { describe, expect, test } from "vitest";

import type { WebhookEndpointInput } from "@/lib/api/types";
import { validateWebhookEndpointInput } from "@/lib/webhooks/validate-webhook-endpoint";

const validEndpointInput: WebhookEndpointInput = {
  name: "Laravel inbound mail",
  url: "http://localhost:8000/webhooks/inbound-mail",
  method: "POST",
  headers: {},
  extra_fields: {},
  template_id: "native",
  template_mode: "linked",
  timeout_ms: 10_000,
  retry_policy: {
    max_attempts: 5,
    backoff_seconds: [1, 5, 30, 120, 600],
    retry_on_client_errors: false,
  },
  is_enabled: true,
};

describe("validateWebhookEndpointInput", () => {
  test("WH-01.5 accepts a valid endpoint", () => {
    expect(validateWebhookEndpointInput(validEndpointInput)).toEqual({});
  });

  test("WH-01.5 accepts templated URLs", () => {
    expect(
      validateWebhookEndpointInput({
        ...validEndpointInput,
        url: "{{ vars.base_url }}/hooks",
      }),
    ).toEqual({});
  });

  test("WH-01.5 rejects a missing name and a non-http URL", () => {
    expect(
      validateWebhookEndpointInput({
        ...validEndpointInput,
        name: "  ",
        url: "ftp://example.com",
      }),
    ).toMatchObject({
      name: "Enter a name",
      url: "Enter an http:// or https:// URL",
    });
  });

  test("WH-01.5 limits timeout to 1 to 60 seconds", () => {
    for (const timeoutMs of [0, 500, 60_001]) {
      expect(
        validateWebhookEndpointInput({
          ...validEndpointInput,
          timeout_ms: timeoutMs,
        }).timeout_ms,
      ).toBe("Use 1 to 60 seconds");
    }
  });

  test("WH-01.5 limits attempts to 1 to 10 and delays to 1 s to 24 h", () => {
    const fieldErrors = validateWebhookEndpointInput({
      ...validEndpointInput,
      retry_policy: {
        max_attempts: 11,
        backoff_seconds: [0, 86_401],
        retry_on_client_errors: false,
      },
    });

    expect(fieldErrors.retry_policy).toBe("Use 1 to 10 attempts");
    expect(fieldErrors.backoff_seconds).toBe(
      "Each delay must be 1 second to 24 hours",
    );
  });

  test("WH-01.5 needs a delay when there are retries", () => {
    expect(
      validateWebhookEndpointInput({
        ...validEndpointInput,
        retry_policy: {
          max_attempts: 3,
          backoff_seconds: [],
          retry_on_client_errors: false,
        },
      }).backoff_seconds,
    ).toBe("Add at least one retry delay");
    expect(
      validateWebhookEndpointInput({
        ...validEndpointInput,
        retry_policy: {
          max_attempts: 1,
          backoff_seconds: [],
          retry_on_client_errors: false,
        },
      }),
    ).toEqual({});
  });
});
