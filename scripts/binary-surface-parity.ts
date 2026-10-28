#!/usr/bin/env bun
/**
 * The binary's commands and MCP tools match the published surface catalogue
 * (docs/plan/20-surface-parity.md, AI-01.1).
 *
 *     sendmock help --all --json > binary-surfaces.json
 *     bun scripts/binary-surface-parity.ts binary-surfaces.json
 *
 * Fails when the binary has a command or tool the catalogue does not list, or names one
 * differently. Catalogue entries the binary does not have yet are listed as planned.
 */

import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repositoryRoot = join(import.meta.dir, "..");

type Selector = { input: string; value: string } | null;
type OperationReference = { operation_id: string; selector?: Selector };
/** A name as the binary writes it, or an entry of the reference with `name` or `flag`. */
type NamedEntry = { name?: string; flag?: string } | string;

type CommandEntry = {
  command: string;
  usage: string;
  arguments: NamedEntry[];
  flags: NamedEntry[];
  operations: OperationReference[];
  mcp: string[];
};

/** Flags every command has; the comparison is about the flags an operation's inputs give. */
const globalFlagNames = new Set([
  "--json",
  "--server",
  "--token",
  "--data",
  "--file",
  "--yes",
  "--output",
  "--help",
]);

function readNames(entries: NamedEntry[]): string[] {
  return entries.map((entry) =>
    typeof entry === "string" ? entry : (entry.name ?? entry.flag ?? ""),
  );
}

function readInputFlags(entries: NamedEntry[]): string[] {
  return readNames(entries)
    .filter((flagName) => !globalFlagNames.has(flagName))
    .sort();
}

type ToolAnnotations = {
  read_only_hint: boolean;
  destructive_hint: boolean;
  idempotent_hint: boolean;
};
type CatalogueTool = {
  name: string;
  operations: OperationReference[];
  annotations: ToolAnnotations;
};
type BinaryTool = {
  name: string;
  operationIds: string[];
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
  };
};
export type BinarySurfaces = {
  commands: CommandEntry[];
  mcp_tools: BinaryTool[];
};
export type CatalogueSurfaces = {
  commands: CommandEntry[];
  tools: CatalogueTool[];
};

export type ParityReport = {
  mismatches: string[];
  implementedOperationIds: string[];
  plannedCommandCount: number;
  plannedToolCount: number;
};

function sameSelector(
  first: Selector | undefined,
  second: Selector | undefined,
) {
  return JSON.stringify(first ?? null) === JSON.stringify(second ?? null);
}

function compareCommands(
  binaryCommands: CommandEntry[],
  catalogueCommands: CommandEntry[],
  mismatches: string[],
) {
  for (const binaryCommand of binaryCommands) {
    for (const binaryOperation of binaryCommand.operations) {
      const catalogueCommand = catalogueCommands.find((command) =>
        command.operations.some(
          (operation) =>
            operation.operation_id === binaryOperation.operation_id,
        ),
      );
      if (!catalogueCommand) {
        mismatches.push(
          `${binaryOperation.operation_id}: the catalogue has no CLI command for it`,
        );
        continue;
      }
      const catalogueOperation = catalogueCommand.operations.find(
        (operation) => operation.operation_id === binaryOperation.operation_id,
      );
      if (catalogueCommand.command !== binaryCommand.command) {
        mismatches.push(
          `${binaryOperation.operation_id}: the binary's command is "${binaryCommand.command}", the catalogue's "${catalogueCommand.command}"`,
        );
      }
      if (
        JSON.stringify(readNames(catalogueCommand.arguments)) !==
        JSON.stringify(readNames(binaryCommand.arguments))
      ) {
        mismatches.push(
          `${binaryOperation.operation_id}: the arguments differ`,
        );
      }
      const binaryFlags = readInputFlags(binaryCommand.flags);
      const catalogueFlags = readInputFlags(catalogueCommand.flags);
      if (JSON.stringify(binaryFlags) !== JSON.stringify(catalogueFlags)) {
        mismatches.push(
          `${binaryOperation.operation_id}: the binary's flags are ${binaryFlags.join(" ") || "none"}, the catalogue's ${catalogueFlags.join(" ") || "none"}`,
        );
      }
      if (
        !sameSelector(catalogueOperation?.selector, binaryOperation.selector)
      ) {
        mismatches.push(
          `${binaryOperation.operation_id}: the selectors differ`,
        );
      }
      for (const toolName of binaryCommand.mcp) {
        if (!catalogueCommand.mcp.includes(toolName)) {
          mismatches.push(
            `${binaryOperation.operation_id}: the catalogue does not name MCP tool ${toolName}`,
          );
        }
      }
    }
  }
}

