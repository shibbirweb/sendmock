/** The CLI tab: each SendMock call as its `sendmock` command, checks with `jq`. */
import type { CliCommand, CliFlag } from "@/lib/reference/reference-types";

import type { ExampleContract } from "./example-contract";
import {
  type ApiStep,
  type CodeExample,
  type ExampleStep,
  isFieldReference,
  type StepValue,
} from "./example-types";
import { type ExampleRenderer, joinStepLines } from "./render-shared";

function quoteShell(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);

  return /^[\w@.+:/=,%-]+$/.test(text)
    ? text
    : `'${text.replace(/'/g, `'\\''`)}'`;
}

/** A value on the command line; an earlier answer's field is read with `jq`. */
function renderShellValue(stepValue: StepValue): string {
  if (isFieldReference(stepValue)) {
    return `"$(jq -r '.${stepValue.fieldPath.replace(/\.(\d+)/g, "[$1]")}' <<<"$${stepValue.answerName}")"`;
  }

  return quoteShell(stepValue);
}

function findFlag(
  cliCommand: CliCommand,
  inputName: string,
  location: string,
): CliFlag | undefined {
  return cliCommand.flags.find(
    (cliFlag) =>
      cliFlag.input?.name === inputName && cliFlag.input.location === location,
  );
}

function renderFlag(cliFlag: CliFlag, stepValue: StepValue): string[] {
  if (cliFlag.value_label === null) {
    return [
      stepValue === false ? cliFlag.flag.replace(/^--/, "--no-") : cliFlag.flag,
    ];
  }
  if (cliFlag.is_repeatable && Array.isArray(stepValue)) {
    return stepValue.flatMap((item) => [cliFlag.flag, renderShellValue(item)]);
  }
  if (cliFlag.takes_json && !isFieldReference(stepValue)) {
    return [cliFlag.flag, quoteShell(JSON.stringify(stepValue))];
  }

  return [cliFlag.flag, renderShellValue(stepValue)];
}

/** The input a placeholder of the command line stands for. */
function readPlaceholderValue(
  cliCommand: CliCommand,
  placeholder: string,
  apiStep: ApiStep,
): StepValue | undefined {
  const commandArgument = cliCommand.arguments.find(
    (argument) => argument.name === placeholder,
  );
  const inlineFlag = cliCommand.flags.find(
    (cliFlag) => cliFlag.value_label === `<${placeholder}>`,
  );
  const input = commandArgument?.input ?? inlineFlag?.input ?? null;
  if (input === null) {
    return undefined;
  }
  if (input.location === "path") {
    return apiStep.pathValues?.[input.name];
  }

  return input.location === "query"
    ? apiStep.query?.[input.name]
    : apiStep.body?.[input.name];
}

function renderCommand(apiStep: ApiStep, cliCommand: CliCommand): string {
  const usedInputs = new Set<string>();
  const commandWords = cliCommand.usage
    .replace(/ \[flags\]$/, "")
    .split(" ")
    .map((commandWord) => {
      const placeholder = /^<(\w+)>$/.exec(commandWord)?.[1];
      if (placeholder === undefined) {
        return commandWord;
      }
      const placeholderValue = readPlaceholderValue(
        cliCommand,
        placeholder,
        apiStep,
      );
      const commandArgument = cliCommand.arguments.find(
        (argument) => argument.name === placeholder,
      );
      const inlineFlag = cliCommand.flags.find(
        (cliFlag) => cliFlag.value_label === commandWord,
      );
      usedInputs.add(
        commandArgument?.input?.name ?? inlineFlag?.input?.name ?? placeholder,
      );
      return placeholderValue === undefined
        ? commandWord
        : renderShellValue(placeholderValue);
    });
  const inputEntries: [string, string, StepValue][] = [
    ...Object.entries(apiStep.query ?? {}).map(
      ([name, value]): [string, string, StepValue] => ["query", name, value],
    ),
    ...Object.entries(apiStep.body ?? {}).map(
      ([name, value]): [string, string, StepValue] => ["body", name, value],
    ),
  ];
  const flagWords = inputEntries
    .filter(([, inputName]) => !usedInputs.has(inputName))
    .flatMap(([location, inputName, stepValue]) => {
      const cliFlag = findFlag(cliCommand, inputName, location);
      return cliFlag === undefined ? [] : renderFlag(cliFlag, stepValue);
    });
  const selectorValue = cliCommand.operations.find(
    (operation) =>
      operation.method === apiStep.method && operation.path === apiStep.path,
  )?.selector?.value;
  const selectorFlag = cliCommand.flags.find(
    (cliFlag) => cliFlag.input === null && cliFlag.value_label !== null,
  );
  const selectorWords =
    selectorValue !== undefined && selectorFlag !== undefined
      ? [selectorFlag.flag, selectorValue]
      : [];
  const yesWords =
    cliCommand.flags.some((cliFlag) => cliFlag.flag === "--yes") &&
    !commandWords.includes("--yes")
      ? ["--yes"]
      : [];

  return [...commandWords, ...selectorWords, ...flagWords, ...yesWords].join(
    " ",
  );
}

function renderStep(
  exampleStep: ExampleStep,
  exampleContract: ExampleContract,
): string[] {
  if (exampleStep.kind === "pick") {
    const jqPath = exampleStep.fieldPath.replace(/\.(\d+)/g, "[$1]");
    return [
      `${exampleStep.answerName}=$(jq '.${jqPath}' <<<"$${exampleStep.fromAnswer}")`,
    ];
  }
  if (exampleStep.kind === "app") {
    return [`# In your app: ${exampleStep.note}`];
  }
  if (exampleStep.kind === "expect") {
    const expectedJson = JSON.stringify(exampleStep.value);
    const jqPath = exampleStep.fieldPath.replace(/\.(\d+)/g, "[$1]");
    return [
      `jq -e '.${jqPath} == ${expectedJson}' <<<"$${exampleStep.answerName}" >/dev/null`,
    ];
  }
  const cliCommand = exampleContract.findOperation(
    exampleStep.method,
    exampleStep.path,
  )?.cliCommand;
  if (cliCommand === undefined || cliCommand === null) {
    throw new Error(
      `No CLI command for ${exampleStep.method} ${exampleStep.path}`,
    );
  }
  const commandLine = renderCommand(exampleStep, cliCommand);

  return [
    exampleStep.answerName === undefined
      ? commandLine
      : `${exampleStep.answerName}=$(${commandLine} --json)`,
  ];
}

export const cliRenderer: ExampleRenderer = {
  tabName: "CLI",
  fenceLanguage: "bash",
  render: (codeExample: CodeExample, exampleContract: ExampleContract) =>
    joinStepLines(codeExample.steps, (exampleStep) =>
      renderStep(exampleStep, exampleContract),
    ).join("\n"),
};
