/** A tool's input properties, one per operation input, plus a selector for shared tools. */
import type { CatalogueOperation } from "./catalogue-operations";
import { describeInputShape, toSnakeCase } from "./input-naming";
import type { McpProperty } from "./reference-types";
import type { OperationInput, SpecSchema } from "./spec-reader";

type Schemas = Record<string, SpecSchema>;

export function toMcpPropertyName(input: OperationInput): string {
  if (input.location === "raw_body") {
    return "content";
  }

  return input.location === "path" ? toSnakeCase(input.name) : input.name;
}

export function toMcpProperty(
  input: OperationInput,
  schemas: Schemas,
): McpProperty {
  const inputShape = describeInputShape(input.schema, schemas);
  return {
    name: toMcpPropertyName(input),
    input: { name: input.name, location: input.location },
    type: inputShape.typeLabel,
    is_required: input.isRequired,
    allowed_values: inputShape.allowedValues,
    description:
      input.location === "raw_body"
        ? `${input.description} Text as is; base64 for binary content.`
        : input.description,
    example: input.example,
  };
}

export function readSelectorValue(
  catalogueOperation: CatalogueOperation,
): string | null {
  const selector = catalogueOperation.surfaces.selector;
  return selector !== undefined && "value" in selector ? selector.value : null;
}

/** `kind` for `sendmock_email_check`: a required choice between the operations. */
export function buildSelectorProperty(
  operationGroup: CatalogueOperation[],
): McpProperty | null {
  const selectorInput = operationGroup[0]?.surfaces.selector?.input;
  const selectorValues = operationGroup.map(readSelectorValue);
  if (
    operationGroup.length < 2 ||
    selectorInput === undefined ||
    selectorValues.includes(null)
  ) {
    return null;
  }
  const choiceTexts = operationGroup.map(
    (catalogueOperation) =>
      `\`${readSelectorValue(catalogueOperation)}\`: ${catalogueOperation.entry.operation.summary}`,
  );
  return {
    name: selectorInput,
    input: null,
    type: "string",
    is_required: true,
    allowed_values: selectorValues,
    description: `Picks what to do. ${choiceTexts.join(" ")}`,
    example: selectorValues[0],
  };
}

export function collectToolProperties(
  operationGroup: CatalogueOperation[],
  schemas: Schemas,
  problems: string[],
): McpProperty[] {
  const propertiesByName = new Map<
    string,
    { property: McpProperty; requiredCount: number }
  >();
  for (const catalogueOperation of operationGroup) {
    const namesInOperation = new Set<string>();
    for (const input of catalogueOperation.inputs) {
      const property = toMcpProperty(input, schemas);
      if (namesInOperation.has(property.name)) {
        problems.push(
          `${catalogueOperation.surfaces.mcp}: two inputs of ${catalogueOperation.entry.method} ${catalogueOperation.entry.path} map to ${property.name}`,
        );
      }
      namesInOperation.add(property.name);
      const existing = propertiesByName.get(property.name);
      propertiesByName.set(property.name, {
        property: existing?.property ?? property,
        requiredCount:
          (existing?.requiredCount ?? 0) + (input.isRequired ? 1 : 0),
      });
    }
  }
  const selectorProperty = buildSelectorProperty(operationGroup);
  if (
    selectorProperty !== null &&
    propertiesByName.has(selectorProperty.name)
  ) {
    problems.push(
      `${operationGroup[0]?.surfaces.mcp}: the selector ${selectorProperty.name} is also an input`,
    );
  }
  const toolProperties = [...propertiesByName.values()].map(
    ({ property, requiredCount }) => ({
      ...property,
      is_required: requiredCount === operationGroup.length,
    }),
  );
  return selectorProperty === null
    ? toolProperties
    : [selectorProperty, ...toolProperties];
}
