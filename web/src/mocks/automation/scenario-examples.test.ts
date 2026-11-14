import { getResponse, HttpHandler } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import { scenarioExamples } from "@/features/scenarios/scenario-examples";
import type { ScenarioReport } from "@/lib/api/types";
import { registerMockRequestHandlers } from "@/mocks/automation/mock-request-dispatcher";
import { replaceMockDatabase } from "@/mocks/db/mock-database";
import { mockHandlers } from "@/mocks/handlers";

const httpHandlers = mockHandlers.filter(
  (mockHandler): mockHandler is HttpHandler =>
    mockHandler instanceof HttpHandler,
);

beforeEach(() => {
  replaceMockDatabase("standard");
  registerMockRequestHandlers(httpHandlers);
});

describe("scenario examples", () => {
  test.each(scenarioExamples)(
    "UI-11.6 the $exampleKey example passes in Demo mode",
    async ({ scenarioText }) => {
      const response = await getResponse(
        httpHandlers,
        new Request("http://localhost/api/v1/scenarios/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenario: scenarioText }),
        }),
      );
      const scenarioReport = (await response?.json()) as ScenarioReport;

      expect(
        scenarioReport.steps.filter(
          (stepResult) => stepResult.status !== "passed",
        ),
      ).toEqual([]);
      expect(scenarioReport.is_passed).toBe(true);
    },
  );
});
