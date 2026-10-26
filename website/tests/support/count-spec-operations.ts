import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const specPath = fileURLToPath(
  new URL("../../../docs/api/openapi.yaml", import.meta.url),
);
const httpMethods = new Set(["get", "post", "put", "patch", "delete"]);

/** How many operations the frozen spec has, so tests follow the contract. */
export function countSpecOperations(): number {
  const spec = parse(readFileSync(specPath, "utf8")) as {
    paths: Record<string, Record<string, unknown>>;
  };

  return Object.values(spec.paths).reduce(
    (operationCount, pathItem) =>
      operationCount +
      Object.keys(pathItem).filter((method) => httpMethods.has(method)).length,
    0,
  );
}
