import type { RenderProblem, TemplateDraft } from "@/lib/api/types";
import {
  type LocatedProblem,
  renderTemplateText,
  type TemplateContext,
} from "@/mocks/webhooks/render-template-text";

export type RenderedTemplate = {
  headers: Record<string, string>;
  body: string;
  warnings: string[];
  errors: string[];
  problems: RenderProblem[];
};

/** Located problems of one part, tagged with where they come from (WH-07.15). */
export function toRenderProblems(
  locatedProblems: LocatedProblem[],
  source: string,
): RenderProblem[] {
  return locatedProblems.map((locatedProblem) => ({
    ...locatedProblem,
    source,
  }));
}

/** Renders a template's headers and body, collecting warnings and errors from both. */
export function renderTemplateDefinition(
  templateDraft: TemplateDraft,
  templateContext: TemplateContext,
): RenderedTemplate {
  const problems: RenderProblem[] = [];
  const renderedHeaders = Object.fromEntries([
    ["content-type", templateDraft.content_type],
    ...Object.entries(templateDraft.header_templates).map(
      ([headerName, headerTemplate], headerIndex) => {
        const renderedHeader = renderTemplateText(
          headerTemplate,
          templateContext,
        );
        problems.push(
          ...toRenderProblems(
            renderedHeader.locatedProblems,
            `header.${headerIndex}`,
          ),
        );
        return [headerName, renderedHeader.renderedText];
      },
    ),
  ]) as Record<string, string>;
  const renderedBody = renderTemplateText(
    templateDraft.body_template,
    templateContext,
  );
  problems.push(...toRenderProblems(renderedBody.locatedProblems, "body"));

  return {
    headers: renderedHeaders,
    body: renderedBody.renderedText,
    warnings: [
      ...new Set(
        problems
          .filter((problem) => problem.severity === "warning")
          .map((problem) => problem.message),
      ),
    ],
    errors: [
      ...new Set(
        problems
          .filter((problem) => problem.severity === "error")
          .map((problem) => problem.message),
      ),
    ],
    problems,
  };
}
