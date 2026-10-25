import type { WebhookTemplateDetail } from "@/lib/api/types";

function quoteToml(text: string): string {
  return JSON.stringify(text);
}

/** A multi-line TOML literal; the body is kept exactly as written. */
function toMultilineLiteral(text: string): string {
  return `'''\n${text}\n'''`;
}

/**
 * `<id>.sendmock-template.toml`: the template's request shape and the names
 * of the variables it needs, never their values (WH-09.3).
 */
export function exportTemplateToml(
  webhookTemplate: WebhookTemplateDetail,
): string {
  const headerLines = Object.entries(webhookTemplate.header_templates).map(
    ([headerName, headerTemplate]) =>
      `${quoteToml(headerName)} = ${quoteToml(headerTemplate)}`,
  );

  return [
    `# SendMock webhook template, exported from Webhooks > Templates.`,
    `id = ${quoteToml(webhookTemplate.id)}`,
    `name = ${quoteToml(webhookTemplate.name)}`,
    `service = ${quoteToml(webhookTemplate.service)}`,
    `events = [${webhookTemplate.events.map(quoteToml).join(", ")}]`,
    `variables = [${webhookTemplate.required_variables.map(quoteToml).join(", ")}]`,
    "",
    "[request]",
    `method = ${quoteToml(webhookTemplate.method)}`,
    `content_type = ${quoteToml(webhookTemplate.content_type)}`,
    `body = ${toMultilineLiteral(webhookTemplate.body_template)}`,
    "",
    "[request.headers]",
    ...headerLines,
    "",
  ].join("\n");
}
