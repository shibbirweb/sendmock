import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { Validator } from "@seriousme/openapi-schema-validator";
import { parse } from "yaml";

import {
  openApiFilePath,
  renderOpenApiYaml,
} from "../../scripts/build-openapi";

type OpenApiDocument = {
  openapi: string;
  paths: Record<string, Record<string, { operationId: string }>>;
  components: { schemas: Record<string, unknown> };
};

const committedYaml = readFileSync(openApiFilePath, "utf8");
const committedDocument = parse(committedYaml) as OpenApiDocument;
let freshYaml = "";

beforeAll(() => {
  freshYaml = renderOpenApiYaml();
}, 60_000);

function listReferences(schemaNode: unknown): string[] {
  if (Array.isArray(schemaNode)) {
    return schemaNode.flatMap(listReferences);
  }
  if (schemaNode === null || typeof schemaNode !== "object") {
    return [];
  }

  return Object.entries(schemaNode).flatMap(([propertyName, propertyValue]) =>
    propertyName === "$ref" && typeof propertyValue === "string"
      ? [propertyValue]
      : listReferences(propertyValue),
  );
}

describe("docs/api/openapi.yaml", () => {
  test("UI-09.2 the committed spec equals a fresh build from the registry and the API types", () => {
    expect(committedYaml === freshYaml).toBe(true);
  });

  test("UI-09.2 every schema reference points at a generated component", () => {
    const componentNames = new Set(
      Object.keys(committedDocument.components.schemas),
    );
    const schemaReferences = listReferences(committedDocument).filter(
      (reference) => reference.startsWith("#/components/schemas/"),
    );

    expect(schemaReferences.length).toBeGreaterThan(100);
    expect(
      schemaReferences.filter(
        (reference) =>
          !componentNames.has(reference.replace("#/components/schemas/", "")),
      ),
    ).toEqual([]);
  });

  test("UI-09.3 is valid OpenAPI 3.1", async () => {
    const openApiValidator = new Validator();
    const validationResult = await openApiValidator.validate(committedDocument);

    expect(openApiValidator.version).toBe("3.1");
    expect(validationResult.errors ?? []).toEqual([]);
    expect(validationResult.valid).toBe(true);
  });

  test("every operation has a unique operationId", () => {
    const operationIds = Object.values(committedDocument.paths).flatMap(
      (pathItem) =>
        Object.values(pathItem).map((operation) => operation.operationId),
    );

    expect(new Set(operationIds).size).toBe(operationIds.length);
  });
});
