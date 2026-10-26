import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type {
  CliReference,
  McpReference,
} from "../../lib/reference/reference-types";

function readApiDocsJson<ParsedJson>(fileName: string): ParsedJson {
  const filePath = fileURLToPath(
    new URL(`../../../docs/api/${fileName}`, import.meta.url),
  );

  return JSON.parse(readFileSync(filePath, "utf8")) as ParsedJson;
}

/** The generated CLI reference, so tests follow the contract. */
export function readCliReference(): CliReference {
  return readApiDocsJson<CliReference>("cli-reference.json");
}

/** The generated MCP reference, so tests follow the contract. */
export function readMcpReference(): McpReference {
  return readApiDocsJson<McpReference>("mcp-tools.json");
}
