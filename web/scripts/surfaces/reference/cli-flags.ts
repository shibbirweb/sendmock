/** The arguments and flags of a CLI command, from the operation's inputs. */
import type { CatalogueOperation } from "./catalogue-operations";
import { exampleFileNames, switchDescriptions } from "./cli-conventions";
import { buildFlagName, describeInputShape, toKebabCase } from "./input-naming";
import type { CliArgument, CliFlag, InputTarget } from "./reference-types";
import {
  type OperationInput,
  readRawBodyFileName,
  type SpecSchema,
} from "./spec-reader";

type Schemas = Record<string, SpecSchema>;

export function toInputTarget(input: OperationInput): InputTarget {
  return { name: input.name, location: input.location };
}

export function buildArgument(
  placeholder: string,
  input: OperationInput,
  schemas: Schemas,
): CliArgument {
  const inputShape = describeInputShape(input.schema, schemas);
  const readsFile = placeholder === "file";
  return {
    name: placeholder,
    input: toInputTarget(input),
    type: readsFile ? "path" : inputShape.typeLabel,
    allowed_values: inputShape.allowedValues,
    description: readsFile
      ? `A file whose text is sent as \`${input.name}\`: ${input.description}`
      : input.description,
    example: readsFile
      ? (exampleFileNames[input.name] ?? "input.txt")
      : input.example,
    reads_file: readsFile,
  };
}

export function buildInputFlag(
  flag: string,
  input: OperationInput,
  schemas: Schemas,
  valueLabel?: string,
): CliFlag {
  if (input.location === "raw_body") {
    return {
      flag: "--file",
      input: toInputTarget(input),
      type: "path",
      value_label: "<path>",
      is_required: true,
      is_repeatable: false,
      takes_json: false,
      allowed_values: null,
      description: `${input.description} From a file; \`-\` reads stdin.`,
      example: readRawBodyFileName(input.contentType ?? ""),
    };
  }
  const inputShape = describeInputShape(input.schema, schemas);
  return {
    flag,
    input: toInputTarget(input),
    type: inputShape.typeLabel,
    value_label:
      inputShape.kind === "boolean"
        ? null
        : (valueLabel ?? `<${flag.replace(/^--/, "")}>`),
    is_required: input.isRequired,
    is_repeatable: inputShape.kind === "list",
    takes_json: inputShape.kind === "object",
    allowed_values: inputShape.allowedValues,
    description: input.description,
    example: input.example,
  };
}

export function buildSwitch(flag: string): CliFlag {
  return {
    flag,
    input: null,
    type: "boolean",
    value_label: null,
    is_required: false,
    is_repeatable: false,
    takes_json: false,
    allowed_values: null,
    description: switchDescriptions[flag] ?? "",
    example: true,
  };
}

/** `--method` for `sendmock http send`: picks the operation when several share the command. */
export function buildSelectorFlags(
  operationGroup: CatalogueOperation[],
  inputs: OperationInput[],
): CliFlag[] {
  const valueSelectors = operationGroup.flatMap((catalogueOperation) => {
    const selector = catalogueOperation.surfaces.selector;
    return selector !== undefined && "value" in selector ? [selector] : [];
  });
  const selectorInput = valueSelectors[0]?.input;
  if (
    operationGroup.length < 2 ||
    selectorInput === undefined ||
    inputs.some((input) => input.name === selectorInput)
  ) {
    return [];
  }
  return [
    {
      flag: `--${toKebabCase(selectorInput)}`,
      input: null,
      type: "string",
      value_label: `<${toKebabCase(selectorInput)}>`,
      is_required: true,
      is_repeatable: false,
      takes_json: false,
      allowed_values: valueSelectors.map((selector) => selector.value),
      description: `Picks the operation: ${valueSelectors.map((selector) => `\`${selector.value}\``).join(", ")}.`,
      example: valueSelectors[0]?.value,
    },
  ];
}

export function collectDerivedFlags(
  operationGroup: CatalogueOperation[],
  usedInputNames: Set<string>,
  schemas: Schemas,
  problems: string[],
): CliFlag[] {
  const derivedFlags = new Map<string, CliFlag>();
  for (const catalogueOperation of operationGroup) {
    for (const input of catalogueOperation.inputs.filter(
      (operationInput) => !usedInputNames.has(operationInput.name),
    )) {
      const flagName =
        catalogueOperation.surfaces.cliFlags?.[input.name] ??
        buildFlagName(input.name, describeInputShape(input.schema, schemas));
      const existingFlag = derivedFlags.get(flagName);
      if (
        existingFlag !== undefined &&
        existingFlag.input?.name !== input.name
      ) {
        problems.push(
          `${catalogueOperation.surfaces.cli}: ${existingFlag.input?.name} and ${input.name} both map to ${flagName}`,
        );
      }
      const isRequiredEverywhere = operationGroup.every((groupOperation) =>
        groupOperation.inputs.some(
          (groupInput) =>
            groupInput.name === input.name && groupInput.isRequired,
        ),
      );
      derivedFlags.set(flagName, {
        ...buildInputFlag(flagName, input, schemas),
        is_required: isRequiredEverywhere,
      });
    }
  }
  return [...derivedFlags.values()];
}
