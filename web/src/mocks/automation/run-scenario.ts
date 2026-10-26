import type { ScenarioReport, ScenarioStepResult } from "@/lib/api/types";
import { dispatchMockRequest } from "@/mocks/automation/mock-request-dispatcher";
import {
  parseScenarioFile,
  type ScenarioStep,
} from "@/mocks/automation/scenario-file";
import {
  type ScenarioOperation,
  scenarioOperations,
} from "@/mocks/automation/scenario-operations";
import {
  evaluateAssertion,
  fillStepInput,
  fillTemplate,
  type ScenarioValues,
} from "@/mocks/automation/scenario-values";

type StepOutcome = Pick<ScenarioStepResult, "status" | "output" | "error">;

type StepRun = StepOutcome & { input: Record<string, unknown> };

const maximumSleepMs = 2_000;
const mockBaseUrl = "http://localhost";

function toSnakeCase(parameterName: string): string {
  return parameterName.replaceAll(
    /[A-Z]/g,
    (letter) => `_${letter.toLowerCase()}`,
  );
}

/** A step's `with` table as a request: path parameters first, the rest as query or body. */
function buildOperationRequest(
  operation: ScenarioOperation,
  stepInput: Record<string, unknown>,
): Request {
  const remainingInput = { ...stepInput };
  const filledPath = operation.path.replaceAll(
    /\{(\w+)\}/g,
    (_placeholder, parameterName: string) => {
      const inputKey =
        [parameterName, toSnakeCase(parameterName), "id"].find(
          (key) => key in remainingInput,
        ) ?? parameterName;
      const parameterValue = remainingInput[inputKey];
      delete remainingInput[inputKey];

      return encodeURIComponent(String(parameterValue ?? ""));
    },
  );
  const requestUrl = new URL(filledPath, mockBaseUrl);
  const hasBody = operation.method !== "GET" && operation.method !== "DELETE";
  if (!hasBody) {
    for (const [key, value] of Object.entries(remainingInput)) {
      requestUrl.searchParams.set(key, String(value));
    }
  }

  return new Request(requestUrl, {
    method: operation.method,
    headers: { "content-type": "application/json" },
    body: hasBody ? JSON.stringify(remainingInput) : undefined,
  });
}

async function readOutcome(response: Response): Promise<StepOutcome> {
  const responseText = await response.text();
  let output: unknown = responseText;
  try {
    output = responseText === "" ? null : JSON.parse(responseText);
  } catch {
    // Not JSON: keep the text, such as a TOML or Markdown file.
  }
  if (response.ok) {
    return { status: "passed", output, error: null };
  }
  const errorMessage = (output as { error?: { message?: string } } | null)
    ?.error?.message;

  return {
    status: "failed",
    output,
    error: `${response.status}: ${errorMessage ?? "request failed"}`,
  };
}

async function runBuiltinStep(
  step: ScenarioStep,
  stepInput: Record<string, unknown>,
  scenarioValues: ScenarioValues,
): Promise<StepOutcome> {
  if (step.run === "sleep") {
    const sleepMs = Math.min(
      Number(stepInput.seconds ?? 1) * 1_000,
      maximumSleepMs,
    );
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
    return { status: "passed", output: null, error: null };
  }
  if (step.run === "assert") {
    const filledText = String(
      fillTemplate(scenarioValues, String(step.with.that ?? "")),
    );
    return evaluateAssertion(filledText)
      ? { status: "passed", output: filledText, error: null }
      : {
          status: "failed",
          output: filledText,
          error: `Not true: ${filledText}`,
        };
  }
  const targetUrl = String(stepInput.url ?? "");
  if (!targetUrl.startsWith("/")) {
    return {
      status: "skipped",
      output: null,
      error: "Calls your app; skipped in Demo mode.",
    };
  }
  const httpResponse = await dispatchMockRequest(
    new Request(new URL(targetUrl, mockBaseUrl), {
      method: String(stepInput.method ?? "GET"),
      headers: { "content-type": "application/json" },
      body:
        stepInput.json === undefined
          ? undefined
          : JSON.stringify(stepInput.json),
    }),
  );

  return readOutcome(httpResponse);
}

async function runStep(
  step: ScenarioStep,
  scenarioValues: ScenarioValues,
): Promise<StepRun> {
  const stepInput = fillStepInput(scenarioValues, step.with) as Record<
    string,
    unknown
  >;
  const operation = scenarioOperations.get(step.run);
  const stepOutcome =
    operation === undefined
      ? await runBuiltinStep(step, stepInput, scenarioValues)
      : await readOutcome(
          await dispatchMockRequest(
            buildOperationRequest(operation, stepInput),
          ),
        );

  return { ...stepOutcome, input: stepInput };
}

/** Runs a scenario's steps in order, saving outputs for later steps; stops at the first failure. */
export async function runScenario(
  scenarioText: string,
): Promise<ScenarioReport | { problems: string[] }> {
  const parsedScenario = parseScenarioFile(scenarioText);
  if (parsedScenario.problems.length > 0) {
    return {
      problems: parsedScenario.problems.map((problem) => problem.message),
    };
  }
  const startedAtMs = Date.now();
  const scenarioValues: ScenarioValues = {};
  const stepResults: ScenarioStepResult[] = [];
  let hasFailed = false;
  for (const [stepIndex, step] of parsedScenario.steps.entries()) {
    const stepStartedAtMs = Date.now();
    const stepResult: StepRun = hasFailed
      ? {
          status: "skipped" as const,
          output: null,
          error: "An earlier step failed.",
          input: step.with,
        }
      : await runStep(step, scenarioValues);
    hasFailed ||= stepResult.status === "failed";
    if (step.save !== null && stepResult.status === "passed") {
      scenarioValues[step.save] = stepResult.output;
    }
    stepResults.push({
      step: stepIndex + 1,
      run: step.run,
      ...stepResult,
      saved_as: stepResult.status === "passed" ? step.save : null,
      duration_ms: Date.now() - stepStartedAtMs,
    });
  }

  return {
    name: parsedScenario.name ?? "scenario",
    is_passed: !hasFailed,
    started_at: new Date(startedAtMs).toISOString(),
    duration_ms: Date.now() - startedAtMs,
    steps: stepResults,
  };
}
