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
  /**
   * Picks this operation when several share one CLI command or MCP tool:
   * an extra input with a fixed value, or whether an input is given
   * (docs/plan/21-reference-and-examples.md).
   */
  selector?: OperationSelector;
  /** CLI placeholders that name another input, e.g. `{ status: "state" }`; `<file>` reads a file into its input. */
  cliArguments?: Record<string, string>;
  /** Flags the naming rules get wrong, by input, e.g. `{ timeout: "--wait" }`. */
  cliFlags?: Record<string, string>;
};

export type OperationSelector =
  { input: string; value: string } | { input: string; isGiven: boolean };

/** `METHOD /api/v1/path` to its surfaces. */
export type SurfaceCatalogue = Record<string, OperationSurfaces>;

/** Agents may set a secret but never read one back (docs/plan/14-ai-integration.md). */
export const secretRevealExemption =
  "Agents may set secrets but never read them back; the CLI and UI reveal them after a confirmation.";
