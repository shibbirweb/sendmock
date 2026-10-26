/**
 * Reads a catalogue CLI command such as `sendmock otp --to <recipient>` and
 * writes example command lines (docs/plan/21-reference-and-examples.md).
 */
import type { CliFlag } from "./reference-types";
import { toSnakeCase } from "./input-naming";
import type { OperationInput } from "./spec-reader";

export type CliToken =
  | { kind: "word"; text: string }
  | { kind: "argument"; placeholder: string }
  | { kind: "flag"; flag: string; placeholder: string | null };

const placeholderPattern = /^<(\w+)>$/;

export function parseCliCommand(cliText: string): CliToken[] {
  const textParts = cliText.split(/\s+/).filter((textPart) => textPart !== "");
  const cliTokens: CliToken[] = [];
  for (let partIndex = 0; partIndex < textParts.length; partIndex += 1) {
    const textPart = textParts[partIndex] ?? "";
    const nextPlaceholder = placeholderPattern.exec(
      textParts[partIndex + 1] ?? "",
    )?.[1];
    if (textPart.startsWith("--")) {
      cliTokens.push({
        kind: "flag",
        flag: textPart,
        placeholder: nextPlaceholder ?? null,
      });
      if (nextPlaceholder !== undefined) {
        partIndex += 1;
      }
      continue;
    }
    const placeholder = placeholderPattern.exec(textPart)?.[1];
    cliTokens.push(
      placeholder === undefined
        ? { kind: "word", text: textPart }
        : { kind: "argument", placeholder },
    );
  }

  return cliTokens;
}

/** `sendmock email check html`: the command without its placeholders and flags. */
export function readCommandName(cliTokens: CliToken[]): string {
  return cliTokens
    .flatMap((cliToken) => (cliToken.kind === "word" ? [cliToken.text] : []))
    .join(" ");
}

/**
 * The input a placeholder stands for: the catalogue's mapping, the same
 * name, its snake_case form, or the flag's name (`--to <recipient>` is `to`).
 */
export function resolvePlaceholderInput(
  placeholder: string,
  flag: string | null,
  inputs: OperationInput[],
  cliArguments: Record<string, string>,
): OperationInput | undefined {
  const candidateNames = [
    cliArguments[placeholder],
    placeholder,
    toSnakeCase(placeholder),
    flag === null ? undefined : toSnakeCase(flag.replace(/^--/, "")),
  ];
  for (const candidateName of candidateNames) {
    const matchingInput = inputs.find((input) => input.name === candidateName);
    if (matchingInput !== undefined) {
      return matchingInput;
    }
  }

  return undefined;
}

export function quoteShellValue(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);

  return /^[\w@.+:/=,%-]+$/.test(text)
    ? text
    : `'${text.replace(/'/g, `'\\''`)}'`;
}

/** One flag with its example value: `--read`, `--tag a --tag b`, `--headers '{...}'`. */
export function renderFlagExample(cliFlag: CliFlag, value: unknown): string[] {
  if (cliFlag.value_label === null) {
    return value === false
      ? [`--no-${cliFlag.flag.replace(/^--/, "")}`]
      : [cliFlag.flag];
  }
  if (cliFlag.is_repeatable && Array.isArray(value)) {
    return value.flatMap((item) => [cliFlag.flag, quoteShellValue(item)]);
  }

  return [cliFlag.flag, quoteShellValue(value)];
}
