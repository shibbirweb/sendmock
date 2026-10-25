import { describe, expect, test } from "vitest";

import {
  createMockDatabase,
  findTemplateDefinition,
} from "@/mocks/db/mock-database";
import { buildTemplateContext } from "@/mocks/webhooks/build-template-context";
import { exportTemplateToml } from "@/mocks/webhooks/export-template-toml";
import { renderTemplateText } from "@/mocks/webhooks/render-template-text";

describe("template preview", () => {
  test("WH-08.4 renders a template against a stored email", () => {
    const mockDatabase = createMockDatabase("standard");
    const postmarkTemplate = mockDatabase.webhookTemplates.find(
      (webhookTemplate) => webhookTemplate.id === "postmark.inbound",
    );
    const [firstEmail] = mockDatabase.emails;
    if (postmarkTemplate === undefined || firstEmail === undefined) {
      throw new Error("The fixtures need the Postmark template and an email.");
    }

    const builtContext = buildTemplateContext(mockDatabase, postmarkTemplate, {
      email_id: firstEmail.id,
    });
    const renderOutcome = renderTemplateText(
      findTemplateDefinition(mockDatabase, postmarkTemplate.id).body_template,
      builtContext?.templateContext ?? {},
    );

    expect(builtContext?.renderedAgainst).toBe(
      firstEmail.subject || "(no subject)",
    );
    expect(renderOutcome.renderedText).toContain(firstEmail.from.address);
  });

  test("an unknown message gives no context", () => {
    const mockDatabase = createMockDatabase("standard");
    const [firstTemplate] = mockDatabase.webhookTemplates;
    if (firstTemplate === undefined) {
      throw new Error("The fixtures need a template.");
    }

    expect(
      buildTemplateContext(mockDatabase, firstTemplate, { sms_id: "missing" }),
    ).toBeNull();
  });
});

describe("exportTemplateToml", () => {
  test("writes the request shape and variable names, never values", () => {
    const mockDatabase = createMockDatabase("standard");
    const twilioTemplate = mockDatabase.webhookTemplates.find(
      (webhookTemplate) => webhookTemplate.id === "twilio.inbound_sms",
    );
    if (twilioTemplate === undefined) {
      throw new Error("The fixtures need the Twilio template.");
    }

    const exportedToml = exportTemplateToml({
      ...twilioTemplate,
      ...findTemplateDefinition(mockDatabase, twilioTemplate.id),
      used_by_endpoint_count: 0,
    });

    expect(exportedToml).toContain('id = "twilio.inbound_sms"');
    expect(exportedToml).toContain('variables = ["twilio_auth_token"]');
    expect(exportedToml).toContain('"X-Twilio-Signature" = ');
    expect(exportedToml).not.toContain("••••");
  });
});
