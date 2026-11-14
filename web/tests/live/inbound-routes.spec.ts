import { expect, type Page, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

const routeRows = (page: Page) => page.getByTestId("inbound-route-row");

test("WH-12.7 live routes are listed with their Mailgun expression, previewed and deleted", async ({
  page,
  request,
}) => {
  const routeName = `Live support ${test.info().retry + 1}`;
  await request.post("/api/v1/emails/inbound", {
    data: {
      from: "sam@example.test",
      to: ["support@live.app.test"],
      subject: "Help",
      text: "Hello",
    },
  });
  const createResponse = await request.post("/api/v1/inbound-routes", {
    data: {
      priority: 1,
      description: routeName,
      filter: { kind: "match_recipient", pattern: "support@(?P<team>.+)" },
      actions: [{ kind: "stop" }],
    },
  });
  expect(createResponse.status()).toBe(201);
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/webhooks/inbound-routes");
  const routeRow = routeRows(page).filter({ hasText: routeName });
  await expect(routeRow).toContainText(
    'match_recipient("support@(?P<team>.+)")',
  );
  await expect(routeRow).toContainText("stop()");

  await page.getByRole("button", { name: "Add route" }).click();
  const routeSheet = page.getByRole("dialog", { name: "Add route" });
  await routeSheet.getByLabel("Pattern").fill("support@(?P<team>.+)");
  await expect(routeSheet.getByTestId("route-match-count")).toContainText(
    "Matches",
  );
  await expect(routeSheet.getByText("team = live.app.test")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: `Delete ${routeName}` }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(routeRow).toHaveCount(0);
  expect(failedApiCalls).toEqual([]);
});
