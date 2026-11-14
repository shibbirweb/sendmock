import { parse } from "smol-toml";

import type { ScenarioProblem, ScenarioValidation } from "@/lib/api/types";
import {
  scenarioBuiltinSteps,
  scenarioOperations,
} from "@/mocks/automation/scenario-operations";

export type ScenarioStep = {
  run: string;
  with: Record<string, unknown>;
  save: string | null;
};

export type ParsedScenario = {
  name: string | null;
  steps: ScenarioStep[];
  problems: ScenarioProblem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStep(
  rawStep: unknown,
  stepNumber: number,
  problems: ScenarioProblem[],
): ScenarioStep | null {
  if (!isRecord(rawStep) || typeof rawStep.run !== "string") {
    problems.push({
      step: stepNumber,
      message: 'A step needs run = "<operation>".',
    });
    return null;
  }
  const isKnown =
    scenarioOperations.has(rawStep.run) ||
    (scenarioBuiltinSteps as readonly string[]).includes(rawStep.run);
  if (!isKnown) {
    problems.push({
      step: stepNumber,
      message: `Unknown operation ${rawStep.run}.`,
    });
  }

  return {
    run: rawStep.run,
    with: isRecord(rawStep.with) ? rawStep.with : {},
    save: typeof rawStep.save === "string" ? rawStep.save : null,
  };
}

/** Reads a scenario file (docs/plan/14-ai-integration.md, Scenarios) and lists its problems. */
export function parseScenarioFile(scenarioText: string): ParsedScenario {
  let parsedFile: Record<string, unknown>;
  try {
    parsedFile = parse(scenarioText);
  } catch (parseError) {
    const message =
      parseError instanceof Error ? parseError.message : String(parseError);
    return {
      name: null,
      steps: [],
      problems: [{ step: null, message: `Not valid TOML: ${message}` }],
    };
  }
  const problems: ScenarioProblem[] = [];
  const rawSteps = Array.isArray(parsedFile.steps) ? parsedFile.steps : [];
  if (rawSteps.length === 0) {
    problems.push({ step: null, message: "Add at least one [[steps]] table." });
  }
  const steps = rawSteps
    .map((rawStep, stepIndex) => readStep(rawStep, stepIndex + 1, problems))
    .filter((step): step is ScenarioStep => step !== null);

  return {
    name: typeof parsedFile.name === "string" ? parsedFile.name : null,
    steps,
    problems,
  };
}

export function validateScenarioFile(scenarioText: string): ScenarioValidation {
  const parsedScenario = parseScenarioFile(scenarioText);

  return {
    is_valid: parsedScenario.problems.length === 0,
    name: parsedScenario.name,
    step_count: parsedScenario.steps.length,
    problems: parsedScenario.problems,
  };
}
