/**
 * Prints the CLI command tree and the MCP toolset table from the surface
 * catalogue, for docs/plan/14-ai-integration.md (docs/plan/20-surface-parity.md).
 *
 *     bun scripts/surfaces/print-surface-lists.ts
 */
import { apiEndpoints } from "../../src/lib/api/endpoint-registry";
import { surfaceCatalogue } from "../../src/lib/api/surface-catalogue";

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

const operations = apiEndpoints.map(
  (apiEndpoint) =>
    surfaceCatalogue[`${apiEndpoint.method} ${apiEndpoint.path}`],
);
const cliCommands = new Set<string>();
const toolsByToolset = new Map<string, Set<string>>();
const resources = new Set<string>();
for (const operationSurfaces of operations) {
  if (operationSurfaces === undefined) {
    continue;
  }
  for (const cliCommand of [
    operationSurfaces.cli,
    ...(operationSurfaces.cliAliases ?? []),
  ]) {
    cliCommands.add(cliCommand);
  }
  for (const toolName of [
    operationSurfaces.mcp,
    ...(operationSurfaces.mcpAliases ?? []),
  ]) {
    if (toolName === null) {
      continue;
    }
    if (toolName.startsWith("sendmock://")) {
      resources.add(toolName);
      continue;
    }
    const toolset =
      toolsetPrefixes.find(([prefix]) => toolName.startsWith(prefix))?.[1] ??
      "core";
    toolsByToolset.set(
      toolset,
      (toolsByToolset.get(toolset) ?? new Set()).add(toolName),
    );
  }
}

console.log("```");
console.log(
  "sendmock serve                                   # run the servers",
);
console.log(
  "sendmock mcp [--toolsets ...] [--read-only]      # MCP server over stdio",
);
for (const cliCommand of [...cliCommands].sort()) {
  console.log(cliCommand);
}
console.log("```\n");
console.log("| Toolset | Tools |\n|---------|-------|");
for (const [toolset, toolNames] of [...toolsByToolset].sort()) {
  console.log(
    `| \`${toolset}\` | ${[...toolNames]
      .sort()
      .map((toolName) => `\`${toolName}\``)
      .join(", ")} |`,
  );
}
console.log(
  `\nResources: ${[...resources]
    .sort()
    .map((resource) => `\`${resource}\``)
    .join(", ")}`,
);
