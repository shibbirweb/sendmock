import { http, HttpResponse } from "msw";

import type { SavedScenario, SavedScenarioInput } from "@/lib/api/types";
import { runScenario } from "@/mocks/automation/run-scenario";
import { validateScenarioFile } from "@/mocks/automation/scenario-file";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";

/** A saved scenario by id or name, as `{scenarioId}` takes either. */
function findSavedScenario(scenarioIdOrName: string): SavedScenario | null {
  return (
    mockDatabase.savedScenarios.find(
      (savedScenario) =>
        savedScenario.id === scenarioIdOrName ||
        savedScenario.name === scenarioIdOrName,
    ) ?? null
  );
}

/** The problem with a name or file, as the server checks them on save and update. */
function checkScenario(
  scenarioName: string,
  scenarioText: string,
  currentScenarioId: string | null,
): Response | null {
  if (scenarioName.trim() === "") {
    return createErrorResponse(
      400,
      "invalid_input",
      "Give the scenario a name",
    );
  }
  const isNameTaken = mockDatabase.savedScenarios.some(
    (savedScenario) =>
      savedScenario.name === scenarioName.trim() &&
      savedScenario.id !== currentScenarioId,
  );
  if (isNameTaken) {
    return createErrorResponse(
      409,
      "conflict",
      `A scenario named ${scenarioName.trim()} is already saved`,
    );
  }
  const scenarioValidation = validateScenarioFile(scenarioText);
  if (!scenarioValidation.is_valid) {
    return createErrorResponse(
      422,
      "invalid_scenario",
      scenarioValidation.problems
        .map((scenarioProblem) => scenarioProblem.message)
        .join(" "),
    );
  }

  return null;
}

/** Scenarios saved by name (AI-07): list, save, read, change, delete and run. */
export const savedScenarioHandlers = [
  http.get("*/api/v1/scenarios", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockDatabase.savedScenarios);
  }),

  http.post("*/api/v1/scenarios", async ({ request }) => {
    await applyMockConditions();
    const scenarioInput = (await request.json()) as SavedScenarioInput;
    const scenarioProblem = checkScenario(
      scenarioInput.name ?? "",
      scenarioInput.scenario ?? "",
      null,
    );
    if (scenarioProblem !== null) {
      return scenarioProblem;
    }
    const now = new Date().toISOString();
    const savedScenario: SavedScenario = {
      id: crypto.randomUUID(),
      name: scenarioInput.name.trim(),
      description: scenarioInput.description?.trim() ?? "",
      scenario: scenarioInput.scenario,
      created_by: "ui",
      created_at: now,
      updated_at: now,
    };
    mockDatabase.savedScenarios.push(savedScenario);

    return HttpResponse.json(savedScenario, { status: 201 });
  }),

  http.get("*/api/v1/scenarios/:scenarioId", async ({ params }) => {
    await applyMockConditions();
    const savedScenario = findSavedScenario(String(params.scenarioId));

    return savedScenario === null
      ? createNotFoundResponse("Scenario")
      : HttpResponse.json(savedScenario);
  }),

  http.patch("*/api/v1/scenarios/:scenarioId", async ({ params, request }) => {
    await applyMockConditions();
    const savedScenario = findSavedScenario(String(params.scenarioId));
    if (savedScenario === null) {
      return createNotFoundResponse("Scenario");
    }
    const scenarioChange =
      (await request.json()) as Partial<SavedScenarioInput>;
    const changedScenario: SavedScenario = {
      ...savedScenario,
      name: scenarioChange.name?.trim() ?? savedScenario.name,
      description:
        scenarioChange.description?.trim() ?? savedScenario.description,
      scenario: scenarioChange.scenario ?? savedScenario.scenario,
      updated_at: new Date().toISOString(),
    };
    const scenarioProblem = checkScenario(
      changedScenario.name,
      changedScenario.scenario,
      savedScenario.id,
    );
    if (scenarioProblem !== null) {
      return scenarioProblem;
    }
    Object.assign(savedScenario, changedScenario);

    return HttpResponse.json(savedScenario);
  }),

  http.delete("*/api/v1/scenarios/:scenarioId", async ({ params }) => {
    await applyMockConditions();
    const savedScenario = findSavedScenario(String(params.scenarioId));
    if (savedScenario === null) {
      return createNotFoundResponse("Scenario");
    }
    mockDatabase.savedScenarios = mockDatabase.savedScenarios.filter(
      (keptScenario) => keptScenario.id !== savedScenario.id,
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.post("*/api/v1/scenarios/:scenarioId/run", async ({ params }) => {
    await applyMockConditions();
    const savedScenario = findSavedScenario(String(params.scenarioId));
    if (savedScenario === null) {
      return createNotFoundResponse("Scenario");
    }
    const scenarioOutcome = await runScenario(savedScenario.scenario);

    return "problems" in scenarioOutcome
      ? createErrorResponse(
          422,
          "invalid_scenario",
          scenarioOutcome.problems.join(" "),
        )
      : HttpResponse.json(scenarioOutcome);
  }),
];
