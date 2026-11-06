import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { pluginToolPrefix } from "./case-problems";
import type { EvalCase } from "./eval-case";

export type PluginEvalOptions = {
  outputDirectory: string;
  model: string | null;
  judgeModel: string | null;
};

export type GraderVerdict = {
  name: string;
  isPassed: boolean;
  explanation: string;
};

export type PluginEvalResult = {
  score: number | null;
  runError: string | null;
  graderVerdicts: GraderVerdict[];
};

/** The arguments of one `claude plugin eval` run: one case, one run, the real MCP server. */
export function buildPluginEvalArguments(
  evalCase: EvalCase,
  options: PluginEvalOptions,
): string[] {
  return [
    "plugin",
    "eval",
    join(evalCase.directory, "prompt.md"),
    "--runs",
    "1",
    "--ablation",
    "none",
    "--mocks",
    "off",
    "--trust-plugin",
    "--no-publish",
    "--output-dir",
    options.outputDirectory,
    ...(options.model === null ? [] : ["--model", options.model]),
    ...(options.judgeModel === null
      ? []
      : ["--judge-model", options.judgeModel]),
    "--json",
    join(options.outputDirectory, "result.json"),
    "--allow-tools",
    `${pluginToolPrefix}*`,
  ];
}

type RunRecord = Record<string, unknown> & { error?: string | null };

/** Grader results are read wherever a run lists objects with a name and a verdict. */
function readGraderVerdicts(runRecord: RunRecord): GraderVerdict[] {
  return Object.values(runRecord)
    .filter(Array.isArray)
    .flat()
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" &&
        entry !== null &&
        "passed" in entry &&
        ("name" in entry || "grader" in entry),
    )
    .map((entry) => ({
      name: String(entry.name ?? entry.grader),
      isPassed: entry.passed === true,
      explanation: String(entry.explanation ?? ""),
    }));
}

export function readPluginEvalResult(resultJson: string): PluginEvalResult {
  const result = JSON.parse(resultJson) as {
    cases?: {
      aggregates?: { score?: number };
      arms?: { with?: RunRecord[] };
    }[];
  };
  const caseResult = result.cases?.[0];
  const runRecord = caseResult?.arms?.with?.[0] ?? {};
  const abortReason = (runRecord.aborted as { reason?: string } | undefined)
    ?.reason;
  return {
    score: caseResult?.aggregates?.score ?? null,
    runError:
      runRecord.error ??
      (abortReason === undefined ? null : `aborted: ${abortReason}`),
    graderVerdicts: readGraderVerdicts(runRecord),
  };
}

export async function runPluginEval(
  evalCase: EvalCase,
  options: PluginEvalOptions,
): Promise<PluginEvalResult> {
  mkdirSync(options.outputDirectory, { recursive: true });
  const evalProcess = Bun.spawn(
    ["claude", ...buildPluginEvalArguments(evalCase, options)],
    {
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  await evalProcess.exited;
  const resultPath = join(options.outputDirectory, "result.json");
  if (!existsSync(resultPath)) {
    return {
      score: null,
      runError: `claude plugin eval exited with ${evalProcess.exitCode} and wrote no result`,
      graderVerdicts: [],
    };
  }
  return readPluginEvalResult(readFileSync(resultPath, "utf8"));
}
