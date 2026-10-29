import {
  type SurfaceCatalogue,
  secretRevealExemption,
} from "./surface-definition";

/** Webhook endpoints and rules. */
export const webhookSurfaces: SurfaceCatalogue = {
  "GET /api/v1/webhooks/endpoints": {
    phase: "3",
    cli: "sendmock webhook endpoint list",
    mcp: "sendmock_webhook_endpoint_list",
    ui: "Webhooks > Endpoints",
  },
  "POST /api/v1/webhooks/endpoints": {
    phase: "3",
    cli: "sendmock webhook endpoint create",
    mcp: "sendmock_webhook_endpoint_create",
    ui: "Webhooks > Endpoints > Add endpoint",
  },
  "GET /api/v1/webhooks/endpoints/{endpointId}": {
    phase: "3",
    cli: "sendmock webhook endpoint show <endpointId>",
    mcp: "sendmock_webhook_endpoint_get",
    ui: "Webhooks > Endpoints > Edit",
  },
  "PATCH /api/v1/webhooks/endpoints/{endpointId}": {
    phase: "3",
    cli: "sendmock webhook endpoint update <endpointId>",
    mcp: "sendmock_webhook_endpoint_update",
    ui: "Webhooks > Endpoints > endpoint > Save changes, enabled switch",
  },
  "DELETE /api/v1/webhooks/endpoints/{endpointId}": {
    phase: "3",
    cli: "sendmock webhook endpoint delete <endpointId>",
    mcp: "sendmock_webhook_endpoint_delete",
    ui: "Webhooks > Endpoints > Delete",
  },
  "POST /api/v1/webhooks/endpoints/preview": {
    phase: "3",
    cli: "sendmock webhook render --endpoint <endpointId>",
    mcp: "sendmock_webhook_render",
    ui: "Webhooks > Endpoints > endpoint > Request preview; Send to webhook > Preview",
  },
  "GET /api/v1/webhooks/endpoints/{endpointId}/secret": {
    phase: "3",
    cli: "sendmock webhook endpoint secret <endpointId> --reveal",
    mcp: null,
    mcpExemptReason: secretRevealExemption,
    ui: "Webhooks > Endpoints > endpoint > Security > Reveal",
  },
  "POST /api/v1/webhooks/endpoints/{endpointId}/rotate-secret": {
    phase: "3",
    cli: "sendmock webhook endpoint rotate-secret <endpointId>",
    mcp: "sendmock_webhook_endpoint_rotate_secret",
    ui: "Webhooks > Endpoints > endpoint > Security > Rotate secret",
  },
  "POST /api/v1/webhooks/endpoints/{endpointId}/save-as-template": {
    phase: "3",
    cli: "sendmock webhook endpoint save-as-template <endpointId>",
    mcp: "sendmock_webhook_endpoint_save_as_template",
    ui: "Webhooks > Endpoints > endpoint > Request > Save as template",
  },
  "POST /api/v1/webhooks/endpoints/{endpointId}/send": {
    phase: "3",
    cli: "sendmock webhook send --endpoint <endpointId>",
    mcp: "sendmock_webhook_send",
    ui: "Mail, SMS, HTTP > Send to webhook; Webhooks > Composer > Send",
  },
  "POST /api/v1/webhooks/endpoints/{endpointId}/test": {
    phase: "3",
    cli: "sendmock webhook endpoint test <endpointId>",
    mcp: "sendmock_webhook_endpoint_test",
    ui: "Webhooks > Endpoints > Send test",
  },
  "GET /api/v1/webhooks/rules": {
    phase: "3",
    cli: "sendmock webhook rule list",
    mcp: "sendmock_webhook_rule_list",
    ui: "Webhooks > Rules",
  },
  "POST /api/v1/webhooks/rules": {
    phase: "3",
    cli: "sendmock webhook rule create",
    mcp: "sendmock_webhook_rule_create",
    ui: "Webhooks > Rules > Add rule",
  },
  "GET /api/v1/webhooks/rules/{ruleId}": {
    phase: "3",
    cli: "sendmock webhook rule show <ruleId>",
    mcp: "sendmock_webhook_rule_get",
    ui: "Webhooks > Rules > Edit",
  },
  "PATCH /api/v1/webhooks/rules/{ruleId}": {
    phase: "3",
    cli: "sendmock webhook rule update <ruleId>",
    mcp: "sendmock_webhook_rule_update",
    ui: "Webhooks > Rules > rule > Save changes, enabled switch",
  },
  "DELETE /api/v1/webhooks/rules/{ruleId}": {
    phase: "3",
    cli: "sendmock webhook rule delete <ruleId>",
    mcp: "sendmock_webhook_rule_delete",
    ui: "Webhooks > Rules > Delete",
  },
  "POST /api/v1/webhooks/rules/{ruleId}/move": {
    phase: "3",
    cli: "sendmock webhook rule move <ruleId>",
    mcp: "sendmock_webhook_rule_move",
    ui: "Webhooks > Rules > Move up, Move down",
  },
  "POST /api/v1/webhooks/rules/preview": {
    phase: "3",
    cli: "sendmock webhook rule preview",
    mcp: "sendmock_webhook_rule_preview",
    ui: "Webhooks > Rules > rule sheet > Preview",
  },
};
