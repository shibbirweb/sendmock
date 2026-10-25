import { http, HttpResponse } from "msw";

import {
  type AppEventType,
  appEventTypes,
  type TemplateCloneRequest,
  type TemplateRenderRequest,
  type TemplateRenderResult,
} from "@/lib/api/types";
import { findTemplateDefinition, mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { buildTemplateContext } from "@/mocks/webhooks/build-template-context";
import { buildTemplateReference } from "@/mocks/webhooks/build-template-reference";
import { exportTemplateToml } from "@/mocks/webhooks/export-template-toml";
import { renderTemplateDefinition } from "@/mocks/webhooks/render-template-definition";
import {
  buildTemplateDetail,
  countUsingEndpoints,
  createCustomTemplate,
  findTemplate,
} from "@/mocks/webhooks/template-store";

/** Templates: list, detail, preview render, clone, export and delete (WH-08, WH-09). */
export const webhookTemplateHandlers = [
  http.get("*/api/v1/webhooks/templates", async () => {
    const conditionResponse = await applyMockConditions();

    return (
      conditionResponse ?? HttpResponse.json(mockDatabase.webhookTemplates)
    );
  }),

  http.get("*/api/v1/webhooks/template-reference", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    const eventsText = new URL(request.url).searchParams.get("events") ?? "";
    const events = eventsText
      .split(",")
      .filter((eventType): eventType is AppEventType =>
        (appEventTypes as readonly string[]).includes(eventType),
      );

    return (
      conditionResponse ??
      HttpResponse.json(buildTemplateReference(mockDatabase, events))
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

      const renderResult: TemplateRenderResult = {
        rendered_against: builtContext.renderedAgainst,
        ...renderTemplateDefinition(
          renderRequest.draft ??
            findTemplateDefinition(mockDatabase, webhookTemplate.id),
          builtContext.templateContext,
        ),
      };

      return HttpResponse.json(renderResult);
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

      const clonedTemplate = createCustomTemplate(
        {
          name: name.trim(),
          service: sourceTemplate.service,
          description: `Copy of ${sourceTemplate.name}.`,
          events: sourceTemplate.events,
          required_variables: sourceTemplate.required_variables,
        },
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
      mockDatabase.templateRevisions.delete(webhookTemplate.id);
      mockDatabase.webhookTemplates = mockDatabase.webhookTemplates.filter(
        (existingTemplate) => existingTemplate.id !== webhookTemplate.id,
      );

      return new HttpResponse(null, { status: 204 });
    },
  ),
];
