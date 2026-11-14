/**
 * Builds docs/api/cli-reference.json: every CLI command with its arguments,
 * flags, example, output and exit codes, from the spec and the surface
 * catalogue (docs/plan/21-reference-and-examples.md, WS-07.2, WS-07.5).
 */
import {
  type CatalogueOperation,
  describeGroupOutput,
  groupOperations,
  isDestructiveOperation,
  listErrorStatuses,
  toReferencedOperation,
} from "./catalogue-operations";
import {
  type CliToken,
  parseCliCommand,
  readCommandName,
  resolvePlaceholderInput,
} from "./cli-command-text";
import { buildCliExample } from "./cli-example";
import { exitCodes, globalFlags, switchDescriptions } from "./cli-conventions";
import {
  buildArgument,
  buildInputFlag,
  buildSelectorFlags,
  buildSwitch,
  collectDerivedFlags,
} from "./cli-flags";
import { toAreaSlug } from "./input-naming";
import type {
  CliArgument,
  CliCommand,
  CliFlag,
  CliReference,
} from "./reference-types";
import type { SpecSchema } from "./spec-reader";

type Schemas = Record<string, SpecSchema>;

function readCommandParts(
  cliTokens: CliToken[],
  firstOperation: CatalogueOperation,
  schemas: Schemas,
  problems: string[],
) {
  const cliText = firstOperation.surfaces.cli;
  const cliArguments = firstOperation.surfaces.cliArguments ?? {};
  const commandArguments: CliArgument[] = [];
  const stringFlags: CliFlag[] = [];
  const usedInputNames = new Set<string>();
  for (const cliToken of cliTokens) {
    if (cliToken.kind === "word") {
      continue;
    }
    if (cliToken.kind === "flag" && cliToken.placeholder === null) {
      if (switchDescriptions[cliToken.flag] === undefined) {
        problems.push(`${cliText}: unknown switch ${cliToken.flag}`);
      }
      stringFlags.push(buildSwitch(cliToken.flag));
      continue;
    }
    const placeholder = cliToken.placeholder ?? "";
    const input = resolvePlaceholderInput(
      placeholder,
      cliToken.kind === "flag" ? cliToken.flag : null,
      firstOperation.inputs,
      cliArguments,
    );
    if (input === undefined) {
      problems.push(
        `${cliText}: <${placeholder}> names no input of ${firstOperation.entry.method} ${firstOperation.entry.path}`,
      );
      continue;
    }
    usedInputNames.add(input.name);
    if (cliToken.kind === "flag") {
      stringFlags.push(
        buildInputFlag(cliToken.flag, input, schemas, `<${placeholder}>`),
      );
    } else {
      commandArguments.push(buildArgument(placeholder, input, schemas));
    }
  }
  return { commandArguments, stringFlags, usedInputNames };
}

function checkOverrides(
  catalogueOperation: CatalogueOperation,
  problems: string[],
): void {
  const inputNames = new Set(
    catalogueOperation.inputs.map((input) => input.name),
  );
  const overrideNames = [
    ...Object.values(catalogueOperation.surfaces.cliArguments ?? {}),
    ...Object.keys(catalogueOperation.surfaces.cliFlags ?? {}),
  ];
  for (const overrideName of overrideNames.filter(
    (name) => !inputNames.has(name),
  )) {
    problems.push(
      `${catalogueOperation.surfaces.cli}: the override names ${overrideName}, which is not an input`,
    );
  }
  for (const pathInput of catalogueOperation.inputs.filter(
    (input) => input.location === "path",
  )) {
    const isInCommand =
      Object.values(catalogueOperation.surfaces.cliArguments ?? {}).includes(
        pathInput.name,
      ) || catalogueOperation.surfaces.cli.includes(`<${pathInput.name}>`);
    if (!isInCommand) {
      problems.push(
        `${catalogueOperation.surfaces.cli}: the path parameter ${pathInput.name} is not in the command`,
      );
    }
  }
}

