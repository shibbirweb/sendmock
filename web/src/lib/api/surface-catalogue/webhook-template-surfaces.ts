import { type SurfaceCatalogue } from "./surface-definition";

/** Webhook templates and variables. */
export const webhookTemplateSurfaces: SurfaceCatalogue = {
  "GET /api/v1/webhooks/templates": {
    phase: "3",
    cli: "sendmock webhook template list",
    mcp: "sendmock_webhook_template_list",
    ui: "Webhooks > Templates",
  },
  "POST /api/v1/webhooks/templates": {
    phase: "3",
    cli: "sendmock webhook template create",
    mcp: "sendmock_webhook_template_create",
    ui: "Webhooks > Templates > New template",
  },
  "GET /api/v1/webhooks/templates/{templateId}": {
    phase: "3",
    cli: "sendmock webhook template show <templateId>",
    mcp: "sendmock_webhook_template_get",
    ui: "Webhooks > Templates > open a template",
  },
  "PATCH /api/v1/webhooks/templates/{templateId}": {
    phase: "3",
    cli: "sendmock webhook template update <templateId>",
    mcp: "sendmock_webhook_template_update",
    ui: "Webhooks > Templates > template > Edit, Save template",
  },
  "DELETE /api/v1/webhooks/templates/{templateId}": {
    phase: "3",
    cli: "sendmock webhook template delete <templateId>",
    mcp: "sendmock_webhook_template_delete",
    ui: "Webhooks > Templates > template > Delete",
  },
  "POST /api/v1/webhooks/templates/import": {
    phase: "3",
    cli: "sendmock webhook template import <file>",
    mcp: "sendmock_webhook_template_import",
    ui: "Webhooks > Templates > Import a template",
    cliArguments: { file: "file_text" },
  },
  "GET /api/v1/webhooks/templates/{templateId}/export": {
    phase: "3",
    cli: "sendmock webhook template export <templateId>",
    mcp: "sendmock_webhook_template_export",
    ui: "Webhooks > Templates > template > Export",
  },
  "GET /api/v1/webhooks/templates/{templateId}/revisions": {
    phase: "3",
    cli: "sendmock webhook template history <templateId>",
    mcp: "sendmock_webhook_template_revisions",
    ui: "Webhooks > Templates > template > History",
  },
  "POST /api/v1/webhooks/templates/{templateId}/revisions/{revision}/restore": {
    phase: "3",
    cli: "sendmock webhook template restore <templateId> <revision>",
    mcp: "sendmock_webhook_template_restore",
    ui: "Webhooks > Templates > template > History > Restore",
  },
  "POST /api/v1/webhooks/templates/{templateId}/render": {
    phase: "3",
    cli: "sendmock webhook template render <templateId>",
    mcp: "sendmock_webhook_template_render",
    ui: "Webhooks > Templates > template > Preview",
  },
  "POST /api/v1/webhooks/templates/{templateId}/reset": {
    phase: "3",
    cli: "sendmock webhook template reset <templateId>",
    mcp: "sendmock_webhook_template_reset",
    ui: "Webhooks > Templates > template > Reset to default",
  },
  "POST /api/v1/webhooks/templates/{templateId}/clone": {
    phase: "3",
    cli: "sendmock webhook template clone <templateId>",
    mcp: "sendmock_webhook_template_clone",
    ui: "Webhooks > Templates > template > Clone",
  },
  "GET /api/v1/webhooks/template-reference": {
    phase: "3",
    cli: "sendmock webhook template reference",
    mcp: "sendmock_webhook_template_reference",
    ui: "Webhooks > Templates > template editor > reference panel",
  },
  "GET /api/v1/webhooks/variables": {
    phase: "3",
    cli: "sendmock webhook var list",
    mcp: "sendmock_webhook_variable_list",
    ui: "Webhooks > Variables",
  },
  "POST /api/v1/webhooks/variables": {
    phase: "3",
    cli: "sendmock webhook var set <name> <value>",
    mcp: "sendmock_webhook_variable_set",
    ui: "Webhooks > Variables > Add variable",
  },
  "PATCH /api/v1/webhooks/variables/{variableId}": {
    phase: "3",
    cli: "sendmock webhook var update <variableId>",
    mcp: "sendmock_webhook_variable_update",
    ui: "Webhooks > Variables > Edit",
  },
  "DELETE /api/v1/webhooks/variables/{variableId}": {
    phase: "3",
    cli: "sendmock webhook var unset <variableId>",
    mcp: "sendmock_webhook_variable_unset",
    ui: "Webhooks > Variables > Delete",
  },
  "POST /api/v1/webhooks/variables/{variableId}/regenerate": {
    phase: "3",
    cli: "sendmock webhook var regenerate <variableId>",
    mcp: "sendmock_webhook_variable_regenerate",
    ui: "Webhooks > Variables > Regenerate",
  },
  "POST /api/v1/webhooks/variables/preview": {
    phase: "3",
    cli: "sendmock webhook var preview",
    mcp: "sendmock_webhook_variable_preview",
    ui: "Webhooks > Variables > variable sheet > Resolves to",
  },
};
