import { HttpResponse } from "msw";

import type { TemplateImportRequest } from "@/lib/api/types";
import { createErrorResponse } from "@/mocks/handlers/handler-utils";
import { parseTemplateFile } from "@/mocks/webhooks/parse-template-file";
import {
  createCustomTemplate,
  findTemplate,
  findTemplateProblem,
  saveTemplateVersion,
} from "@/mocks/webhooks/template-store";

/**
 * Imports an exported template (WH-09.3): a new custom template, an edit of
 * a built-in, or, when the id is taken, a replacement or a copy as chosen.
 */
export function importTemplateFile(
  importRequest: TemplateImportRequest,
): Response {
  const parseOutcome = parseTemplateFile(importRequest.file_text);
  if ("parseError" in parseOutcome) {
    return createErrorResponse(
      422,
      "template_invalid",
      parseOutcome.parseError,
    );
  }

  const { parsedTemplate } = parseOutcome;
  const templateDraft = {
    method: parsedTemplate.method,
    content_type: parsedTemplate.contentType,
    header_templates: parsedTemplate.headers,
    body_template: parsedTemplate.body,
  };
  const templateMetadata = {
    name: parsedTemplate.name,
    service: parsedTemplate.service,
    description: "Imported from a template file.",
    events: parsedTemplate.events,
    required_variables: parsedTemplate.variables,
  };
  const existingTemplate =
    parsedTemplate.id === null ? undefined : findTemplate(parsedTemplate.id);
  const isReplacing = importRequest.on_conflict === "replace";

  if (existingTemplate !== undefined && importRequest.on_conflict !== "copy") {
    if (existingTemplate.source === "file") {
      return createErrorResponse(
        409,
        "read_only_template",
        `${existingTemplate.name} is a file template and cannot be replaced.`,
      );
    }
    if (
      !isReplacing &&
      !(parsedTemplate.editsBuiltin && existingTemplate.source === "builtin")
    ) {
      return createErrorResponse(
        409,
        "template_exists",
        `A template with the id ${existingTemplate.id} exists: ${existingTemplate.name}.`,
      );
    }

    const templateProblem = findTemplateProblem(
      existingTemplate,
      templateDraft,
    );
    if (templateProblem !== undefined) {
      return createErrorResponse(422, "template_invalid", templateProblem);
    }
    saveTemplateVersion(existingTemplate, {
      ...templateDraft,
      ...templateMetadata,
    });

    return HttpResponse.json(existingTemplate);
  }

  // Checked against the sample of its first event before anything is stored.
  const templateProblem = findTemplateProblem(
    {
      ...templateMetadata,
      id: "import-check",
      category: "custom",
      source: "custom",
      revision: 1,
      is_modified: false,
    },
    templateDraft,
  );
  if (templateProblem !== undefined) {
    return createErrorResponse(422, "template_invalid", templateProblem);
  }

  const importedTemplate = createCustomTemplate(templateMetadata, {
    ...templateDraft,
    doc_url: null,
    verified_on: null,
  });

  return HttpResponse.json(importedTemplate, { status: 201 });
}
