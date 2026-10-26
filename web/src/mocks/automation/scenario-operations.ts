import { apiEndpoints } from "@/lib/api/endpoint-registry";
import { surfaceCatalogue } from "@/lib/api/surface-catalogue";

export type ScenarioOperation = { method: string; path: string };

/** `sendmock_webhook_endpoint_create` is the step `webhook.endpoint.create`. */
export function toScenarioStepName(mcpToolName: string): string {
  return mcpToolName.replace(/^sendmock_/, "").replaceAll("_", ".");
}

/** Every step name a scenario may run, from the MCP tools in the surface catalogue. */
function buildScenarioOperations(): Map<string, ScenarioOperation> {
  const scenarioOperations = new Map<string, ScenarioOperation>();
  for (const apiEndpoint of apiEndpoints) {
    const operationSurfaces =
      surfaceCatalogue[`${apiEndpoint.method} ${apiEndpoint.path}`];
    const toolNames = [
      operationSurfaces?.mcp ?? "",
      ...(operationSurfaces?.mcpAliases ?? []),
    ].filter((toolName) => toolName.startsWith("sendmock_"));
    for (const toolName of toolNames) {
      const stepName = toScenarioStepName(toolName);
      if (!scenarioOperations.has(stepName)) {
        scenarioOperations.set(stepName, {
          method: apiEndpoint.method,
          path: apiEndpoint.path,
        });
      }
    }
  }

  return scenarioOperations;
}

export const scenarioOperations = buildScenarioOperations();

/** Steps that are not API operations. */
export const scenarioBuiltinSteps = ["http", "assert", "sleep"] as const;
