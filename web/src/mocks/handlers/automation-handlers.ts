import { http, HttpResponse } from "msw";

import type { IntegrationSnippet, ScenarioRequest } from "@/lib/api/types";
import {
  agentSkillMarkdown,
  aiAgentSetups,
} from "@/mocks/automation/ai-agent-setups";
import { buildIntegrationSnippet } from "@/mocks/automation/build-integration-snippet";
import { runScenario } from "@/mocks/automation/run-scenario";
import { validateScenarioFile } from "@/mocks/automation/scenario-file";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { listRecentMockEvents } from "@/mocks/realtime/mock-event-bus";

/** Recent events, integration snippets, scenarios and AI agent setup (UI-11.5). */
export const automationHandlers = [
  http.get("*/api/v1/events/recent", async ({ request }) => {
    await applyMockConditions();
    const eventQuery = new URL(request.url).searchParams;
    const sinceMs = Date.parse(eventQuery.get("since") ?? "");
    const eventType = eventQuery.get("type");
    const limit = Number(eventQuery.get("limit") ?? 50) || 50;

    return HttpResponse.json(
      listRecentMockEvents()
        .filter(
          (appEvent) =>
            (Number.isNaN(sinceMs) ||
              Date.parse(appEvent.created_at) > sinceMs) &&
            (eventType === null ||
              eventType === "" ||
              appEvent.type === eventType),
        )
        .slice(0, limit),
    );
  }),

  http.get("*/api/v1/integrations/:stack", async ({ params, request }) => {
    await applyMockConditions();
    const integrationQuery = new URL(request.url).searchParams;
    const integrationSnippet: IntegrationSnippet | null =
      buildIntegrationSnippet(
        String(params.stack),
        integrationQuery.get("channel"),
        integrationQuery.get("host"),
      );

    return integrationSnippet === null
      ? createNotFoundResponse("Stack")
      : HttpResponse.json(integrationSnippet);
  }),

  http.post("*/api/v1/scenarios/validate", async ({ request }) => {
    await applyMockConditions();
    const scenarioRequest = (await request.json()) as ScenarioRequest;

    return HttpResponse.json(
      validateScenarioFile(scenarioRequest.scenario ?? ""),
    );
  }),

  http.post("*/api/v1/scenarios/run", async ({ request }) => {
    await applyMockConditions();
    const scenarioRequest = (await request.json()) as ScenarioRequest;
    const scenarioOutcome = await runScenario(scenarioRequest.scenario ?? "");

    return "problems" in scenarioOutcome
      ? createErrorResponse(
          422,
          "invalid_scenario",
          scenarioOutcome.problems.join(" "),
        )
      : HttpResponse.json(scenarioOutcome);
  }),

  http.get("*/api/v1/ai/agents", async () => {
    await applyMockConditions();

    return HttpResponse.json(aiAgentSetups);
  }),

  http.get("*/api/v1/ai/skill", async () => {
    await applyMockConditions();

    return new HttpResponse(agentSkillMarkdown, {
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }),
];
