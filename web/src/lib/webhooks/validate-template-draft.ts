import type { HttpMethod, TemplateDraft } from "@/lib/api/types";

const templateMethods: HttpMethod[] = ["POST", "PUT", "PATCH", "GET"];
const headerNamePattern = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

export type TemplateDraftFieldErrors = Partial<
  Record<keyof TemplateDraft, string>
>;

/**
 * Shape rules for a template edit, shared by the form and the API. Whether
 * it renders (unknown names, unbalanced braces) is checked by rendering it.
 */
export function validateTemplateDraft(
  templateDraft: TemplateDraft,
): TemplateDraftFieldErrors {
  const fieldErrors: TemplateDraftFieldErrors = {};

  if (!templateMethods.includes(templateDraft.method)) {
    fieldErrors.method = "Pick POST, PUT, PATCH or GET";
  }
  if (templateDraft.content_type.trim() === "") {
    fieldErrors.content_type = "Enter a content type, e.g. application/json";
  }
  const invalidHeaderName = Object.keys(templateDraft.header_templates).find(
    (headerName) => !headerNamePattern.test(headerName),
  );
  if (invalidHeaderName !== undefined) {
    fieldErrors.header_templates = `"${invalidHeaderName}" is not a valid header name`;
  }
  if (
    templateDraft.method !== "GET" &&
    templateDraft.body_template.trim() === ""
  ) {
    fieldErrors.body_template =
      "Enter a body, or use GET for a request without one";
  }

  return fieldErrors;
}