function compareTools(
  binaryTools: BinaryTool[],
  catalogueTools: CatalogueTool[],
  mismatches: string[],
) {
  for (const binaryTool of binaryTools) {
    const catalogueTool = catalogueTools.find(
      (tool) => tool.name === binaryTool.name,
    );
    if (!catalogueTool) {
      mismatches.push(`MCP tool ${binaryTool.name} is not in the catalogue`);
      continue;
    }
    const catalogueOperationIds = catalogueTool.operations.map(
      (operation) => operation.operation_id,
    );
    for (const operationId of binaryTool.operationIds) {
      if (!catalogueOperationIds.includes(operationId)) {
        mismatches.push(
          `MCP tool ${binaryTool.name} runs ${operationId}, which the catalogue gives another tool`,
        );
      }
    }
    const isComplete = catalogueOperationIds.every((operationId) =>
      binaryTool.operationIds.includes(operationId),
    );
    const expected = catalogueTool.annotations;
    const actual = binaryTool.annotations;
    if (
      isComplete &&
      (expected.read_only_hint !== actual.readOnlyHint ||
        expected.destructive_hint !== actual.destructiveHint ||
        expected.idempotent_hint !== actual.idempotentHint)
    ) {
      mismatches.push(`MCP tool ${binaryTool.name}: the annotations differ`);
    }
  }
}

export function compareSurfaces(
  binarySurfaces: BinarySurfaces,
  catalogueSurfaces: CatalogueSurfaces,
): ParityReport {
  const mismatches: string[] = [];
  const operationCommands = binarySurfaces.commands.filter(
    (command) => command.operations.length > 0,
  );
  compareCommands(operationCommands, catalogueSurfaces.commands, mismatches);
  compareTools(binarySurfaces.mcp_tools, catalogueSurfaces.tools, mismatches);
  const implementedOperationIds = operationCommands.flatMap((command) =>
    command.operations.map((operation) => operation.operation_id),
  );
  const binaryToolNames = new Set(
    binarySurfaces.mcp_tools.map((tool) => tool.name),
  );
  return {
    mismatches,
    implementedOperationIds,
    plannedCommandCount: catalogueSurfaces.commands.filter(
      (command) =>
        !command.operations.some((operation) =>
          implementedOperationIds.includes(operation.operation_id),
        ),
    ).length,
    plannedToolCount: catalogueSurfaces.tools.filter(
      (tool) => !binaryToolNames.has(tool.name),
    ).length,
  };
}

function formatReport(parityReport: ParityReport): string {
  return [
    "## Binary surfaces",
    "",
    `Operations the binary serves: ${parityReport.implementedOperationIds.length} (${parityReport.implementedOperationIds.join(", ")})`,
    `Catalogue commands still planned: ${parityReport.plannedCommandCount}`,
    `Catalogue MCP tools still planned: ${parityReport.plannedToolCount}`,
    "",
    ...(parityReport.mismatches.length > 0
      ? ["Mismatches:", ...parityReport.mismatches.map((line) => `- ${line}`)]
      : ["No mismatches."]),
    "",
  ].join("\n");
}

if (import.meta.main) {
  const binarySurfacesPath = process.argv[2];
  if (!binarySurfacesPath) {
    console.error(
      "Usage: bun scripts/binary-surface-parity.ts <sendmock help --all --json output>",
    );
    process.exit(2);
  }
  const readJson = (filePath: string) =>
    JSON.parse(readFileSync(filePath, "utf8"));
  const parityReport = compareSurfaces(readJson(binarySurfacesPath), {
    commands: readJson(join(repositoryRoot, "docs/api/cli-reference.json"))
      .commands,
    tools: readJson(join(repositoryRoot, "docs/api/mcp-tools.json")).tools,
  });
  const reportMarkdown = formatReport(parityReport);
  console.log(reportMarkdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, reportMarkdown);
  }
  if (parityReport.mismatches.length > 0) {
    process.exit(1);
  }
}
