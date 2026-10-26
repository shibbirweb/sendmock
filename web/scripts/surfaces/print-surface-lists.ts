/**
 * Prints the CLI command tree and the MCP toolset table from the surface
 * catalogue, for docs/plan/14-ai-integration.md (docs/plan/20-surface-parity.md).
 *
 *     bun scripts/surfaces/print-surface-lists.ts
 */
import { apiEndpoints } from "../../src/lib/api/endpoint-registry";
import { surfaceCatalogue } from "../../src/lib/api/surface-catalogue";
import { findMcpToolset } from "../../src/lib/api/surface-catalogue/mcp-toolsets";

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
    const toolset = findMcpToolset(toolName);
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
