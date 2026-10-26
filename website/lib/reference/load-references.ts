import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  CliSnippetSource,
  McpSnippetSource,
} from "@/lib/playground/build-surface-snippets";

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

export type OperationReferenceLinks = {
  cliUrl: string | null;
  mcpUrl: string | null;
  cliSnippetSource: CliSnippetSource | null;
  mcpSnippetSource: McpSnippetSource | null;
};

function readSelectorValue(
  cliOrMcpEntry: { operations: ReferencedOperation[] },
  operationKey: string,
): string | null {
  const operation = cliOrMcpEntry.operations.find(
    (referencedOperation) =>
      `${referencedOperation.method} ${referencedOperation.path}` ===
      operationKey,
  );

  return operation?.selector?.value ?? null;
}

function toCliSnippetSource(
  cliCommand: CliCommand,
  operationKey: string,
): CliSnippetSource {
  return {
    usage: cliCommand.usage,
    url: toCliCommandUrl(cliCommand),
    arguments: cliCommand.arguments,
    flags: cliCommand.flags,
    selectorValue: readSelectorValue(cliCommand, operationKey),
  };
}

function toMcpToolSnippetSource(
  mcpTool: McpTool,
  operationKey: string,
): McpSnippetSource {
  return {
    kind: "tool",
    name: mcpTool.name,
    url: toMcpToolUrl(mcpTool),
    properties: mcpTool.properties.map((mcpProperty) => ({
      name: mcpProperty.name,
      input: mcpProperty.input,
      type: mcpProperty.type,
    })),
    selectorValue: readSelectorValue(mcpTool, operationKey),
  };
}

/** `GET /api/v1/emails` to the CLI command and MCP entry that run it, with their snippet sources. */
export function indexReferencesByOperation(): Map<
  string,
  OperationReferenceLinks
> {
  const referenceLinks = new Map<string, OperationReferenceLinks>();
  const readLinks = (operationKey: string): OperationReferenceLinks =>
    referenceLinks.get(operationKey) ?? {
      cliUrl: null,
      mcpUrl: null,
      cliSnippetSource: null,
      mcpSnippetSource: null,
    };
  for (const cliCommand of loadCliReference().commands) {
    for (const operation of cliCommand.operations) {
      const operationKey = `${operation.method} ${operation.path}`;
      const cliSnippetSource = toCliSnippetSource(cliCommand, operationKey);
      referenceLinks.set(operationKey, {
        ...readLinks(operationKey),
        cliUrl: cliSnippetSource.url,
        cliSnippetSource,
      });
    }
  }
  const mcpReference = loadMcpReference();
  for (const mcpTool of mcpReference.tools) {
    for (const operation of mcpTool.operations) {
      const operationKey = `${operation.method} ${operation.path}`;
      const mcpSnippetSource = toMcpToolSnippetSource(mcpTool, operationKey);
      referenceLinks.set(operationKey, {
        ...readLinks(operationKey),
        mcpUrl: mcpSnippetSource.url,
        mcpSnippetSource,
      });
    }
  }
  for (const mcpResource of mcpReference.resources) {
    const operationKey = `${mcpResource.operation.method} ${mcpResource.operation.path}`;
    const resourceUrl = toMcpResourceUrl(mcpResource);
    referenceLinks.set(operationKey, {
      ...readLinks(operationKey),
      mcpUrl: resourceUrl,
      mcpSnippetSource: {
        kind: "resource",
        uri: mcpResource.uri,
        url: resourceUrl,
      },
    });
  }

  return referenceLinks;
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
