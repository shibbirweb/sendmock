import type {
  TemplateDraft,
  TemplateMetadata,
  TemplateUpdate,
  WebhookTemplateDetail,
  WebhookTemplateSummary,
} from "@/lib/api/types";
import { validateTemplateDraft } from "@/lib/webhooks/validate-template-draft";
import { findTemplateDefinition, mockDatabase } from "@/mocks/db/mock-database";
import type { TemplateDefinition } from "@/mocks/fixtures/template-definitions";
import { buildTemplateContext } from "@/mocks/webhooks/build-template-context";
import { buildCustomTemplateId } from "@/mocks/webhooks/custom-template-id";
import { renderTemplateDefinition } from "@/mocks/webhooks/render-template-definition";

const keptRevisionCount = 20;

export function findTemplate(
  templateId: unknown,
): WebhookTemplateSummary | undefined {
  return mockDatabase.webhookTemplates.find(
    (webhookTemplate) => webhookTemplate.id === templateId,
  );
}

export function countUsingEndpoints(templateId: string): number {
  return mockDatabase.webhookEndpoints.filter(
    (endpointRecord) => endpointRecord.template_id === templateId,
  ).length;
}

export function buildTemplateDetail(
  webhookTemplate: WebhookTemplateSummary,
): WebhookTemplateDetail {
  return {
    ...webhookTemplate,
    ...findTemplateDefinition(mockDatabase, webhookTemplate.id),
    used_by_endpoint_count: countUsingEndpoints(webhookTemplate.id),
  };
}

/** The first reason a draft cannot be saved: its shape, or it does not render (WH-09.5). */
export function findTemplateProblem(
  webhookTemplate: WebhookTemplateSummary,
  templateDraft: TemplateDraft,
): string | undefined {
  const shapeError = Object.values(validateTemplateDraft(templateDraft)).find(
    Boolean,
  );
  if (shapeError !== undefined) {
    return shapeError;
  }

  const sampleContext = buildTemplateContext(mockDatabase, webhookTemplate, {});

  return renderTemplateDefinition(
    templateDraft,
    sampleContext?.templateContext ?? {},
  ).errors[0];
}

/** Keeps the template as it is now as its newest revision; the last 20 are kept. */
export function recordTemplateRevision(
  webhookTemplate: WebhookTemplateSummary,
) {
  const templateDefinition = findTemplateDefinition(
    mockDatabase,
    webhookTemplate.id,
  );
  const earlierRevisions =
    mockDatabase.templateRevisions.get(webhookTemplate.id) ?? [];
  mockDatabase.templateRevisions.set(
    webhookTemplate.id,
    [
      {
        revision: webhookTemplate.revision,
        saved_at: new Date().toISOString(),
        template: {
          method: templateDefinition.method,
          content_type: templateDefinition.content_type,
          header_templates: templateDefinition.header_templates,
          body_template: templateDefinition.body_template,
          name: webhookTemplate.name,
          description: webhookTemplate.description,
          events: webhookTemplate.events,
          required_variables: webhookTemplate.required_variables,
        },
      },
      ...earlierRevisions,
    ].slice(0, keptRevisionCount),
  );
}

/**
 * Saves an edit as a new revision: the request shape always, the metadata
 * only for custom templates; an edited built-in becomes Modified.
 */
export function saveTemplateVersion(
  webhookTemplate: WebhookTemplateSummary,
  templateUpdate: TemplateUpdate,
) {
  mockDatabase.customTemplateDefinitions.set(webhookTemplate.id, {
    ...findTemplateDefinition(mockDatabase, webhookTemplate.id),
    method: templateUpdate.method,
    content_type: templateUpdate.content_type,
    header_templates: templateUpdate.header_templates,
    body_template: templateUpdate.body_template,
  });
  if (webhookTemplate.source === "custom") {
    webhookTemplate.name = templateUpdate.name?.trim() || webhookTemplate.name;
    webhookTemplate.description =
      templateUpdate.description ?? webhookTemplate.description;
    webhookTemplate.events = templateUpdate.events ?? webhookTemplate.events;
    webhookTemplate.required_variables =
      templateUpdate.required_variables ?? webhookTemplate.required_variables;
  }
  webhookTemplate.revision += 1;
  webhookTemplate.is_modified = webhookTemplate.source === "builtin";
  recordTemplateRevision(webhookTemplate);
}

/** A new custom template at revision 1, with its first revision kept. */
export function createCustomTemplate(
  templateMetadata: TemplateMetadata & { service?: string },
  templateDefinition: TemplateDefinition,
  templateId = buildCustomTemplateId(mockDatabase, templateMetadata.name),
): WebhookTemplateSummary {
  const customTemplate: WebhookTemplateSummary = {
    id: templateId,
    name: templateMetadata.name,
    service: templateMetadata.service ?? "Custom",
    category: "custom",
    source: "custom",
    events: templateMetadata.events,
    description: templateMetadata.description,
    required_variables: templateMetadata.required_variables,
    revision: 1,
    is_modified: false,
  };
  mockDatabase.webhookTemplates.push(customTemplate);
  mockDatabase.customTemplateDefinitions.set(
    customTemplate.id,
    templateDefinition,
  );
  recordTemplateRevision(customTemplate);

  return customTemplate;
}
