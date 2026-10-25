import { http, HttpResponse } from "msw";

import type {
  TemplateCloneRequest,
  TemplateDraft,
  TemplateRenderRequest,
  TemplateRenderResult,
  WebhookTemplateDetail,
  WebhookTemplateSummary,
} from "@/lib/api/types";
import { validateTemplateDraft } from "@/lib/webhooks/validate-template-draft";
import { findTemplateDefinition, mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { buildTemplateContext } from "@/mocks/webhooks/build-template-context";
import { buildCustomTemplateId } from "@/mocks/webhooks/custom-template-id";
import { exportTemplateToml } from "@/mocks/webhooks/export-template-toml";
import { renderTemplateDefinition } from "@/mocks/webhooks/render-template-definition";

function findTemplate(templateId: unknown) {
  return mockDatabase.webhookTemplates.find(
    (webhookTemplate) => webhookTemplate.id === templateId,
  );
}

function countUsingEndpoints(templateId: string): number {
  return mockDatabase.webhookEndpoints.filter(
    (endpointRecord) => endpointRecord.template_id === templateId,
  ).length;
}

function buildTemplateDetail(
  webhookTemplate: WebhookTemplateSummary,
): WebhookTemplateDetail {
  return {
    ...webhookTemplate,
    ...findTemplateDefinition(mockDatabase, webhookTemplate.id),
    used_by_endpoint_count: countUsingEndpoints(webhookTemplate.id),
  };
}

/** Templates: list, detail, preview render, clone, export and delete (WH-08, WH-09). */
export const webhookTemplateHandlers = [
  http.get("*/api/v1/webhooks/templates", async () => {
    const conditionResponse = await applyMockConditions();

    return (
      conditionResponse ?? HttpResponse.json(mockDatabase.webhookTemplates)
    );
  }),

  http.get("*/api/v1/webhooks/templates/:templateId", async ({ params }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const webhookTemplate = findTemplate(params.templateId);

    return webhookTemplate
      ? HttpResponse.json(buildTemplateDetail(webhookTemplate))
      : createNotFoundResponse("Template");
  }),

  http.post(
    "*/api/v1/webhooks/templates/:templateId/render",
    async ({ params, request }) => {
      await applyMockConditions();
      const webhookTemplate = findTemplate(params.templateId);
      if (!webhookTemplate) {
        return createNotFoundResponse("Template");
      }

      const renderRequest = (await request.json()) as TemplateRenderRequest;
      const builtContext = buildTemplateContext(
        mockDatabase,
        webhookTemplate,
        renderRequest,
      );
      if (builtContext === null) {
        return createNotFoundResponse("Message");
      }

      const renderedTemplate = renderTemplateDefinition(
        renderRequest.draft ??
          findTemplateDefinition(mockDatabase, webhookTemplate.id),
        builtContext.templateContext,
      );
      const renderResult: TemplateRenderResult = {
        rendered_against: builtContext.renderedAgainst,
        ...renderedTemplate,
      };

      return HttpResponse.json(renderResult);
    },
  ),

  http.patch(
    "*/api/v1/webhooks/templates/:templateId",
    async ({ params, request }) => {
      await applyMockConditions();
      const webhookTemplate = findTemplate(params.templateId);
      if (!webhookTemplate) {
        return createNotFoundResponse("Template");
      }
      if (webhookTemplate.source === "file") {
        return createErrorResponse(
          409,
          "read_only_template",
          "File templates are read-only: edit the file, or clone the template.",
        );
      }

      const templateDraft = (await request.json()) as TemplateDraft;
      const shapeError = Object.values(
        validateTemplateDraft(templateDraft),
      ).find(Boolean);
      const sampleContext = buildTemplateContext(
        mockDatabase,
        webhookTemplate,
        {},
      );
      const renderErrors = renderTemplateDefinition(
        templateDraft,
        sampleContext?.templateContext ?? {},
      ).errors;
      const firstProblem = shapeError ?? renderErrors[0];
      if (firstProblem !== undefined) {
        return createErrorResponse(422, "template_invalid", firstProblem);
      }

      mockDatabase.customTemplateDefinitions.set(webhookTemplate.id, {
        ...findTemplateDefinition(mockDatabase, webhookTemplate.id),
        ...templateDraft,
      });
      webhookTemplate.revision += 1;
      webhookTemplate.is_modified = webhookTemplate.source === "builtin";

      return HttpResponse.json(buildTemplateDetail(webhookTemplate));
    },
  ),

  http.post(
    "*/api/v1/webhooks/templates/:templateId/reset",
    async ({ params }) => {
      await applyMockConditions();
      const webhookTemplate = findTemplate(params.templateId);
      if (!webhookTemplate) {
        return createNotFoundResponse("Template");
      }
      if (
        webhookTemplate.source !== "builtin" ||
        !webhookTemplate.is_modified
      ) {
        return createErrorResponse(
          409,
          "not_modified",
          "Only an edited built-in template can be reset.",
        );
      }

      mockDatabase.customTemplateDefinitions.delete(webhookTemplate.id);
      webhookTemplate.is_modified = false;
      webhookTemplate.revision = 1;

      return HttpResponse.json(buildTemplateDetail(webhookTemplate));
    },
  ),

  http.post(
    "*/api/v1/webhooks/templates/:templateId/clone",
    async ({ params, request }) => {
      await applyMockConditions();
      const sourceTemplate = findTemplate(params.templateId);
      if (!sourceTemplate) {
        return createNotFoundResponse("Template");
      }

      const { name } = (await request.json()) as TemplateCloneRequest;
      if (name.trim() === "") {
        return createErrorResponse(400, "validation_failed", "Enter a name");
      }

      const clonedTemplate: WebhookTemplateSummary = {
        ...sourceTemplate,
        id: buildCustomTemplateId(mockDatabase, name.trim()),
        name: name.trim(),
        category: "custom",
        source: "custom",
        description: `Copy of ${sourceTemplate.name}.`,
        revision: 1,
      };
      mockDatabase.webhookTemplates.push(clonedTemplate);
      mockDatabase.customTemplateDefinitions.set(
        clonedTemplate.id,
        findTemplateDefinition(mockDatabase, sourceTemplate.id),
      );

      return HttpResponse.json(clonedTemplate, { status: 201 });
    },
  ),

  http.get(
    "*/api/v1/webhooks/templates/:templateId/export",
    async ({ params }) => {
      await applyMockConditions();
      const webhookTemplate = findTemplate(params.templateId);
      if (!webhookTemplate) {
        return createNotFoundResponse("Template");
      }

      return new HttpResponse(
        exportTemplateToml(buildTemplateDetail(webhookTemplate)),
        {
          headers: { "content-type": "application/toml" },
        },
      );
    },
  ),

  http.delete(
    "*/api/v1/webhooks/templates/:templateId",
    async ({ params, request }) => {
      await applyMockConditions();
      const webhookTemplate = findTemplate(params.templateId);
      if (!webhookTemplate) {
        return createNotFoundResponse("Template");
      }
      if (webhookTemplate.source !== "custom") {
        return createErrorResponse(
          409,
          "read_only_template",
          "Built-in and file templates cannot be deleted. Clone one to make your own.",
        );
      }

      const usingEndpointCount = countUsingEndpoints(webhookTemplate.id);
      const shouldDetach =
        new URL(request.url).searchParams.get("endpoints") === "detach";
      if (usingEndpointCount > 0 && !shouldDetach) {
        return createErrorResponse(
          409,
          "template_in_use",
          `${usingEndpointCount} endpoint(s) use this template. Detach them or cancel.`,
        );
      }

      // Detached endpoints keep a private copy, so their definition stays.
      for (const endpointRecord of mockDatabase.webhookEndpoints) {
        if (endpointRecord.template_id === webhookTemplate.id) {
          endpointRecord.template_mode = "detached";
        }
      }
      if (usingEndpointCount === 0) {
        mockDatabase.customTemplateDefinitions.delete(webhookTemplate.id);
      }
      mockDatabase.webhookTemplates = mockDatabase.webhookTemplates.filter(
        (existingTemplate) => existingTemplate.id !== webhookTemplate.id,
      );

      return new HttpResponse(null, { status: 204 });
    },
  ),
];
