import { describe, expect, test } from "vitest";

import { renderTemplateText } from "@/mocks/webhooks/render-template-text";

const templateContext = {
  event: { type: "email.received" },
  data: { subject: "Hello World", to: [{ address: "a@b.test" }], tags: [] },
  vars: { tenant_id: "acme" },
};

describe("renderTemplateText", () => {
  test("WH-08.4 reads paths, indexes and filters", () => {
    expect(
      renderTemplateText(
        "{{ data.subject | lower }} to {{ data.to[0].address | urlencode }} for {{ vars.tenant_id | upper }}",
        templateContext,
      ),
    ).toEqual({
      renderedText: "hello world to a%40b.test for ACME",
      warnings: [],
      errors: [],
    });
  });

  test("WH-08.4 renders undefined values empty and lists them as warnings", () => {
    expect(renderTemplateText("[{{ vars.missing }}]", templateContext)).toEqual(
      {
        renderedText: "[]",
        warnings: ["Undefined variable: vars.missing"],
        errors: [],
      },
    );
  });

  test("default fills missing values without a warning", () => {
    expect(
      renderTemplateText(
        '{{ data.body | default(data.subject) }} {{ vars.x | default("none") }}',
        templateContext,
      ),
    ).toEqual({ renderedText: "Hello World none", warnings: [], errors: [] });
  });

  test("json, functions and unknown names", () => {
    const renderOutcome = renderTemplateText(
      "{{ data.tags | json }} {{ now_unix() }} {{ nope() }} {{ data.subject | shout }}",
      templateContext,
    );

    expect(renderOutcome.renderedText).toMatch(/^\[\] \d{10} {2}Hello World$/);
    expect(renderOutcome.errors).toEqual([
      "Unknown function: nope",
      "Unknown filter: shout",
    ]);
  });

  test("WH-09.7 unbalanced braces are an error", () => {
    expect(
      renderTemplateText('{"a": "{{ data.subject }"}', templateContext).errors,
    ).toEqual(["Unbalanced {{ }}: every {{ needs a matching }}"]);
  });
});
