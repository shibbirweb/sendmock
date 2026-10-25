import { describe, expect, test } from "vitest";

import {
  createMockDatabase,
  findTemplateDefinition,
} from "@/mocks/db/mock-database";
import { exportTemplateToml } from "@/mocks/webhooks/export-template-toml";
import { parseTemplateFile } from "@/mocks/webhooks/parse-template-file";

describe("parseTemplateFile", () => {
  test("WH-09.3 an exported template reads back identically", () => {
    const mockDatabase = createMockDatabase("standard");
    for (const templateId of [
      "twilio.inbound_sms",
      "custom.tenant_inbound",
      "ses.sns",
    ]) {
      const webhookTemplate = mockDatabase.webhookTemplates.find(
        (existingTemplate) => existingTemplate.id === templateId,
      );
      if (webhookTemplate === undefined) {
        throw new Error(`The fixtures need ${templateId}.`);
      }
      const templateDefinition = findTemplateDefinition(
        mockDatabase,
        templateId,
      );

      const parseOutcome = parseTemplateFile(
        exportTemplateToml({
          ...webhookTemplate,
          ...templateDefinition,
          used_by_endpoint_count: 0,
        }),
      );

      expect(parseOutcome).toEqual({
        parsedTemplate: {
          id: templateId,
          name: webhookTemplate.name,
          service: webhookTemplate.service,
          events: webhookTemplate.events,
          variables: webhookTemplate.required_variables,
          editsBuiltin: webhookTemplate.source === "builtin",
          method: templateDefinition.method,
          contentType: templateDefinition.content_type,
          headers: templateDefinition.header_templates,
          body: templateDefinition.body_template,
        },
      });
    }
  });

  test("WH-09.3 reads the same keys from JSON", () => {
    const parseOutcome = parseTemplateFile(
      JSON.stringify({
        name: "Pasted",
        events: ["email.received", "not.an.event"],
        request: {
          method: "POST",
          content_type: "application/json",
          body: '{ "s": "{{ data.subject }}" }',
          headers: { "X-A": "1" },
        },
      }),
    );

    expect(parseOutcome).toMatchObject({
      parsedTemplate: {
        id: null,
        name: "Pasted",
        events: ["email.received"],
        headers: { "X-A": "1" },
      },
    });
  });

  test("explains what is missing or unreadable", () => {
    expect(parseTemplateFile('name = "No request"')).toEqual({
      parseError:
        "A template needs name, request.method, request.content_type and request.body",
    });
    expect(parseTemplateFile("this is not toml")).toMatchObject({
      parseError: expect.stringMatching(/^The file could not be read/),
    });
  });
});
