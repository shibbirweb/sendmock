/**
 * What the code examples may use, read from the generated contract
 * (docs/api/openapi.yaml and cli-reference.json), and the checks that keep
 * the checks in example-checks.ts (docs/plan/21-reference-and-examples.md, WS-08.3).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import type { JsonSchema, SchemaComponents } from "@/lib/openapi/openapi-types";
import type { CliCommand, CliReference } from "@/lib/reference/reference-types";

type SpecOperation = {
  parameters?: { name: string; in: string; required?: boolean }[];
  requestBody?: { content: Record<string, { schema: JsonSchema }> };
  responses: Record<
    string,
    { content?: Record<string, { schema: JsonSchema }> }
  >;
};

export type ContractOperation = {
  pathParameterNames: string[];
  queryParameters: { name: string; isRequired: boolean }[];
  bodySchema: JsonSchema | null;
  responseSchema: JsonSchema | null;
  cliCommand: CliCommand | null;
};

export type ExampleContract = {
  schemas: SchemaComponents;
  findOperation: (method: string, path: string) => ContractOperation | null;
};

function readApiDocsFile(fileName: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../../docs/api/${fileName}`, import.meta.url)),
    "utf8",
  );
}

function readSuccessSchema(specOperation: SpecOperation): JsonSchema | null {
  const successStatus = Object.keys(specOperation.responses).find((status) =>
    /^2/.test(status),
  );
  const mediaType = Object.values(
    specOperation.responses[successStatus ?? ""]?.content ?? {},
  )[0];

  return mediaType?.schema ?? null;
}

export function loadExampleContract(): ExampleContract {
  const spec = parse(readApiDocsFile("openapi.yaml")) as {
    paths: Record<string, Record<string, SpecOperation>>;
    components: { schemas: SchemaComponents };
  };
  const cliReference = JSON.parse(
    readApiDocsFile("cli-reference.json"),
  ) as CliReference;
  const cliCommands = new Map(
    cliReference.commands.flatMap((cliCommand) =>
      cliCommand.operations.map((operation): [string, CliCommand] => [
        `${operation.method} ${operation.path}`,
        cliCommand,
      ]),
    ),
  );

  return {
    schemas: spec.components.schemas,
    findOperation: (method, path) => {
      const specOperation = spec.paths[path]?.[method.toLowerCase()];
      if (specOperation === undefined) {
        return null;
      }
      const parameters = specOperation.parameters ?? [];
      return {
        pathParameterNames: parameters
          .filter((parameter) => parameter.in === "path")
          .map((parameter) => parameter.name),
        queryParameters: parameters
          .filter((parameter) => parameter.in === "query")
          .map((parameter) => ({
            name: parameter.name,
            isRequired: parameter.required ?? false,
          })),
        bodySchema:
          Object.values(specOperation.requestBody?.content ?? {})[0]?.schema ??
          null,
        responseSchema: readSuccessSchema(specOperation),
        cliCommand: cliCommands.get(`${method} ${path}`) ?? null,
      };
    },
  };
}

/** Follows references and the non-null half of a nullable union. */
export function resolveContractSchema(
  schema: JsonSchema,
  schemas: SchemaComponents,
): JsonSchema {
  const referenceName = schema.$ref?.split("/").pop();
  if (referenceName !== undefined) {
    return resolveContractSchema(schemas[referenceName] ?? {}, schemas);
  }
  const variants = (schema.anyOf ?? schema.oneOf ?? []).filter(
    (variant) => variant.type !== "null",
  );
  if (variants.length === 1 && variants[0] !== undefined) {
    return resolveContractSchema(variants[0], schemas);
  }

  return schema;
}
