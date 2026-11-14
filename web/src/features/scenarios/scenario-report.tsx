import { ScenarioStepStatusBadge } from "@/features/scenarios/scenario-step-status";
import type { ScenarioReport } from "@/lib/api/types";

function formatJson(jsonValue: unknown): string {
  return typeof jsonValue === "string"
    ? jsonValue
    : JSON.stringify(jsonValue, null, 2);
}

/** A run's result, step by step: input, answer or error, and saved values. */
export function ScenarioReportView({
  scenarioReport,
}: {
  scenarioReport: ScenarioReport;
}) {
  const passedCount = scenarioReport.steps.filter(
    (stepResult) => stepResult.status === "passed",
  ).length;
  const failedStep = scenarioReport.steps.find(
    (stepResult) => stepResult.status === "failed",
  );

  return (
    <section aria-label="Run report" className="grid gap-3">
      <p role="status" className="text-sm font-medium">
        {failedStep === undefined
          ? `Passed: ${passedCount} of ${scenarioReport.steps.length} steps in ${scenarioReport.duration_ms} ms`
          : `Failed at step ${failedStep.step}: ${failedStep.error ?? ""}`}
      </p>
      <ol className="grid gap-2">
        {scenarioReport.steps.map((stepResult) => (
          <li
            key={stepResult.step}
            aria-label={`Step ${stepResult.step}: ${stepResult.run}`}
            data-testid="scenario-step"
            className="grid gap-2 rounded-md border p-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Step {stepResult.step}
              </span>
              <code className="font-mono">{stepResult.run}</code>
              <ScenarioStepStatusBadge stepStatus={stepResult.status} />
              {stepResult.saved_as !== null && (
                <span className="text-xs text-muted-foreground">
                  saved as <code>{stepResult.saved_as}</code>
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {stepResult.duration_ms} ms
              </span>
            </div>
            {stepResult.error !== null && (
              <p className="text-sm text-destructive">{stepResult.error}</p>
            )}
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Input and answer
              </summary>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <pre className="overflow-x-auto rounded-md bg-muted/30 p-2 font-mono text-xs">
                  {formatJson(stepResult.input)}
                </pre>
                <pre className="overflow-x-auto rounded-md bg-muted/30 p-2 font-mono text-xs">
                  {formatJson(stepResult.output)}
                </pre>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
