import type { EndStateResult } from "./end-state";
import type { PluginEvalResult } from "./plugin-eval-run";

export type CaseOutcome = {
  caseName: string;
  pluginEval: PluginEvalResult;
  endState: EndStateResult[];
  setupError: string | null;
};

export function isCasePassed(outcome: CaseOutcome, threshold: number): boolean {
  return (
    outcome.setupError === null &&
    outcome.pluginEval.runError === null &&
    (outcome.pluginEval.score ?? 0) >= threshold &&
    outcome.endState.every((result) => result.isPassed)
  );
}

function renderCaseSection(outcome: CaseOutcome, threshold: number): string[] {
  const verdict = isCasePassed(outcome, threshold) ? "passed" : "failed";
  const scoreText = outcome.pluginEval.score?.toFixed(2) ?? "none";
  return [
    `### ${outcome.caseName}: ${verdict} (score ${scoreText})`,
    "",
    ...(outcome.setupError === null
      ? []
      : [`- Setup failed: ${outcome.setupError}`]),
    ...(outcome.pluginEval.runError === null
      ? []
      : [`- Run error: ${outcome.pluginEval.runError}`]),
    ...outcome.pluginEval.graderVerdicts.map(
      (graderVerdict) =>
        `- Grader ${graderVerdict.name}: ${graderVerdict.isPassed ? "passed" : "failed"}${graderVerdict.explanation === "" ? "" : `, ${graderVerdict.explanation}`}`,
    ),
    ...outcome.endState.map(
      (result) =>
        `- End state: ${result.isPassed ? "passed" : "failed"}, ${result.detail}`,
    ),
    "",
  ];
}

/** The Markdown report of a run: one section per case, then the total. */
export function renderEvalReport(
  outcomes: CaseOutcome[],
  threshold: number,
): string {
  const passedCount = outcomes.filter((outcome) =>
    isCasePassed(outcome, threshold),
  ).length;
  return [
    "## Skill evals",
    "",
    ...outcomes.flatMap((outcome) => renderCaseSection(outcome, threshold)),
    `${passedCount} of ${outcomes.length} cases passed (threshold ${threshold}).`,
    "",
  ].join("\n");
}
