import type { TemplateDefinition } from "@/mocks/fixtures/template-definitions";

/**
 * A template with an endpoint's extra headers and body fields written into
 * it, for "Save as template": JSON bodies gain the fields before the last
 * `}`, form bodies gain `&name=value` pairs.
 */
export function foldEndpointOverrides(
  templateDefinition: TemplateDefinition,
  extraHeaders: Record<string, string>,
  extraFields: Record<string, string>,
): TemplateDefinition {
  const fieldEntries = Object.entries(extraFields);
  let bodyTemplate = templateDefinition.body_template;
  if (
    fieldEntries.length > 0 &&
    templateDefinition.content_type.includes("json")
  ) {
    const closingBraceIndex = bodyTemplate.lastIndexOf("}");
    const addedFieldsText = fieldEntries
      .map(
        ([fieldName, fieldValue]) =>
          `  ${JSON.stringify(fieldName)}: ${JSON.stringify(fieldValue)}`,
      )
      .join(",\n");
    if (closingBraceIndex !== -1) {
      const bodyBeforeBrace = bodyTemplate
        .slice(0, closingBraceIndex)
        .trimEnd();
      bodyTemplate = `${bodyBeforeBrace},\n${addedFieldsText}\n${bodyTemplate.slice(closingBraceIndex)}`;
    }
  } else if (fieldEntries.length > 0) {
    const addedPairs = fieldEntries
      .map(
        ([fieldName, fieldValue]) =>
          `${encodeURIComponent(fieldName)}=${fieldValue}`,
      )
      .join("&");
    bodyTemplate = `${bodyTemplate}&${addedPairs}`;
  }

  return {
    ...templateDefinition,
    header_templates: {
      ...templateDefinition.header_templates,
      ...extraHeaders,
    },
    body_template: bodyTemplate,
  };
}
