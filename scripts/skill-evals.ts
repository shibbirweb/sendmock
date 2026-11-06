#!/usr/bin/env bun
/**
 * The skill's evals (docs/plan/30-phase-5.md, W9c; AI-05.7). Each case under plugin/evals is a
 * `claude plugin eval` case plus SendMock's part: `seed.toml` and `sendmock-eval.json` (the
 * traffic to send before the run and the API reads to check after it).
 *
 *     bun scripts/skill-evals.ts check <sendmock-binary>
 *         every case is well formed, its seed and traffic apply, its reads answer
 *     bun scripts/skill-evals.ts run <sendmock-binary> [--case <name>] [--model <id>]
 *         [--judge-model <id>] [--threshold <0..1>] [--output <dir>]
 *         runs each case with Claude Code (needs ANTHROPIC_API_KEY) and checks its end state
 */

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  type CaseContext,
  findCaseProblems,
} from "./skill-evals/case-problems";
import { checkEndState } from "./skill-evals/end-state";
import { type EvalCase, listEvalCases } from "./skill-evals/eval-case";
import {
  type CaseOutcome,
  isCasePassed,
  renderEvalReport,
} from "./skill-evals/eval-report";
import { listReadOperations } from "./skill-evals/openapi-reads";
import { runPluginEval } from "./skill-evals/plugin-eval-run";
import {
  listMcpToolNames,
  sendBeforeRequests,
  startSendmock,
} from "./skill-evals/sendmock-instance";

const repositoryRoot = join(import.meta.dir, "..");
const evalsDirectory = join(repositoryRoot, "plugin/evals");

const { values: options, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    case: { type: "string" },
    model: { type: "string" },
    "judge-model": { type: "string" },
    threshold: { type: "string", default: "1" },
    output: { type: "string", default: "skill-eval-results" },
  },
});
const [command, binaryArgument] = positionals;
if (
  (command !== "check" && command !== "run") ||
  binaryArgument === undefined
) {
  console.error(
    "Usage: bun scripts/skill-evals.ts check|run <sendmock-binary> [options]",
  );
  process.exit(1);
}
const binaryPath = resolve(binaryArgument);

async function readCaseContext(): Promise<CaseContext> {
  const sendmock = await startSendmock(binaryPath, null);
  try {
    return {
      mcpToolNames: await listMcpToolNames(binaryPath),
      readOperations: listReadOperations(
        readFileSync(join(repositoryRoot, "docs/api/openapi.yaml"), "utf8"),
      ),
    };
  } finally {
    await sendmock.stop();
  }
}

async function findLiveProblems(evalCase: EvalCase): Promise<string[]> {
  const sendmock = await startSendmock(binaryPath, evalCase.seedPath).catch(
    (startError: Error) => startError,
  );
  if (sendmock instanceof Error) {
    return [`the seed does not apply: ${sendmock.message}`];
  }
  try {
    await sendBeforeRequests(sendmock.baseUrl, evalCase.setup.before);
    for (const check of evalCase.setup.checks) {
      await sendmock.readJson(check.path);
    }
    return [];
  } catch (setupError) {
    return [String((setupError as Error).message)];
  } finally {
    await sendmock.stop();
  }
}

async function checkCases(evalCases: EvalCase[]) {
  const caseContext = await readCaseContext();
  let problemCount = 0;
  for (const evalCase of evalCases) {
    const problems = [
      ...findCaseProblems(evalCase, caseContext),
      ...(await findLiveProblems(evalCase)),
    ];
    for (const problem of problems) {
      console.log(`::error title=Skill eval ${evalCase.name}::${problem}`);
    }
    problemCount += problems.length;
    console.log(
      `${evalCase.name}: ${problems.length === 0 ? "well formed" : "has problems"}`,
    );
  }
  if (problemCount > 0 || evalCases.length === 0) {
    process.exit(1);
  }
}

async function runCase(evalCase: EvalCase): Promise<CaseOutcome> {
  const outcome: CaseOutcome = {
    caseName: evalCase.name,
    pluginEval: { score: null, runError: null, graderVerdicts: [] },
    endState: [],
    setupError: null,
  };
  const sendmock = await startSendmock(binaryPath, evalCase.seedPath);
  try {
    await sendBeforeRequests(sendmock.baseUrl, evalCase.setup.before);
    outcome.pluginEval = await runPluginEval(evalCase, {
      outputDirectory: resolve(options.output, evalCase.name),
      model: options.model ?? null,
      judgeModel: options["judge-model"] ?? null,
    });
    outcome.endState = await checkEndState(
      evalCase.setup.checks,
      sendmock.readJson,
    );
  } catch (caseError) {
    outcome.setupError = String((caseError as Error).message);
  } finally {
    await sendmock.stop();
  }
  return outcome;
}

async function runCases(evalCases: EvalCase[]) {
  process.env.PATH = `${dirname(binaryPath)}:${process.env.PATH ?? ""}`;
  const threshold = Number(options.threshold);
  const outcomes: CaseOutcome[] = [];
  for (const evalCase of evalCases) {
    outcomes.push(await runCase(evalCase));
  }
  const report = renderEvalReport(outcomes, threshold);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  }
  if (!outcomes.every((outcome) => isCasePassed(outcome, threshold))) {
    process.exit(1);
  }
}

const selectedCases = listEvalCases(evalsDirectory).filter(
  (evalCase) => options.case === undefined || evalCase.name === options.case,
);
if (command === "check") {
  await checkCases(selectedCases);
} else {
  await runCases(selectedCases);
}
