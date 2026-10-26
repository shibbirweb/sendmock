import { type SurfaceCatalogue } from "./surface-definition";

/** Test helpers, events, integrations, scenarios and AI agent setup. */
export const testHelperSurfaces: SurfaceCatalogue = {
  "GET /api/v1/wait/email": {
    cli: "sendmock email wait",
    mcp: "sendmock_email_wait",
    ui: "Mail (new emails appear live)",
  },
  "GET /api/v1/wait/sms": {
    cli: "sendmock sms wait",
    mcp: "sendmock_sms_wait",
    ui: "SMS (new messages appear live)",
  },
  "GET /api/v1/wait/http": {
    cli: "sendmock http wait",
    mcp: "sendmock_http_wait",
    ui: "HTTP (new requests appear live)",
  },
  "GET /api/v1/wait/webhook": {
    cli: "sendmock webhook deliveries wait",
    mcp: "sendmock_webhook_delivery_wait",
    ui: "Webhooks > Deliveries (new deliveries appear live)",
  },
  "GET /api/v1/wait/payment": {
    cli: "sendmock payments wait",
    mcp: "sendmock_payment_wait",
    ui: "Payments (new and changed payments appear live)",
  },
  "GET /api/v1/otp": {
    cli: "sendmock otp --to <recipient>",
    mcp: "sendmock_otp_get",
    ui: "Mail, SMS and Verify: the code beside each message",
    cliFlags: { timeout: "--wait" },
  },
  "GET /api/v1/links": {
    cli: "sendmock links --to <recipient>",
    mcp: "sendmock_links_get",
    ui: "Mail > open email > links panel",
    cliFlags: { timeout: "--wait" },
  },
  "GET /api/v1/events/recent": {
    cli: "sendmock events tail",
    cliAliases: ["sendmock http tail", "sendmock webhook tail"],
    mcp: "sendmock_events_recent",
    ui: "Notification bell",
  },
  "GET /api/v1/integrations/{stack}": {
    cli: "sendmock integrate <stack>",
    mcp: "sendmock_integration_snippet",
    ui: "Settings > Connection",
  },
  "POST /api/v1/scenarios/validate": {
    cli: "sendmock scenario validate <file>",
    mcp: "sendmock_scenario_validate",
    ui: "Scenarios > Validate",
    cliArguments: { file: "scenario" },
  },
  "POST /api/v1/scenarios/run": {
    cli: "sendmock scenario run <file>",
    mcp: "sendmock_scenario_run",
    ui: "Scenarios > Run",
    cliArguments: { file: "scenario" },
  },
  "GET /api/v1/ai/agents": {
    cli: "sendmock ai install --target <agent>",
    mcp: "sendmock_ai_agents",
    ui: "Settings > Connection > AI agents",
  },
  "GET /api/v1/ai/skill": {
    cli: "sendmock ai skill",
    mcp: "sendmock://docs/skill",
    ui: "Settings > Connection > AI agents > Download the skill",
  },
};
