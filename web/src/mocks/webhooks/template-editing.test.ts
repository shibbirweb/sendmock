import { describe, expect, test } from "vitest";

import { mockDatabase, replaceMockDatabase } from "@/mocks/db/mock-database";
import { readTemplateDefinition } from "@/mocks/fixtures/template-definitions";
import { foldEndpointOverrides } from "@/mocks/webhooks/fold-endpoint-overrides";
import {
  createCustomTemplate,
  findTemplate,
  findTemplateProblem,
  saveTemplateVersion,
} from "@/mocks/webhooks/template-store";

describe("foldEndpointOverrides", () => {
  test("WH-09.1 writes extra headers and JSON fields into the template", () => {
    const foldedDefinition = foldEndpointOverrides(
      readTemplateDefinition("postmark.inbound"),
      { "X-Tenant": "{{ vars.tenant_id }}" },
      { environment: "staging" },
    );

    expect(foldedDefinition.header_templates).toEqual({
      "X-Tenant": "{{ vars.tenant_id }}",
    });
    expect(foldedDefinition.body_template).toMatch(
      /,\n {2}"environment": "staging"\n\}$/,
    );
    expect(() =>
      JSON.parse(foldedDefinition.body_template.replace(/\{\{[^}]*\}\}/g, "x")),
    ).not.toThrow();
  });

  test("adds form fields as name=value pairs", () => {
    const foldedDefinition = foldEndpointOverrides(
      readTemplateDefinition("twilio.inbound_sms"),
      {},
      { Region: "eu" },
    );

    expect(foldedDefinition.body_template.endsWith("&Region=eu")).toBe(true);
  });
});

describe("template revisions", () => {
  test("WH-09.5 each save keeps a revision, newest first, at most 20", () => {
    replaceMockDatabase("standard");
    const customTemplate = createCustomTemplate(
      {
        name: "History test",
        description: "",
        events: ["email.received"],
        required_variables: [],
      },
      readTemplateDefinition("native"),
    );

    for (let saveIndex = 0; saveIndex < 25; saveIndex += 1) {
      saveTemplateVersion(customTemplate, {
        ...readTemplateDefinition("native"),
        body_template: `{ "save": ${saveIndex} }`,
      });
    }

    const keptRevisions =
      mockDatabase.templateRevisions.get(customTemplate.id) ?? [];
    expect(customTemplate.revision).toBe(26);
    expect(keptRevisions).toHaveLength(20);
    expect(keptRevisions[0]?.revision).toBe(26);
    expect(keptRevisions[0]?.template.body_template).toBe('{ "save": 24 }');
  });

  test("WH-09.9 metadata changes only on custom templates; built-ins become Modified", () => {
    replaceMockDatabase("standard");
    const slackTemplate = findTemplate("slack.incoming_webhook");
    if (slackTemplate === undefined) {
      throw new Error("The fixtures need the Slack template.");
    }

    saveTemplateVersion(slackTemplate, {
      ...readTemplateDefinition("slack.incoming_webhook"),
      name: "Renamed",
      body_template: '{ "text": "hi" }',
    });

    expect(slackTemplate.name).toBe("Slack: incoming webhook");
    expect(slackTemplate.is_modified).toBe(true);
  });

  test("WH-09.5 a template that does not render cannot be saved", () => {
    replaceMockDatabase("standard");
    const slackTemplate = findTemplate("slack.incoming_webhook");
    if (slackTemplate === undefined) {
      throw new Error("The fixtures need the Slack template.");
    }

    expect(
      findTemplateProblem(slackTemplate, {
        ...readTemplateDefinition("slack.incoming_webhook"),
        body_template: '{ "text": "{{ data.subject | shout }}" }',
      }),
    ).toBe("Unknown filter: shout");
  });
});
