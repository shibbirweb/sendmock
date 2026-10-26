import type { SurfaceCatalogue } from "./surface-definition";

export const emailSurfaces: SurfaceCatalogue = {
  "GET /api/v1/emails": {
    cli: "sendmock email list",
    mcp: "sendmock_email_list",
    mcpAliases: ["sendmock_email_search"],
    ui: "Mail",
  },
  "DELETE /api/v1/emails": {
    cli: "sendmock email delete-all --yes",
    mcp: "sendmock_email_delete_all",
    ui: "Mail > Delete all",
  },
  "GET /api/v1/emails/latest": {
    cli: "sendmock email latest --to <address>",
    mcp: "sendmock_email_latest",
    ui: "Mail > search to:",
  },
  "GET /api/v1/emails/{emailId}": {
    cli: "sendmock email show <emailId>",
    cliAliases: ["sendmock email html <emailId>"],
    mcp: "sendmock_email_get",
    ui: "Mail > open email",
  },
  "PATCH /api/v1/emails/{emailId}": {
    cli: "sendmock email update <emailId>",
    cliAliases: ["sendmock email tag <emailId>"],
    mcp: "sendmock_email_update",
    mcpAliases: ["sendmock_email_tag"],
    ui: "Mail > open email > Mark as read, tags",
  },
  "DELETE /api/v1/emails/{emailId}": {
    cli: "sendmock email delete <emailId>",
    mcp: "sendmock_email_delete",
    ui: "Mail > open email > Delete",
  },
  "GET /api/v1/emails/{emailId}/timeline": {
    cli: "sendmock email timeline <emailId>",
    mcp: "sendmock_email_timeline",
    ui: "Mail > open email > Timeline",
  },
  "GET /api/v1/emails/{emailId}/html-check": {
    cli: "sendmock email check <emailId> html",
    mcp: "sendmock_email_check",
    ui: "Mail > open email > Checks",
  },
  "GET /api/v1/emails/{emailId}/list-unsubscribe": {
    cli: "sendmock email check <emailId> unsubscribe",
    mcp: "sendmock_email_check",
    ui: "Mail > open email > Headers",
  },
  "GET /api/v1/emails/{emailId}/mime": {
    cli: "sendmock email mime <emailId>",
    mcp: "sendmock_email_mime",
    ui: "Mail > open email > MIME",
  },
  "GET /api/v1/emails/{emailId}/raw": {
    cli: "sendmock email raw <emailId>",
    mcp: "sendmock://emails/{emailId}/raw",
    ui: "Mail > open email > Source, download .eml",
  },
  "GET /api/v1/emails/{emailId}/attachments/{attachmentIndex}": {
    cli: "sendmock email attachments <emailId> <attachmentIndex>",
    mcp: "sendmock://emails/{emailId}/attachments/{attachmentIndex}",
    ui: "Mail > open email > Attachments",
  },
  "GET /api/v1/emails/{emailId}/parts/{attachmentIndex}/thumbnail": {
    cli: "sendmock email thumbnail <emailId> <attachmentIndex>",
    mcp: "sendmock://emails/{emailId}/parts/{attachmentIndex}/thumbnail",
    ui: "Mail > open email > Attachments (thumbnails)",
  },
  "POST /api/v1/emails/{emailId}/link-check": {
    cli: "sendmock email check <emailId> links",
    mcp: "sendmock_email_check",
    ui: "Mail > open email > Checks",
  },
  "POST /api/v1/emails/{emailId}/spam-check": {
    cli: "sendmock email check <emailId> spam",
    mcp: "sendmock_email_check",
    ui: "Mail > open email > Checks",
  },
  "POST /api/v1/emails/{emailId}/open": {
    cli: "sendmock email open <emailId>",
    mcp: "sendmock_email_open",
    ui: "Mail > open email (opening it fires the open)",
  },
  "POST /api/v1/emails/{emailId}/release": {
    cli: "sendmock email release <emailId>",
    mcp: "sendmock_email_release",
    ui: "Mail > open email > Release to real SMTP",
  },
  "POST /api/v1/emails/{emailId}/simulate": {
    cli: "sendmock email simulate <emailId> <event>",
    mcp: "sendmock_email_simulate",
    ui: "Mail > open email > Simulate",
  },
  "POST /api/v1/emails/{emailId}/reply": {
    cli: "sendmock email reply <emailId>",
    mcp: "sendmock_email_reply",
    ui: "Mail > open email > Reply, Reply all",
  },
  "POST /api/v1/emails/{emailId}/forward": {
    cli: "sendmock email forward <emailId>",
    mcp: "sendmock_email_forward",
    ui: "Mail > open email > Forward",
  },
  "POST /api/v1/emails/inbound": {
    cli: "sendmock email inbound",
    mcp: "sendmock_email_inbound",
    ui: "Mail > Import .eml > Incoming to your app",
  },
  "POST /api/v1/send": {
    cli: "sendmock email send",
    mcp: "sendmock_email_send",
    ui: "Settings > Connection > Send this request",
  },
  "POST /api/v1/send/raw": {
    cli: "sendmock sendmail",
    mcp: "sendmock_email_send_raw",
    ui: "Mail > Import .eml > Sent by your app",
  },
  "GET /api/v1/inbound-routes": {
    cli: "sendmock route list",
    mcp: "sendmock_inbound_route_list",
    ui: "Webhooks > Inbound routes",
  },
  "POST /api/v1/inbound-routes": {
    cli: "sendmock route create",
    mcp: "sendmock_inbound_route_create",
    ui: "Webhooks > Inbound routes > Add route",
  },
  "PATCH /api/v1/inbound-routes/{routeId}": {
    cli: "sendmock route update <routeId>",
    mcp: "sendmock_inbound_route_update",
    ui: "Webhooks > Inbound routes > Edit, move",
  },
  "DELETE /api/v1/inbound-routes/{routeId}": {
    cli: "sendmock route delete <routeId>",
    mcp: "sendmock_inbound_route_delete",
    ui: "Webhooks > Inbound routes > Delete",
  },
  "POST /api/v1/inbound-routes/test": {
    cli: "sendmock route test",
    mcp: "sendmock_inbound_route_test",
    ui: "Webhooks > Inbound routes > route sheet > Preview",
  },
};
