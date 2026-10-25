"use client";

import { useState } from "react";

import { useDemoBridge } from "@/lib/playground/demo-bridge-provider";
import { type ScenarioContext, scenarios } from "@/lib/playground/scenarios";

type StepResult = { title: string; status: number; summary: string };

function parseBody(responseBody: string): unknown {
  try {
    return JSON.parse(responseBody);
  } catch {
    return null;
  }
}

/** Runs a multi-step flow against the demo API, one request per step (WS-04.3). */
export function ScenarioRunner() {
  const { isReady, sendRequest } = useDemoBridge();
  const [selectedScenarioKey, setSelectedScenarioKey] = useState(
    scenarios[0]?.key ?? "",
  );
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const selectedScenario =
    scenarios.find((scenario) => scenario.key === selectedScenarioKey) ??
    scenarios[0];

  const runScenario = async () => {
    if (!selectedScenario) {
      return;
    }
    setIsRunning(true);
    setStepResults([]);
    let scenarioContext: ScenarioContext = {};
    for (const scenarioStep of selectedScenario.steps) {
      const stepResponse = await sendRequest(
        scenarioStep.buildRequest(scenarioContext),
      );
      const { learned, summary } = scenarioStep.readAnswer(
        parseBody(stepResponse.body),
      );
      scenarioContext = { ...scenarioContext, ...learned };
      setStepResults((previousResults) => [
        ...previousResults,
        { title: scenarioStep.title, status: stepResponse.status, summary },
      ]);
    }
    setIsRunning(false);
  };

  return (
    <section
      aria-labelledby="scenario-heading"
      className="grid gap-3 rounded-xl border bg-fd-card p-4"
    >
      <h2 id="scenario-heading" className="font-semibold">
        Scenario mode
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="scenario-select" className="text-sm">
          Scenario
        </label>
        <select
          id="scenario-select"
          value={selectedScenarioKey}
          onChange={(changeEvent) =>
            setSelectedScenarioKey(changeEvent.target.value)
          }
          className="rounded-md border bg-fd-background px-2 py-1 text-sm"
        >
          {scenarios.map((scenario) => (
            <option key={scenario.key} value={scenario.key}>
              {scenario.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!isReady || isRunning}
          onClick={() => void runScenario()}
          className="rounded-md bg-fd-primary px-3 py-1 text-sm font-medium text-fd-primary-foreground disabled:opacity-50"
        >
          Run scenario
        </button>
      </div>
      <ol data-testid="scenario-steps" className="grid gap-2">
        {(selectedScenario?.steps ?? []).map((scenarioStep, stepIndex) => {
          const stepResult = stepResults[stepIndex];
          return (
            <li key={scenarioStep.title} className="grid gap-0.5 text-sm">
              <span>
                {stepIndex + 1}. {scenarioStep.title}
              </span>
              <span className="font-mono text-xs text-fd-muted-foreground">
                {stepResult
                  ? `${stepResult.status} ${stepResult.summary}`
                  : "not run"}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
