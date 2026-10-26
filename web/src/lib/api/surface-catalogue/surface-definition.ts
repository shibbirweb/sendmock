/**
 * The other three ways to reach a REST operation (docs/plan/20-surface-parity.md,
 * UI-11). Keyed by `METHOD /api/v1/path`, as in the endpoint registry. No path
 * aliases, so the OpenAPI build script can read it.
 */

export type OperationSurfaces = {
  /** The CLI command with its positional arguments, e.g. `sendmock email reply <emailId>`. */
  cli: string;
  /** Other commands that run the same operation, e.g. `sendmock chaos smtp-reject`. */
  cliAliases?: string[];
  /** The MCP tool, or an MCP resource (`sendmock://...`); null only with a reason. */
  mcp: string | null;
  /** Why there is no MCP tool; only for revealing secrets. */
  mcpExemptReason?: string;
  /** Other tools that run the same operation, e.g. `sendmock_chaos_set`. */
  mcpAliases?: string[];
  /** Where it lives in the UI, as the path a user clicks. */
  ui: string;
};

/** `METHOD /api/v1/path` to its surfaces. */
export type SurfaceCatalogue = Record<string, OperationSurfaces>;

/** Agents may set a secret but never read one back (docs/plan/14-ai-integration.md). */
export const secretRevealExemption =
  "Agents may set secrets but never read them back; the CLI and UI reveal them after a confirmation.";
