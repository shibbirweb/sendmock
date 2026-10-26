import {
  type SurfaceCatalogue,
  secretRevealExemption,
} from "./surface-definition";

/** Payments, the test checkout page, and gateway, method and flow definitions. */
export const paymentSurfaces: SurfaceCatalogue = {
  "GET /api/v1/payments": {
    cli: "sendmock payments list",
    mcp: "sendmock_payment_list",
    ui: "Payments",
  },
  "GET /api/v1/payments/test-cards": {
    cli: "sendmock payments test-cards",
    mcp: "sendmock_payment_test_cards",
    ui: "Settings > Payments > Test values",
  },
  "GET /api/v1/payments/{paymentId}": {
    cli: "sendmock payments show <paymentId>",
    mcp: "sendmock_payment_get",
    ui: "Payments > open payment",
  },
  "POST /api/v1/payments/{paymentId}/notify": {
    cli: "sendmock payments notify <paymentId>",
    mcp: "sendmock_payment_notify",
    ui: "Payments > payment > Resend notification",
  },
  "POST /api/v1/payments/{paymentId}/simulate": {
    cli: "sendmock payments simulate <paymentId> <action>",
    mcp: "sendmock_payment_simulate",
    ui: "Payments > payment > Simulate",
  },
  "POST /api/v1/payments/checkout": {
    cli: "sendmock payments checkout create",
    mcp: "sendmock_payment_create_checkout",
    ui: "Payments > Gateways > gateway > Checkout > Open a test checkout",
  },
  "GET /api/v1/checkout-sessions/{sessionId}": {
    cli: "sendmock payments checkout show <sessionId>",
    mcp: "sendmock_checkout_get",
    ui: "Test checkout page",
  },
  "POST /api/v1/checkout-sessions/{sessionId}/complete": {
    cli: "sendmock payments checkout complete <sessionId> <action>",
    mcp: "sendmock_checkout_complete",
    ui: "Test checkout page > pay, Test controls",
  },
  "GET /api/v1/payments/flows": {
    cli: "sendmock payments flows list",
    mcp: "sendmock_payment_flow_list",
    ui: "Payments > Flows",
  },
  "POST /api/v1/payments/flows": {
    cli: "sendmock payments flows create",
    mcp: "sendmock_payment_flow_create",
    ui: "Payments > Flows > Add flow",
  },
  "GET /api/v1/payments/flows/{flowKey}": {
    cli: "sendmock payments flows show <flowKey>",
    mcp: "sendmock_payment_flow_get",
    ui: "Payments > Flows > Edit",
  },
  "PATCH /api/v1/payments/flows/{flowKey}": {
    cli: "sendmock payments flows update <flowKey>",
    mcp: "sendmock_payment_flow_update",
    ui: "Payments > Flows > flow > Save flow",
  },
  "DELETE /api/v1/payments/flows/{flowKey}": {
    cli: "sendmock payments flows delete <flowKey>",
    mcp: "sendmock_payment_flow_delete",
    ui: "Payments > Flows > flow > Delete",
  },
  "POST /api/v1/payments/flows/{flowKey}/reset": {
    cli: "sendmock payments flows reset <flowKey>",
    mcp: "sendmock_payment_flow_reset",
    ui: "Payments > Flows > flow > Reset to default",
  },
  "POST /api/v1/payments/flows/{flowKey}/steps": {
    cli: "sendmock payments flows steps add <flowKey>",
    mcp: "sendmock_payment_flow_step_add",
    ui: "Payments > Flows > flow > Add step",
  },
  "PATCH /api/v1/payments/flows/{flowKey}/steps/{stepIndex}": {
    cli: "sendmock payments flows steps update <flowKey> <stepIndex>",
    cliAliases: ["sendmock payments flows steps move <flowKey> <stepIndex>"],
    mcp: "sendmock_payment_flow_step_update",
    mcpAliases: ["sendmock_payment_flow_step_move"],
    ui: "Payments > Flows > flow > step labels, Move up, Move down",
  },
  "DELETE /api/v1/payments/flows/{flowKey}/steps/{stepIndex}": {
    cli: "sendmock payments flows steps remove <flowKey> <stepIndex>",
    mcp: "sendmock_payment_flow_step_remove",
    ui: "Payments > Flows > flow > Remove step",
  },
  "GET /api/v1/payments/step-types": {
    cli: "sendmock payments flows step-types",
    mcp: "sendmock_payment_step_type_list",
    ui: "Payments > Flows > flow > Add step menu",
  },
  "GET /api/v1/payments/flow-variables": {
    cli: "sendmock payments flows variables",
    mcp: "sendmock_payment_flow_variable_list",
    ui: "Payments > Flows > flow > Label variables",
  },
  "GET /api/v1/payments/gateways": {
    cli: "sendmock payments gateways list",
    mcp: "sendmock_payment_gateway_list",
    ui: "Payments > Gateways",
  },
  "POST /api/v1/payments/gateways": {
    cli: "sendmock payments gateways create",
    mcp: "sendmock_payment_gateway_create",
    ui: "Payments > Gateways > Add gateway",
  },
  "GET /api/v1/payments/gateways/{gatewayKey}": {
    cli: "sendmock payments gateways show <gatewayKey>",
    mcp: "sendmock_payment_gateway_get",
    ui: "Payments > Gateways > Edit",
  },
  "PATCH /api/v1/payments/gateways/{gatewayKey}": {
    cli: "sendmock payments gateways update <gatewayKey>",
    mcp: "sendmock_payment_gateway_update",
    ui: "Payments > Gateways > gateway > Save gateway",
  },
  "DELETE /api/v1/payments/gateways/{gatewayKey}": {
    cli: "sendmock payments gateways delete <gatewayKey>",
    mcp: "sendmock_payment_gateway_delete",
    ui: "Payments > Gateways > gateway > Delete",
  },
  "POST /api/v1/payments/gateways/{gatewayKey}/reset": {
    cli: "sendmock payments gateways reset <gatewayKey>",
    mcp: "sendmock_payment_gateway_reset",
    ui: "Payments > Gateways > gateway > Reset to default",
  },
  "POST /api/v1/payments/gateways/{gatewayKey}/preview": {
    cli: "sendmock payments gateways preview <gatewayKey>",
    mcp: "sendmock_payment_gateway_preview",
    ui: "Payments > Gateways > gateway > Redirect, Notification preview",
  },
  "GET /api/v1/payments/gateways/{gatewayKey}/credentials/{credentialName}": {
    cli: "sendmock payments gateways credential <gatewayKey> <credentialName> --reveal",
    mcp: null,
    mcpExemptReason: secretRevealExemption,
    ui: "Payments > Gateways > gateway > Merchant > Reveal",
  },
  "GET /api/v1/payments/methods": {
    cli: "sendmock payments methods list",
    mcp: "sendmock_payment_method_list",
    ui: "Payments > Methods",
  },
  "POST /api/v1/payments/methods": {
    cli: "sendmock payments methods create",
    mcp: "sendmock_payment_method_create",
    ui: "Payments > Methods > Add method",
  },
  "GET /api/v1/payments/methods/{methodKey}": {
    cli: "sendmock payments methods show <methodKey>",
    mcp: "sendmock_payment_method_get",
    ui: "Payments > Methods > Edit",
  },
  "PATCH /api/v1/payments/methods/{methodKey}": {
    cli: "sendmock payments methods update <methodKey>",
    mcp: "sendmock_payment_method_update",
    ui: "Payments > Methods > method > Save method, enabled switch",
  },
  "DELETE /api/v1/payments/methods/{methodKey}": {
    cli: "sendmock payments methods delete <methodKey>",
    mcp: "sendmock_payment_method_delete",
    ui: "Payments > Methods > method > Delete",
  },
  "POST /api/v1/payments/methods/{methodKey}/reset": {
    cli: "sendmock payments methods reset <methodKey>",
    mcp: "sendmock_payment_method_reset",
    ui: "Payments > Methods > method > Reset to default",
  },
};
