import { expect, type Page, test } from "@playwright/test";

import { navigateInApp } from "./support/app-screens";

const emailList = "section[aria-label='Email list']";

/** Leaves for another screen and comes back without reloading, so only the mock state remains. */
async function visitOverviewAndReturn(page: Page, returnPath: string) {
  await navigateInApp(page, "/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
  await navigateInApp(page, returnPath);
}

test("UI-02.2 a deleted email stays deleted after visiting another screen", async ({
  page,
}) => {
  await page.goto("/mail");
  await expect(page.locator(emailList).getByRole("link").first()).toBeVisible();
  await page.keyboard.press("j");
  await expect(page).toHaveURL(/\/mail\/[0-9A-Z]{26}$/);
  const deletedSubject =
    (await page
      .getByRole("main")
      .getByRole("heading", { level: 2 })
      .textContent()) ?? "";
  await page.keyboard.press("d");
  await expect(page.getByText("Email deleted").first()).toBeVisible();

  await visitOverviewAndReturn(page, "/mail");

  await expect(page.locator(emailList).getByRole("link").first()).toBeVisible();
  await expect(
    page.locator(emailList).getByText(deletedSubject, { exact: true }),
  ).toBeHidden();
});

test("UI-02.2 a created endpoint is still listed after visiting another screen", async ({
  page,
}) => {
  await page.goto("/webhooks/endpoints");
  await page.getByRole("button", { name: "Add endpoint" }).click();
  const addSheet = page.getByRole("dialog", { name: "Add an endpoint" });
  await addSheet.getByLabel("Name").fill("Mock state check");
  await addSheet.getByLabel("URL").fill("http://localhost:4100/hooks");
  await addSheet.getByRole("button", { name: "Add endpoint" }).click();
  await expect(
    page.getByRole("dialog", { name: "Mock state check" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await visitOverviewAndReturn(page, "/webhooks/endpoints");

  await expect(
    page.getByRole("row").filter({ hasText: "Mock state check" }),
  ).toContainText("http://localhost:4100/hooks");
});

test("UI-02.2 a replayed delivery is still in the log after visiting another screen", async ({
  page,
}) => {
  await page.goto("/webhooks/deliveries");
  await page
    .locator("tbody tr")
    .filter({ hasText: "Laravel inbound mail" })
    .first()
    .getByRole("link")
    .click();
  const deliveryDrawer = page.getByRole("dialog", { name: "Delivery" });
  await expect(deliveryDrawer.getByText("Event id")).toBeVisible();
  const originalUrl = page.url();
  await deliveryDrawer
    .getByRole("button", { name: "Replay", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Replay as-is" }).click();
  await expect(page).not.toHaveURL(originalUrl);
  const replayDeliveryId =
    new URL(page.url()).searchParams.get("delivery") ?? "";
  expect(replayDeliveryId).not.toBe("");
  await page.keyboard.press("Escape");

  await visitOverviewAndReturn(page, "/webhooks/deliveries");

  await expect(
    page.locator(`tbody tr a[href*='delivery=${replayDeliveryId}']`),
  ).toBeVisible();
});
