import { http, HttpResponse } from "msw";

import type { EmailTemplate, EmailTemplateChanges } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { applyMockConditions } from "@/mocks/handlers/handler-utils";

function findTemplateIndex(templateId: unknown): number {
  return mockDatabase.emailTemplates.findIndex(
    (emailTemplate) => emailTemplate.id === templateId,
  );
}

function hasBody(emailTemplate: Pick<EmailTemplate, "text" | "html">): boolean {
  return Boolean(emailTemplate.text) || Boolean(emailTemplate.html);
}

const notFound = () =>
  HttpResponse.json(
    { error: { code: "not_found", message: "No email template with that id" } },
    { status: 404 },
  );

const missingBody = () =>
  HttpResponse.json(
    {
      error: {
        code: "invalid_input",
        message: "An email template needs a text or HTML body",
        field: "text",
      },
    },
    { status: 400 },
  );

/** Local email templates: Mail > Templates (EM-26.2). */
export const emailTemplateHandlers = [
  http.get("*/api/v1/emails/templates", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockDatabase.emailTemplates);
  }),

  http.post("*/api/v1/emails/templates", async ({ request }) => {
    await applyMockConditions();
    const templateInput = (await request.json()) as EmailTemplate;
    const templateId = templateInput.id.trim();
    if (templateId === "") {
      return HttpResponse.json(
        {
          error: {
            code: "invalid_input",
            message: "Enter the provider's template id or name",
            field: "id",
          },
        },
        { status: 400 },
      );
    }
    if (!hasBody(templateInput)) {
      return missingBody();
    }
    if (findTemplateIndex(templateId) !== -1) {
      return HttpResponse.json(
        {
          error: {
            code: "email_template_exists",
            message: `An email template with id ${templateId} exists; change it instead`,
          },
        },
        { status: 409 },
      );
    }
    const createdTemplate: EmailTemplate = { ...templateInput, id: templateId };
    mockDatabase.emailTemplates = [
      ...mockDatabase.emailTemplates,
      createdTemplate,
    ];

    return HttpResponse.json(createdTemplate, { status: 201 });
  }),

  http.patch(
    "*/api/v1/emails/templates/:templateId",
    async ({ params, request }) => {
      await applyMockConditions();
      const templateIndex = findTemplateIndex(params.templateId);
      const storedTemplate = mockDatabase.emailTemplates[templateIndex];
      if (storedTemplate === undefined) {
        return notFound();
      }
      const changes = (await request.json()) as Partial<EmailTemplateChanges>;
      const changedTemplate: EmailTemplate = { ...storedTemplate, ...changes };
      if (!hasBody(changedTemplate)) {
        return missingBody();
      }
      mockDatabase.emailTemplates = mockDatabase.emailTemplates.map(
        (emailTemplate, index) =>
          index === templateIndex ? changedTemplate : emailTemplate,
      );

      return HttpResponse.json(changedTemplate);
    },
  ),

  http.delete("*/api/v1/emails/templates/:templateId", async ({ params }) => {
    await applyMockConditions();
    if (findTemplateIndex(params.templateId) === -1) {
      return notFound();
    }
    mockDatabase.emailTemplates = mockDatabase.emailTemplates.filter(
      (emailTemplate) => emailTemplate.id !== params.templateId,
    );

    return new HttpResponse(null, { status: 204 });
  }),
];
