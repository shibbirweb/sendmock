import { describe, expect, test } from "vitest";

import { validateTemplateDraft } from "@/lib/webhooks/validate-template-draft";

describe("validateTemplateDraft", () => {
  test("WH-09.7 accepts a complete draft", () => {
    expect(
      validateTemplateDraft({
        method: "POST",
        content_type: "application/json",
        header_templates: { "X-Tenant": "{{ vars.tenant_id }}" },
        body_template: '{ "ok": true }',
      }),
    ).toEqual({});
  });

  test("WH-09.7 flags a missing content type, bad header names and an empty body", () => {
    expect(
      validateTemplateDraft({
        method: "POST",
        content_type: " ",
        header_templates: { "bad header": "x" },
        body_template: "",
      }),
    ).toEqual({
      content_type: "Enter a content type, e.g. application/json",
      header_templates: '"bad header" is not a valid header name',
      body_template: "Enter a body, or use GET for a request without one",
    });
  });

  test("a GET template may have no body", () => {
    expect(
      validateTemplateDraft({
        method: "GET",
        content_type: "text/plain",
        header_templates: {},
        body_template: "",
      }),
    ).toEqual({});
  });
});
