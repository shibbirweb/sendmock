/**
 * Renders docs/api/cli-reference.json and docs/api/mcp-tools.json from the
 * spec and the surface catalogue (docs/plan/21-reference-and-examples.md).
 */
import { surfaceCatalogue } from "../../../src/lib/api/surface-catalogue";
import { buildCliReference } from "./build-cli-reference";
import { buildMcpReference } from "./build-mcp-reference";
import { listCatalogueOperations } from "./catalogue-operations";
import type { SpecDocument } from "./spec-reader";

export type SurfaceReferences = {
  cliReferenceJson: string;
  mcpToolsJson: string;
  /** Rule breaks, e.g. two inputs on one flag; the build fails on any. */
  problems: string[];
};

export function renderSurfaceReferences(
  specDocument: SpecDocument,
): SurfaceReferences {
  const catalogueOperations = listCatalogueOperations(
    specDocument,
    surfaceCatalogue,
  );
  const schemas = specDocument.components.schemas;
  const { cliReference, problems: cliProblems } = buildCliReference(
    catalogueOperations,
    schemas,
  );
  const { mcpReference, problems: mcpProblems } = buildMcpReference(
    catalogueOperations,
    schemas,
  );

  return {
    cliReferenceJson: `${JSON.stringify(cliReference, null, 2)}\n`,
    mcpToolsJson: `${JSON.stringify(mcpReference, null, 2)}\n`,
    problems: [...cliProblems, ...mcpProblems],
  };
}
