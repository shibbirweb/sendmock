import { expect, test } from "@playwright/test";

const pushTable = "table";

test("PN-01.6 the Push screen lists notifications and filters them by provider and status", async ({
  page,
}) => {
  await page.goto("/push");
  const rows = page.locator(pushTable).locator("tbody tr");
  await expect(rows).toHaveCount(4);

  await page.getByRole("button", { name: "Expo", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Rahim sent you a message");

  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "Failed", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Your sign-in code");

  await page.getByRole("button", { name: "Failed", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Filter by device token" })
    .fill("external_id:user-7");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Flash sale");
});

test("PN-01.6 a notification opens with its phone preview, data, request and answer", async ({
  page,
}) => {
  await page.goto("/push");
  await page.getByRole("link", { name: "Flash sale" }).click();
  const drawer = page.getByRole("dialog", { name: "Push notification" });

  const preview = drawer.getByRole("region", { name: "Phone preview" });
  await expect(preview.locator("[data-preview-style='ios']")).toContainText(
    "30% off everything until midnight.",
  );
  await drawer.getByRole("radio", { name: "Android" }).click();
  await expect(preview.locator("[data-preview-style='android']")).toBeVisible();
  await expect(drawer.getByRole("region", { name: "Data" })).toContainText(
    "flash-sale",
  );
  await expect(drawer.getByRole("region", { name: "Request" })).toContainText(
    "include_aliases",
  );
  await expect(
    drawer.getByRole("region", { name: "Answer (200)" }),
  ).toContainText("b98881cc-1e94-4366-bbd9-db8f3429292b");
  await expect(page).toHaveURL(/push=/);
});

test("PN-01.6 deleting a notification removes it and Clear all empties the list", async ({
  page,
}) => {
  await page.goto("/push");
  const rows = page.locator(pushTable).locator("tbody tr");
  await expect(rows).toHaveCount(4);

  await page.getByRole("link", { name: "Your order shipped" }).click();
  await page
    .getByRole("dialog", { name: "Push notification" })
    .getByRole("button", { name: "Delete" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(rows).toHaveCount(3);

  await page.getByRole("button", { name: "Clear all" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Clear all" })
    .click();
  await expect(page.getByText("No push notifications yet")).toBeVisible();
});
