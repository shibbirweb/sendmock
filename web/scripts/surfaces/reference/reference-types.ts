/**
 * The shapes of docs/api/cli-reference.json and docs/api/mcp-tools.json
 * (docs/plan/21-reference-and-examples.md). Keys are snake_case, like the API.
 */
import type { OperationSelector } from "../../../src/lib/api/surface-catalogue/surface-definition";
import type { InputLocation, SpecSchema } from "./spec-reader";

/** The operation an entry runs, and what picks it when several share the entry. */
export type ReferencedOperation = {
  method: string;
  path: string;
  operation_id: string;
  summary: string;
  /** The API reference page it is on, e.g. `email`. */
  area_slug: string;
  selector: OperationSelector | null;
};

/** Where a value goes in the operation; null for the CLI's own switches. */
export type InputTarget = { name: string; location: InputLocation } | null;

export type CliArgument = {
  name: string;
  input: InputTarget;
  type: string;
  allowed_values: unknown[] | null;
  description: string;
  example: unknown;
  /** `<file>`: the path of a file whose text is sent as the input. */
  reads_file: boolean;
};

export type CliFlag = {
  flag: string;
  input: InputTarget;
  type: string;
  /** `<to>` for a flag with a value; null for a switch. */
  value_label: string | null;
  is_required: boolean;
  is_repeatable: boolean;
  takes_json: boolean;
  allowed_values: unknown[] | null;
  description: string;
  example: unknown;
};

export type CliCommand = {
  command: string;
  slug: string;
  usage: string;
  summary: string;
  area: string;
  area_slug: string;
  operations: ReferencedOperation[];
  aliases: string[];
  arguments: CliArgument[];
  flags: CliFlag[];
  example: string;
  /** The answer printed with `--json`: a type name, `file (<type>)`, or null. */
  output: string | null;
  exit_codes: number[];
  mcp: string[];
  ui: string[];
};

export type CliReference = {
  global_flags: {
    flag: string;
    value_label: string | null;
    description: string;
  }[];
  exit_codes: { code: number; meaning: string }[];
  commands: CliCommand[];
};

export type McpProperty = {
  name: string;
  input: InputTarget;
  type: string;
  is_required: boolean;
  allowed_values: unknown[] | null;
  description: string;
  example: unknown;
};

export type McpTool = {
  name: string;
  toolset: string;
  summary: string;
  area: string;
  area_slug: string;
  operations: ReferencedOperation[];
  aliases: string[];
  annotations: {
    read_only_hint: boolean;
    destructive_hint: boolean;
    idempotent_hint: boolean;
  };
  properties: McpProperty[];
  input_schema: SpecSchema & { $defs?: Record<string, SpecSchema> };
  example_arguments: Record<string, unknown>;
  output: string | null;
  cli: string[];
  ui: string[];
};

export type McpResource = {
  uri: string;
  /** The page anchor, e.g. `resource-emails-emailid-raw`. */
  slug: string;
  summary: string;
  mime_type: string;
  area: string;
  area_slug: string;
  parameters: McpProperty[];
  operation: ReferencedOperation;
  cli: string;
  ui: string;
};

export type McpExemption = {
  operation: ReferencedOperation;
  reason: string;
  cli: string;
};

export type McpReference = {
  tools: McpTool[];
  resources: McpResource[];
  exemptions: McpExemption[];
};
