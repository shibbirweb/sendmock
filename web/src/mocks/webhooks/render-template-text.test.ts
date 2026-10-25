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
    ).toMatchObject({
      renderedText: "hello world to a%40b.test for ACME",
      warnings: [],
      errors: [],
    });
  });

  test("WH-08.4 renders undefined values empty and lists them as warnings", () => {
    expect(
      renderTemplateText("[{{ vars.missing }}]", templateContext),
    ).toMatchObject({
      renderedText: "[]",
      warnings: ["Undefined variable: vars.missing"],
      errors: [],
    });
  });

  test("default fills missing values without a warning", () => {
    expect(
      renderTemplateText(
        '{{ data.body | default(data.subject) }} {{ vars.x | default("none") }}',
        templateContext,
      ),
    ).toMatchObject({
      renderedText: "Hello World none",
      warnings: [],
      errors: [],
    });
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

  test("a lone }} is text, so JSON bodies ending in }} render", () => {
    const renderOutcome = renderTemplateText(
      '{"error":{"details":[{"code":"{{ data.subject }}"}]}}',
      templateContext,
    );

    expect(renderOutcome.errors).toEqual([]);
    expect(renderOutcome.renderedText).toContain('"code":"');
  });

  test("WH-07.15 problems carry the line and column of their expression", () => {
    const renderOutcome = renderTemplateText(
      '{\n  "a": "{{ vars.missing }}",\n  "b": "{{ data.subject | shout }}"\n}',
      templateContext,
    );

    expect(renderOutcome.locatedProblems).toEqual([
      {
        message: "Undefined variable: vars.missing",
        severity: "warning",
        line: 2,
        column: 9,
      },
      {
        message: "Unknown filter: shout",
        severity: "error",
        line: 3,
        column: 9,
      },
    ]);
    expect(
      renderTemplateText("x\n  {{ data.subject", templateContext)
        .locatedProblems,
    ).toEqual([
      {
        message: "Unbalanced {{ }}: every {{ needs a matching }}",
        severity: "error",
        line: 2,
        column: 3,
      },
    ]);
  });
});
