import { expect, test } from "@playwright/test";

import { scenarioExamples } from "../../src/features/scenarios/scenario-examples";
import { watchFailedApiCalls } from "./live-api-watch";

test("AI-04.2 the live Scenarios screen validates the first example without running it", async ({
  page,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);
  await page.goto("/scenarios");

  await page.getByRole("button", { name: "Validate" }).click();

  await expect(
    page.getByRole("region", { name: "Validation" }).getByRole("status"),
  ).toHaveText("Valid: 5 steps in otp-from-sms.");
  await expect(page.getByRole("region", { name: "Run report" })).toHaveCount(0);
  expect(failedApiCalls).toEqual([]);
});

for (const scenarioExample of scenarioExamples) {
  test(`AI-04.1 the live ${scenarioExample.exampleKey} example runs every step`, async ({
    page,
  }) => {
    await page.goto("/scenarios");
    await page.getByRole("button", { name: "Load example" }).click();
    await page
      .getByRole("menuitem", { name: scenarioExample.title, exact: true })
      .click();

    await page.getByRole("button", { name: "Run" }).click();

    const runReport = page.getByRole("region", { name: "Run report" });
    await expect(runReport.getByRole("status")).toContainText("Passed:");
    await expect(
      runReport.getByTestId("scenario-step").filter({ hasText: "failed" }),
    ).toHaveCount(0);
  });
}
