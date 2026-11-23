import { describe, expect, test } from "vitest";

import { findTemplateEventWarning } from "@/features/webhooks/targets/template-event-warning";
import type { WebhookEndpoint, WebhookTemplateSummary } from "@/lib/api/types";

const routesTemplate = {
  id: "mailgun.routes",
  name: "Mailgun: routes (inbound)",
  events: ["email.inbound"],
} as WebhookTemplateSummary;
const anyEventTemplate = {
  id: "native",
  name: "Native",
  events: [],
} as unknown as WebhookTemplateSummary;

function endpointWith(templateId: string): WebhookEndpoint {
  return { id: "ep_1", template_id: templateId } as WebhookEndpoint;
}

describe("template event warning", () => {
  test("EM-25.5 warns when the chosen endpoint's template does not list the event", () => {
    expect(
      findTemplateEventWarning(
        endpointWith("mailgun.routes"),
        [routesTemplate],
        "email.bounced",
      ),
    ).toBe(
      "Its template, Mailgun: routes (inbound), is not made for email.bounced; your app may not read what it sends.",
    );
  });

  test("EM-25.5 says nothing when the template lists the event or takes any", () => {
    expect(
      findTemplateEventWarning(
        endpointWith("mailgun.routes"),
        [routesTemplate],
        "email.inbound",
      ),
    ).toBeNull();
    expect(
      findTemplateEventWarning(
        endpointWith("native"),
        [anyEventTemplate],
        "email.bounced",
      ),
    ).toBeNull();
    expect(
      findTemplateEventWarning(endpointWith("unknown"), [], "email.bounced"),
    ).toBeNull();
  });
});
