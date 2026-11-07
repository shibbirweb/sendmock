import { expect, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

test("PL-01.4 the live API reference lists the binary's own operations by area", async ({
  page,
  request,
}) => {
  const openApiDocument = (await (
    await request.get("/api/openapi.json")
  ).json()) as { paths: Record<string, Record<string, unknown>> };
  const operationCount = Object.values(openApiDocument.paths).reduce(
    (pathCount, pathItem) => pathCount + Object.keys(pathItem).length,
    0,
  );
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/api-reference");

  await expect(
    page.getByRole("status").filter({ hasText: "operations" }),
  ).toHaveText(`${operationCount} of ${operationCount} operations`);
  await expect(page.getByRole("region", { name: "Payments" })).toBeVisible();
  await page.getByLabel("Search the API").fill("subscription advance");
  await expect(page.getByTestId("api-operation")).toHaveCount(1);
  expect(failedApiCalls).toEqual([]);
});
