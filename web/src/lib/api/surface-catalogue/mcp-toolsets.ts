/**
 * The MCP toolset each tool belongs to, by name prefix (docs/plan/14-ai-integration.md,
 * MCP server). The first matching prefix wins, so longer prefixes come first.
 */
const toolsetPrefixes: [string, string][] = [
  ["sendmock_webhook_template_", "templates"],
  ["sendmock_webhook_variable_", "variables"],
  ["sendmock_webhook_", "webhooks"],
  ["sendmock_inbound_route_", "rules"],
  ["sendmock_tag_rule_", "rules"],
  ["sendmock_forward_rule_", "rules"],
  ["sendmock_outcome_rule_", "rules"],
  ["sendmock_email_", "email"],
  ["sendmock_sms_", "sms"],
  ["sendmock_messaging_service_", "numbers"],
  ["sendmock_number_", "numbers"],
  ["sendmock_verify_", "verify"],
  ["sendmock_http_", "http"],
  ["sendmock_logs_", "logs"],
  ["sendmock_payment_", "payments"],
  ["sendmock_checkout_", "payments"],
  ["sendmock_otp_", "extract"],
  ["sendmock_links_", "extract"],
  ["sendmock_scenario_", "scenario"],
  ["sendmock_settings_", "admin"],
  ["sendmock_chaos_", "admin"],
  ["sendmock_reset", "admin"],
  ["sendmock_seed_", "admin"],
  ["sendmock_sample_", "admin"],
  ["sendmock_update_", "admin"],
  ["sendmock_", "core"],
];

export function findMcpToolset(toolName: string): string {
  return (
    toolsetPrefixes.find(([prefix]) => toolName.startsWith(prefix))?.[1] ??
    "core"
  );
}
