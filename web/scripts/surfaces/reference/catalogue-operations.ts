/** Spec operations joined with their surface catalogue entries, for both references. */
import type { OperationSurfaces } from "../../../src/lib/api/surface-catalogue/surface-definition";
import type { ReferencedOperation } from "./reference-types";
import {
  listOperationInputs,
  listSpecOperations,
  readComponentName,
  type OperationInput,
  type SpecDocument,
  type SpecOperationEntry,
  type SpecSchema,
} from "./spec-reader";

export type CatalogueOperation = {
  entry: SpecOperationEntry;
  surfaces: OperationSurfaces;
  inputs: OperationInput[];
};

/** POSTs that compute an answer without changing anything. */
const readOnlyActionPattern =
  /\/(preview|render|test|validate|link-check|spam-check)$/;

export function listCatalogueOperations(
  specDocument: SpecDocument,
  surfaceCatalogue: Record<string, OperationSurfaces>,
): CatalogueOperation[] {
  return listSpecOperations(specDocument).flatMap((entry) => {
    const surfaces = surfaceCatalogue[`${entry.method} ${entry.path}`];
    return surfaces === undefined
      ? []
      : [
          {
            entry,
            surfaces,
            inputs: listOperationInputs(entry, specDocument.components.schemas),
          },
        ];
  });
}

export function toReferencedOperation(
  catalogueOperation: CatalogueOperation,
): ReferencedOperation {
  return {
    method: catalogueOperation.entry.method,
    path: catalogueOperation.entry.path,
    operation_id: catalogueOperation.entry.operation.operationId,
    summary: catalogueOperation.entry.operation.summary,
    selector: catalogueOperation.surfaces.selector ?? null,
  };
}

export function listErrorStatuses(entry: SpecOperationEntry): number[] {
  return Object.keys(entry.operation.responses)
    .filter((status) => /^[45]\d\d$/.test(status))
    .map(Number);
}

/** The success answer as a type name (`EmailSummary`, `EmailSummary[]`), a file, or null. */
export function describeOutput(entry: SpecOperationEntry): string | null {
  const successStatus = Object.keys(entry.operation.responses).find((status) =>
    /^2/.test(status),
  );
  const [contentType, mediaType] =
    Object.entries(
      entry.operation.responses[successStatus ?? ""]?.content ?? {},
    )[0] ?? [];
  if (contentType === undefined || mediaType === undefined) {
    return null;
  }
  if (!contentType.includes("json")) {
    return `file (${contentType})`;
  }
  const schema: SpecSchema = mediaType.schema;
  const itemName =
    schema.items === undefined ? null : readComponentName(schema.items);

  return itemName === null
    ? (readComponentName(schema) ?? "object")
    : `${itemName}[]`;
}

export function isReadOnlyOperation(entry: SpecOperationEntry): boolean {
  return (
    entry.method === "GET" ||
    (entry.method === "POST" && readOnlyActionPattern.test(entry.path))
  );
}

export function isDestructiveOperation(
  catalogueOperation: CatalogueOperation,
): boolean {
  // A DELETE sent to a bin (`/catch/...`) is captured, not carried out.
  return (
    (catalogueOperation.entry.method === "DELETE" &&
      catalogueOperation.entry.path.startsWith("/api/")) ||
    catalogueOperation.surfaces.cli.includes("--yes")
  );
}

export function groupOperations(
  catalogueOperations: CatalogueOperation[],
  readGroupKey: (catalogueOperation: CatalogueOperation) => string | null,
): Map<string, CatalogueOperation[]> {
  const operationGroups = new Map<string, CatalogueOperation[]>();
  for (const catalogueOperation of catalogueOperations) {
    const groupKey = readGroupKey(catalogueOperation);
    if (groupKey !== null) {
      operationGroups.set(groupKey, [
        ...(operationGroups.get(groupKey) ?? []),
        catalogueOperation,
      ]);
    }
  }

  return operationGroups;
}

/** Optional IDs are usually alternatives (`email_id` or `sms_id`), so examples leave them out. */
export function isOptionalExampleCandidate(inputName: string): boolean {
  return !/(_id|Id)$/.test(inputName);
}

/** The outputs of a group of operations: `HtmlCheckReport | SpamCheckReport`. */
export function describeGroupOutput(
  catalogueOperations: CatalogueOperation[],
): string | null {
  const outputs = [
    ...new Set(
      catalogueOperations.flatMap(
        (catalogueOperation) => describeOutput(catalogueOperation.entry) ?? [],
      ),
    ),
  ];

  return outputs.length === 0 ? null : outputs.join(" | ");
}

/** Required inputs first, then optional ones with simple values, at most `optionalLimit` of them. */
export function pickExampleInputs(
  inputs: OperationInput[],
  isSimpleInput: (input: OperationInput) => boolean,
  optionalLimit: number,
): OperationInput[] {
  const requiredInputs = inputs.filter((input) => input.isRequired);
  const optionalInputs = inputs
    .filter(
      (input) =>
        !input.isRequired &&
        isSimpleInput(input) &&
        isOptionalExampleCandidate(input.name),
    )
    .slice(0, optionalLimit);

  return [...requiredInputs, ...optionalInputs];
}
