/** One example command line per CLI command (docs/plan/21-reference-and-examples.md). */
import {
  type CliToken,
  quoteShellValue,
  renderFlagExample,
} from "./cli-command-text";
import { isOptionalExampleCandidate } from "./catalogue-operations";
import type { CliArgument, CliFlag } from "./reference-types";

/** Optional flags shown in an example, after the required ones. */
const optionalExampleFlagLimit = 2;

function renderTokens(
  cliTokens: CliToken[],
  commandArguments: CliArgument[],
  flags: CliFlag[],
): string[] {
  return cliTokens.flatMap((cliToken) => {
    if (cliToken.kind === "word") {
      return [cliToken.text];
    }
    if (cliToken.kind === "argument") {
      const commandArgument = commandArguments.find(
        (argument) => argument.name === cliToken.placeholder,
      );
      return [
        quoteShellValue(commandArgument?.example ?? cliToken.placeholder),
      ];
    }
    const cliFlag = flags.find((flag) => flag.flag === cliToken.flag);

    return cliFlag === undefined
      ? [cliToken.flag]
      : renderFlagExample(cliFlag, cliFlag.example);
  });
}

/**
 * The command with example values: its own arguments and flags, then the
 * required flags, a few optional ones with simple values, and `--yes`.
 */
export function buildCliExample(
  cliTokens: CliToken[],
  commandArguments: CliArgument[],
  flags: CliFlag[],
): string {
  const flagsInCommand = new Set(
    cliTokens.flatMap((cliToken) =>
      cliToken.kind === "flag" ? [cliToken.flag] : [],
    ),
  );
  const otherFlags = flags.filter(
    (cliFlag) => !flagsInCommand.has(cliFlag.flag) && cliFlag.flag !== "--yes",
  );
  const requiredFlags = otherFlags.filter((cliFlag) => cliFlag.is_required);
  const optionalFlags = otherFlags
    .filter(
      (cliFlag) =>
        !cliFlag.is_required &&
        !cliFlag.takes_json &&
        cliFlag.input !== null &&
        cliFlag.input.location !== "raw_body" &&
        isOptionalExampleCandidate(cliFlag.input.name) &&
        cliFlag.example !== undefined,
    )
    .slice(0, optionalExampleFlagLimit);
  const needsYes =
    flags.some((cliFlag) => cliFlag.flag === "--yes") &&
    !flagsInCommand.has("--yes");

  return [
    ...renderTokens(cliTokens, commandArguments, flags),
    ...[...requiredFlags, ...optionalFlags].flatMap((cliFlag) =>
      renderFlagExample(cliFlag, cliFlag.example),
    ),
    ...(needsYes ? ["--yes"] : []),
  ].join(" ");
}
