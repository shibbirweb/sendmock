import { PlayIcon, ShieldCheckIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ScenarioFileActions } from "@/features/scenarios/scenario-file-actions";
import { scenarioExamples } from "@/features/scenarios/scenario-examples";
import { ScenarioReportView } from "@/features/scenarios/scenario-report";
import { SavedScenarioBar } from "@/features/scenarios/saved/saved-scenario-bar";
import { SavedScenarioList } from "@/features/scenarios/saved/saved-scenario-list";
import { useSavedScenarioEditor } from "@/features/scenarios/saved/use-saved-scenario-editor";
import { CodeEditor } from "@/features/webhooks/templates/reference/code-editor/code-editor";
import { usePageTitle } from "@/hooks/use-page-title";
import { ApiError } from "@/lib/api/api-client";
import {
  useRunScenario,
  useValidateScenario,
} from "@/lib/api/hooks/use-automation-queries";

/** Write, check and run a scenario: a repeatable multi-step test (docs/plan/20-surface-parity.md). */
export function ScenariosPage() {
  usePageTitle("Scenarios");
  const [scenarioText, setScenarioText] = React.useState<string>(
    scenarioExamples[0].scenarioText,
  );
  const validateScenario = useValidateScenario();
  const runScenario = useRunScenario();
  const validation = validateScenario.data;
  const runError =
    runScenario.error instanceof ApiError ? runScenario.error.message : null;

  const replaceText = (nextScenarioText: string) => {
    setScenarioText(nextScenarioText);
    validateScenario.reset();
    runScenario.reset();
  };
  const savedScenarioEditor = useSavedScenarioEditor({
    scenarioText,
    onOpen: replaceText,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="grid gap-1">
          <h2 className="text-xl font-semibold">Scenarios</h2>
          <p className="text-sm text-muted-foreground">
            A test written once and run again: each step calls an operation,
            waits for a message, or checks a value. The same file runs with{" "}
            <code className="font-mono">sendmock scenario run</code> and in CI.
          </p>
        </header>
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <SavedScenarioList savedScenarioEditor={savedScenarioEditor} />
          <div className="grid min-w-0 content-start gap-4">
            <SavedScenarioBar savedScenarioEditor={savedScenarioEditor} />
            <ScenarioFileActions
              scenarioText={scenarioText}
              onLoad={(loadedScenarioText) => {
                // An example or an uploaded file is a new scenario, not an edit of the opened one.
                savedScenarioEditor.close();
                replaceText(loadedScenarioText);
              }}
            />
            <CodeEditor
              value={scenarioText}
              onChange={replaceText}
              ariaLabel="Scenario"
              language="text"
              templateReference={undefined}
              minHeightClassName="min-h-72"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={validateScenario.isPending}
                onClick={() => validateScenario.mutate(scenarioText)}
              >
                <ShieldCheckIcon />
                Validate
              </Button>
              <Button
                type="button"
                disabled={runScenario.isPending}
                onClick={() => runScenario.mutate(scenarioText)}
              >
                <PlayIcon />
                {runScenario.isPending ? "Running..." : "Run"}
              </Button>
            </div>
            {validation !== undefined && (
              <section aria-label="Validation" className="grid gap-1 text-sm">
                {validation.is_valid ? (
                  <p role="status">
                    Valid: {validation.step_count} steps
                    {validation.name === null ? "" : ` in ${validation.name}`}.
                  </p>
                ) : (
                  <ul className="grid gap-1 text-destructive">
                    {validation.problems.map((scenarioProblem) => (
                      <li
                        key={`${scenarioProblem.step}-${scenarioProblem.message}`}
                      >
                        {scenarioProblem.step === null
                          ? scenarioProblem.message
                          : `Step ${scenarioProblem.step}: ${scenarioProblem.message}`}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            {runError !== null && (
              <p role="alert" className="text-sm text-destructive">
                {runError}
              </p>
            )}
            {runScenario.data !== undefined && (
              <ScenarioReportView scenarioReport={runScenario.data} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
