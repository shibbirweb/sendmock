import {
  loadCliReference,
  loadMcpReference,
  toApiOperationUrl,
  toCliCommandUrl,
  toMcpToolUrl,
} from "@/lib/reference/load-references";
import type { ReferencedOperation } from "@/lib/reference/reference-types";

/** The same action from the REST API, the CLI and MCP, as Markdown links. */
export type OperationSurfaces = {
  rest: string;
  cli: string | null;
  mcp: string | null;
};

/** Every operation with its surfaces, from the generated CLI and MCP references. */
export function indexOperationSurfaces(): Map<string, OperationSurfaces> {
  const surfacesById = new Map<string, OperationSurfaces>();
  const readSurfaces = (operation: ReferencedOperation): OperationSurfaces =>
    surfacesById.get(operation.operation_id) ?? {
      rest: `[\`${operation.method} ${operation.path}\`](${toApiOperationUrl(operation)})`,
      cli: null,
      mcp: null,
    };
  for (const cliCommand of loadCliReference().commands) {
    for (const operation of cliCommand.operations) {
      surfacesById.set(operation.operation_id, {
        ...readSurfaces(operation),
        cli: `[\`${cliCommand.command}\`](${toCliCommandUrl(cliCommand)})`,
      });
    }
  }
  for (const mcpTool of loadMcpReference().tools) {
    for (const operation of mcpTool.operations) {
      surfacesById.set(operation.operation_id, {
        ...readSurfaces(operation),
        mcp: `[\`${mcpTool.name}\`](${toMcpToolUrl(mcpTool)})`,
      });
    }
  }
  return surfacesById;
}
