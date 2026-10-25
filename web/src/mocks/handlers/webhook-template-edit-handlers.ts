import { http, HttpResponse } from "msw";

import type {
  SaveAsTemplateRequest,
  TemplateCreateRequest,
  TemplateImportRequest,
  TemplateUpdate,
} from "@/lib/api/types";
import { findTemplateDefinition, mockDatabase } from "@/mocks/db/mock-database";
import { readTemplateDefinition } from "@/mocks/fixtures/template-definitions";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { foldEndpointOverrides } from "@/mocks/webhooks/fold-endpoint-overrides";
import { importTemplateFile } from "@/mocks/webhooks/import-template-file";
import {
  buildTemplateDetail,
  createCustomTemplate,
  findTemplate,
  findTemplateProblem,
  saveTemplateVersion,
} from "@/mocks/webhooks/template-store";

/** Templates: create, edit, reset, import, revisions and save from an endpoint (WH-09). */
export const webhookTemplateEditHandlers = [
  http.post("*/api/v1/webhooks/templates/import", async ({ request }) => {
    await applyMockConditions();
    const importRequest = (await request.json()) as TemplateImportRequest;

    return importTemplateFile(importRequest);
  }),

  http.post("*/api/v1/webhooks/templates", async ({ request }) => {
    await applyMockConditions();
    const { name } = (await request.json()) as TemplateCreateRequest;
    if (name.trim() === "") {
      return createErrorResponse(400, "validation_failed", "Enter a name");
    }

    const blankTemplate = createCustomTemplate(
      {
        name: name.trim(),
        description: "",
        events: ["email.received"],
        required_variables: [],
      },
      readTemplateDefinition("native"),
    );

    return HttpResponse.json(blankTemplate, { status: 201 });
  }),

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

      const templateUpdate = (await request.json()) as TemplateUpdate;
      if (
        templateUpdate.name !== undefined &&
        templateUpdate.name.trim() === ""
      ) {
        return createErrorResponse(400, "validation_failed", "Enter a name");
      }
      const templateProblem = findTemplateProblem(
        webhookTemplate,
        templateUpdate,
      );
      if (templateProblem !== undefined) {
        return createErrorResponse(422, "template_invalid", templateProblem);
      }

      saveTemplateVersion(webhookTemplate, templateUpdate);

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

      // Reset removes the edit and its history together.
      mockDatabase.customTemplateDefinitions.delete(webhookTemplate.id);
      mockDatabase.templateRevisions.delete(webhookTemplate.id);
      webhookTemplate.is_modified = false;
      webhookTemplate.revision = 1;

      return HttpResponse.json(buildTemplateDetail(webhookTemplate));
    },
  ),

  http.get(
    "*/api/v1/webhooks/templates/:templateId/revisions",
    async ({ params }) => {
      const conditionResponse = await applyMockConditions();
      if (conditionResponse) {
        return conditionResponse;
      }
      if (!findTemplate(params.templateId)) {
        return createNotFoundResponse("Template");
      }

      return HttpResponse.json(
        mockDatabase.templateRevisions.get(String(params.templateId)) ?? [],
      );
    },
  ),

  http.post(
    "*/api/v1/webhooks/templates/:templateId/revisions/:revision/restore",
    async ({ params }) => {
      await applyMockConditions();
      const webhookTemplate = findTemplate(params.templateId);
      const restoredRevision = mockDatabase.templateRevisions
        .get(String(params.templateId))
        ?.find(
          (templateRevision) =>
            String(templateRevision.revision) === params.revision,
        );
      if (!webhookTemplate || restoredRevision === undefined) {
        return createNotFoundResponse("Revision");
      }

      saveTemplateVersion(webhookTemplate, restoredRevision.template);

      return HttpResponse.json(buildTemplateDetail(webhookTemplate));
    },
  ),

  http.post(
    "*/api/v1/webhooks/endpoints/:endpointId/save-as-template",
    async ({ params, request }) => {
      await applyMockConditions();
      const endpointRecord = mockDatabase.webhookEndpoints.find(
        (existingEndpoint) => existingEndpoint.id === params.endpointId,
      );
      if (!endpointRecord) {
        return createNotFoundResponse("Endpoint");
      }

      const { name } = (await request.json()) as SaveAsTemplateRequest;
      if (name.trim() === "") {
        return createErrorResponse(400, "validation_failed", "Enter a name");
      }

      const baseTemplate = findTemplate(endpointRecord.template_id);
      const savedTemplate = createCustomTemplate(
        {
          name: name.trim(),
          service: baseTemplate?.service ?? "Custom",
          description: `Saved from the endpoint "${endpointRecord.name}".`,
          events: baseTemplate?.events ?? [],
          required_variables: baseTemplate?.required_variables ?? [],
        },
        foldEndpointOverrides(
          findTemplateDefinition(mockDatabase, endpointRecord.template_id),
          endpointRecord.headers,
          endpointRecord.extra_fields,
        ),
      );

      return HttpResponse.json(savedTemplate, { status: 201 });
    },
  ),
];
