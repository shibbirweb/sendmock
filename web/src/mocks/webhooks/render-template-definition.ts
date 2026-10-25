import type { TemplateDraft } from "@/lib/api/types";
import {
  renderTemplateText,
  type TemplateContext,
} from "@/mocks/webhooks/render-template-text";

export type RenderedTemplate = {
  headers: Record<string, string>;
  body: string;
  warnings: string[];
  errors: string[];
};

/** Renders a template's headers and body, collecting warnings and errors from both. */
export function renderTemplateDefinition(
  templateDraft: TemplateDraft,
  templateContext: TemplateContext,
): RenderedTemplate {
  const warnings: string[] = [];
  const errors: string[] = [];
  const renderedHeaders = Object.fromEntries([
    ["content-type", templateDraft.content_type],
    ...Object.entries(templateDraft.header_templates).map(
      ([headerName, headerTemplate]) => {
        const renderedHeader = renderTemplateText(
          headerTemplate,
          templateContext,
        );
        warnings.push(...renderedHeader.warnings);
        errors.push(...renderedHeader.errors);
        return [headerName, renderedHeader.renderedText];
      },
    ),
  ]) as Record<string, string>;
  const renderedBody = renderTemplateText(
    templateDraft.body_template,
    templateContext,
  );

  return {
    headers: renderedHeaders,
    body: renderedBody.renderedText,
    warnings: [...new Set([...warnings, ...renderedBody.warnings])],
    errors: [...new Set([...errors, ...renderedBody.errors])],
  };
}