function buildCliCommand(
  cliText: string,
  operationGroup: CatalogueOperation[],
  schemas: Schemas,
  problems: string[],
): CliCommand | null {
  const firstOperation = operationGroup[0];
  if (firstOperation === undefined) {
    return null;
  }
  operationGroup.forEach((catalogueOperation) =>
    checkOverrides(catalogueOperation, problems),
  );
  const cliTokens = parseCliCommand(cliText);
  const { commandArguments, stringFlags, usedInputNames } = readCommandParts(
    cliTokens,
    firstOperation,
    schemas,
    problems,
  );
  const derivedFlags = collectDerivedFlags(
    operationGroup,
    usedInputNames,
    schemas,
    problems,
  );
  const needsYes =
    operationGroup.some(isDestructiveOperation) &&
    !stringFlags.some((cliFlag) => cliFlag.flag === "--yes");
  const flags = [
    ...stringFlags,
    ...buildSelectorFlags(operationGroup, firstOperation.inputs),
    ...derivedFlags,
    ...(needsYes ? [buildSwitch("--yes")] : []),
  ];
  for (const clashingFlag of flags.filter(
    (cliFlag) =>
      cliFlag.flag !== "--file" &&
      globalFlags.some((globalFlag) => globalFlag.flag === cliFlag.flag),
  )) {
    problems.push(`${cliText}: ${clashingFlag.flag} is also a global flag`);
  }
  if (
    operationGroup.length > 1 &&
    operationGroup.some(
      (catalogueOperation) =>
        catalogueOperation.surfaces.selector === undefined,
    )
  ) {
    problems.push(
      `${cliText} runs ${operationGroup.length} operations, so each needs a selector`,
    );
  }
  const commandName = readCommandName(cliTokens);
  const errorStatuses = operationGroup.flatMap((catalogueOperation) =>
    listErrorStatuses(catalogueOperation.entry),
  );
  const area = firstOperation.entry.operation.tags[0] ?? "Other";
  return {
    command: commandName,
    slug: commandName.replace(/^sendmock /, "").replace(/\s+/g, "-"),
    usage: flags.length > stringFlags.length ? `${cliText} [flags]` : cliText,
    summary: [
      ...new Set(
        operationGroup.map(
          (catalogueOperation) => catalogueOperation.entry.operation.summary,
        ),
      ),
    ].join(" "),
    area,
    area_slug: toAreaSlug(area),
    operations: operationGroup.map(toReferencedOperation),
    aliases: [
      ...new Set(
        operationGroup.flatMap(
          (catalogueOperation) => catalogueOperation.surfaces.cliAliases ?? [],
        ),
      ),
    ],
    arguments: commandArguments,
    flags,
    example: buildCliExample(cliTokens, commandArguments, flags),
    output: describeGroupOutput(operationGroup),
    exit_codes: [
      0,
      1,
      2,
      ...(errorStatuses.includes(404) ? [3] : []),
      ...(errorStatuses.includes(408) ? [4] : []),
    ],
    mcp: [
      ...new Set(
        operationGroup.flatMap(
          (catalogueOperation) => catalogueOperation.surfaces.mcp ?? [],
        ),
      ),
    ],
    ui: [
      ...new Set(
        operationGroup.map(
          (catalogueOperation) => catalogueOperation.surfaces.ui,
        ),
      ),
    ],
  };
}

export function buildCliReference(
  catalogueOperations: CatalogueOperation[],
  schemas: Schemas,
): { cliReference: CliReference; problems: string[] } {
  const problems: string[] = [];
  const commands = [
    ...groupOperations(
      catalogueOperations,
      (catalogueOperation) => catalogueOperation.surfaces.cli,
    ),
  ]
    .flatMap(
      ([cliText, operationGroup]) =>
        buildCliCommand(cliText, operationGroup, schemas, problems) ?? [],
    )
    .sort((firstCommand, secondCommand) =>
      firstCommand.command.localeCompare(secondCommand.command),
    );

  return {
    cliReference: {
      global_flags: globalFlags,
      exit_codes: exitCodes,
      commands,
    },
    problems,
  };
}
