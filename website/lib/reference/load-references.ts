import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  CliCommand,
  CliReference,
  McpReference,
  McpResource,
  McpTool,
  ReferencedOperation,
} from "./reference-types";

function readApiDocsJson<ParsedJson>(fileName: string): ParsedJson {
  return JSON.parse(
    readFileSync(join(process.cwd(), "../docs/api", fileName), "utf8"),
  ) as ParsedJson;
}

export function loadCliReference(): CliReference {
  return readApiDocsJson<CliReference>("cli-reference.json");
}

export function loadMcpReference(): McpReference {
  return readApiDocsJson<McpReference>("mcp-tools.json");
}

/** Areas in the order they first appear, with their page slugs. */
export function listAreas(
  entries: { area: string; area_slug: string }[],
): { name: string; slug: string }[] {
  const areas = new Map<string, string>();
  for (const entry of entries) {
    areas.set(entry.area_slug, areas.get(entry.area_slug) ?? entry.area);
  }

  return [...areas].map(([slug, name]) => ({ name, slug }));
}

export function toCliCommandUrl(cliCommand: CliCommand): string {
  return `/cli/${cliCommand.area_slug}/#${cliCommand.slug}`;
}

export function toMcpToolUrl(mcpTool: McpTool): string {
  return `/mcp/${mcpTool.area_slug}/#${mcpTool.name}`;
}

export function toMcpResourceUrl(mcpResource: McpResource): string {
  return `/mcp/${mcpResource.area_slug}/#${mcpResource.slug}`;
}

/** The API reference entry of an operation the CLI or MCP reference names. */
export function toApiOperationUrl(
  referencedOperation: ReferencedOperation,
): string {
  return `/api/${referencedOperation.area_slug}/#${referencedOperation.operation_id}`;
}

/** `GET /api/v1/emails` to the CLI command and MCP entry that run it. */
export function indexReferencesByOperation(): Map<
  string,
  { cliUrl: string; mcpUrl: string | null }
> {
  const cliUrls = new Map<string, string>();
  for (const cliCommand of loadCliReference().commands) {
    for (const operation of cliCommand.operations) {
      cliUrls.set(
        `${operation.method} ${operation.path}`,
        toCliCommandUrl(cliCommand),
      );
    }
  }
  const mcpReference = loadMcpReference();
  const mcpUrls = new Map<string, string>([
    ...mcpReference.tools.flatMap((mcpTool) =>
      mcpTool.operations.map((operation): [string, string] => [
        `${operation.method} ${operation.path}`,
        toMcpToolUrl(mcpTool),
      ]),
    ),
    ...mcpReference.resources.map((mcpResource): [string, string] => [
      `${mcpResource.operation.method} ${mcpResource.operation.path}`,
      toMcpResourceUrl(mcpResource),
    ]),
  ]);

  return new Map(
    [...cliUrls].map(([operationKey, cliUrl]) => [
      operationKey,
      { cliUrl, mcpUrl: mcpUrls.get(operationKey) ?? null },
    ]),
  );
}

/** The catalogue's command text (`sendmock email update <emailId>`) to its entry. */
export function indexCliCommandUrls(): Map<string, string> {
  return new Map(
    loadCliReference().commands.map((cliCommand) => [
      cliCommand.usage.replace(/ \[flags\]$/, ""),
      toCliCommandUrl(cliCommand),
    ]),
  );
}

/** A tool name or resource URI to its entry. */
export function indexMcpEntryUrls(): Map<string, string> {
  const mcpReference = loadMcpReference();

  return new Map([
    ...mcpReference.tools.map((mcpTool): [string, string] => [
      mcpTool.name,
      toMcpToolUrl(mcpTool),
    ]),
    ...mcpReference.resources.map((mcpResource): [string, string] => [
      mcpResource.uri,
      toMcpResourceUrl(mcpResource),
    ]),
  ]);
}

/** Names as links where an entry exists, plain otherwise. */
export function toNamedLinks(
  names: string[],
  entryUrls: Map<string, string>,
): { name: string; url: string | null }[] {
  return names.map((name) => ({ name, url: entryUrls.get(name) ?? null }));
}
