import { expect, test } from "@playwright/test";

test("PL-01.4 the API reference opens from Help, finds an operation and gives its curl command", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Help" }).click();
  await page.getByRole("menuitem", { name: "API reference" }).click();
  await expect(
    page.getByRole("heading", { name: "API reference", level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Payments" })).toBeVisible();

  await page.getByLabel("Search the API").fill("subscription cancel");
  const operations = page.getByTestId("api-operation");
  await expect(operations).toHaveCount(1);
  await operations
    .first()
    .getByText("/api/v1/payments/subscriptions/{subscriptionId}/cancel")
    .click();

  await expect(operations.first()).toContainText("subscriptionId");
  await expect(operations.first()).toContainText(
    "PaymentSubscriptionCancelRequest",
  );
  await expect(operations.first().locator("pre")).toContainText("curl -X POST");
  await expect(
    page.getByRole("link", { name: "Download openapi.json" }),
  ).toHaveAttribute("href", "/api/openapi.json");
});
