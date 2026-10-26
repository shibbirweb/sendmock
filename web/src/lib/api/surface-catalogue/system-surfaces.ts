import type { SurfaceCatalogue } from "./surface-definition";

export const systemSurfaces: SurfaceCatalogue = {
  "GET /api/v1/health": {
    cli: "sendmock health",
    mcp: "sendmock_status",
    ui: "Sidebar > live connection dot",
  },
  "GET /api/v1/info": {
    cli: "sendmock status",
    cliAliases: ["sendmock version"],
    mcp: "sendmock_status",
    ui: "Settings > About",
  },
  "GET /api/v1/stats": {
    cli: "sendmock stats",
    mcp: "sendmock_stats",
    ui: "Overview",
  },
  "GET /api/v1/updates": {
    cli: "sendmock update check",
    mcp: "sendmock_update_check",
    ui: "Settings > About > Check GitHub Releases for updates",
  },
  "GET /api/v1/settings": {
    cli: "sendmock settings get",
    mcp: "sendmock_settings_get",
    ui: "Settings",
  },
  "PATCH /api/v1/settings": {
    cli: "sendmock settings set <key> <value>",
    cliAliases: [
      "sendmock chaos smtp-reject",
      "sendmock chaos smtp-latency",
      "sendmock chaos sms-failure-rate",
      "sendmock chaos clear",
    ],
    mcp: "sendmock_settings_update",
    mcpAliases: ["sendmock_chaos_set"],
    ui: "Settings > Save changes",
  },
  "POST /api/v1/reset": {
    cli: "sendmock reset --yes",
    mcp: "sendmock_reset",
    ui: "Settings > General > Reset to seed",
  },
  "POST /api/v1/samples/{kind}": {
    cli: "sendmock sample <kind>",
    cliAliases: ["sendmock email send-test"],
    mcp: "sendmock_sample_send",
    mcpAliases: ["sendmock_email_send_test"],
    ui: "Empty screens > Send a sample email, SMS, verification or request",
  },
  "GET /api/v1/seed/status": {
    cli: "sendmock seed status",
    mcp: "sendmock_seed_status",
    ui: "Settings > Seed",
  },
  "GET /api/v1/seed/export": {
    cli: "sendmock seed export",
    mcp: "sendmock_seed_export",
    ui: "Settings > Seed > Export sendmock.seed.toml",
  },
  "POST /api/v1/seed/validate": {
    cli: "sendmock seed validate <file>",
    mcp: "sendmock_seed_validate",
    ui: "Settings > Seed > Validate",
  },
  "POST /api/v1/seed/apply": {
    cli: "sendmock seed apply <file>",
    mcp: "sendmock_seed_apply",
    ui: "Settings > Seed > Apply a seed file",
  },
  "GET /api/v1/logs/smtp": {
    cli: "sendmock logs smtp",
    mcp: "sendmock_logs_smtp",
    ui: "Logs > SMTP sessions",
  },
  "GET /api/v1/logs/smtp/{sessionId}": {
    cli: "sendmock logs smtp show <sessionId>",
    mcp: "sendmock_logs_smtp_get",
    ui: "Logs > SMTP sessions > open a session",
  },
  "GET /api/v1/logs/http": {
    cli: "sendmock logs http",
    mcp: "sendmock_logs_http",
    ui: "Logs > API requests",
  },
  "GET /api/v1/logs/http/{requestId}": {
    cli: "sendmock logs http show <requestId>",
    mcp: "sendmock_logs_http_get",
    ui: "Logs > API requests > open a request",
  },
};
