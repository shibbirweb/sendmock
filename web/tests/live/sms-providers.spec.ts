import { expect, type Page, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

function providerRow(page: Page, providerName: string) {
  return page
    .getByTestId("message-provider-row")
    .filter({ has: page.getByText(providerName, { exact: true }) });
}

test("SM-16.2 a live custom SMS provider is added as a copy of Twilio and deleted", async ({
  page,
}) => {
  const providerName = `Live Twilio EU ${test.info().retry + 1}`;
  const failedApiCalls = watchFailedApiCalls(page);
  await page.goto("/sms/providers");
  await page.getByRole("button", { name: "Add provider", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a provider" });
  await addDialog.getByLabel("Name").fill(providerName);
  await addDialog.getByLabel("Start from").click();
  await page
    .getByRole("option", { name: "A copy of Twilio", exact: true })
    .click();
  await addDialog.getByRole("button", { name: "Add provider" }).click();

  await expect(addDialog).toBeHidden();
  const providerSheet = page.getByRole("dialog", { name: providerName });
  await expect(providerSheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(providerSheet).toBeHidden();
  await expect(providerRow(page, providerName)).toContainText("Custom");

  await page
    .getByRole("button", { name: `More for ${providerName}`, exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(providerRow(page, providerName)).toHaveCount(0);
  expect(failedApiCalls).toEqual([]);
});
