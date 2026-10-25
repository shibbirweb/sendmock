import { describe, expect, test } from "vitest";

import type { WebhookEndpointInput } from "@/lib/api/types";
import { defaultEndpointRequest } from "@/lib/webhooks/endpoint-request-defaults";
import { createMockDatabase } from "@/mocks/db/mock-database";
import { renderEndpointRequest } from "@/mocks/webhooks/render-endpoint-request";

const baseEndpointInput: WebhookEndpointInput = {
  name: "Preview test",
  url: "http://localhost:8000/hooks",
  method: "POST",
  headers: {},
  extra_fields: {},
  template_id: "native",
  template_mode: "linked",
  timeout_ms: 10_000,
  retry_policy: {
    max_attempts: 1,
    backoff_seconds: [],
    retry_on_client_errors: false,
  },
  is_enabled: true,
  ...defaultEndpointRequest,
};

function renderPreview(changedInput: Partial<WebhookEndpointInput>) {
  const previewResult = renderEndpointRequest(createMockDatabase("standard"), {
    endpoint: { ...baseEndpointInput, ...changedInput },
  });
  if (previewResult === null) {
    throw new Error("The sample always renders.");
  }

  return previewResult;
}

describe("renderEndpointRequest", () => {
  test("WH-07.14 Fields mode encodes typed, nested JSON", () => {
    const previewResult = renderPreview({
      body_mode: "fields",
      body_fields: [
        {
          name: "user.email",
          value_type: "text",
          value: "{{ data.to[0].address }}",
        },
        {
          name: "attempt",
          value_type: "number",
          value: "{{ delivery.attempt }}",
        },
        {
          name: "is_test",
          value_type: "boolean",
          value: "true",
        },
        {
          name: "tags",
          value_type: "json",
          value: '["otp"]',
        },
      ],
    });

    expect(previewResult.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(previewResult.body)).toEqual({
      user: { email: "you@example.com" },
      attempt: 1,
      is_test: true,
      tags: ["otp"],
    });
    expect(previewResult.problems).toEqual([]);
  });

  test("WH-07.14 Fields mode can encode a form body", () => {
    const previewResult = renderPreview({
      body_mode: "fields",
      fields_encoding: "form",
      body_fields: [
        {
          name: "Subject",
          value_type: "text",
          value: "{{ data.subject }}",
        },
      ],
    });

    expect(previewResult.headers["content-type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(previewResult.body).toBe("Subject=Your+verification+code");
  });

  test("WH-07.14 a field that renders the wrong type is an error on that field", () => {
    const previewResult = renderPreview({
      body_mode: "fields",
      body_fields: [
        {
          name: "attempt",
          value_type: "number",
          value: "{{ data.subject }}",
        },
      ],
    });

    expect(previewResult.problems).toEqual([
      expect.objectContaining({ source: "field.0", severity: "error" }),
    ]);
  });

  test("WH-07.14 query params are appended and None sends no body", () => {
    const previewResult = renderPreview({
      url: "http://localhost:8000/hooks?fixed=1",
      body_mode: "none",
      query_params: [
        {
          name: "to",
          value: "{{ data.to[0].address }}",
        },
      ],
    });

    expect(previewResult.url).toBe(
      "http://localhost:8000/hooks?fixed=1&to=you%40example.com",
    );
    expect(previewResult.body).toBe("");
    expect(previewResult.headers["content-type"]).toBeUndefined();
  });

  test("WH-07.15 raw body problems carry the body source, line and column", () => {
    const previewResult = renderPreview({
      body_mode: "raw",
      raw_body: '{\n  "subject": "{{ data.subjekt }}"\n}',
    });

    expect(previewResult.problems).toEqual([
      {
        message: "Undefined variable: data.subjekt",
        severity: "error",
        source: "body",
        line: 2,
        column: 15,
      },
    ]);
  });

  test("WH-07.15 Lenient keeps an undefined value as a warning", () => {
    const previewResult = renderPreview({
      render_mode: "lenient",
      headers: { "X-Tenant": "{{ vars.missing }}" },
    });

    expect(previewResult.problems).toEqual([
      expect.objectContaining({
        source: "header.0",
        severity: "warning",
        message: "Undefined variable: vars.missing",
      }),
    ]);
  });

  test("WH-07.15 renders against a chosen message", () => {
    const mockDatabase = createMockDatabase("standard");
    const [firstEmail] = mockDatabase.emails;
    if (firstEmail === undefined) {
      throw new Error("The fixtures need an email.");
    }

    const previewResult = renderEndpointRequest(mockDatabase, {
      endpoint: {
        ...baseEndpointInput,
        body_mode: "raw",
        raw_content_type: "text/plain",
        raw_body: "{{ data.subject }}",
      },
      email_id: firstEmail.id,
    });

    expect(previewResult?.body).toBe(firstEmail.subject);
  });
});
