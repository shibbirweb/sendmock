import { expect, type Page, test } from "@playwright/test";

async function sendSampleEmail(page: Page) {
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("button", { name: "Sample email" }).click();
  await page.keyboard.press("Escape");
}

async function openNotificationSettings(page: Page) {
  await page.evaluate(() => {
    window.history.pushState({}, "", "/settings?section=notifications");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByLabel("Show pop-up toasts")).toBeVisible();
}

const bell = (page: Page) =>
  page.getByRole("button", { name: /^Notifications/ });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Activity, last 24 hours")).toBeVisible();
});

test("UI-08.3 the bell lists notifications newest first, linking to each; opening marks them read, Clear all empties it", async ({
  page,
}) => {
  await sendSampleEmail(page);
  await expect(bell(page)).toHaveAccessibleName(/^Notifications, \d+ unread$/);
  await expect(page.getByTestId("notification-count")).toBeVisible();

  await bell(page).click();
  const notificationList = page.getByRole("list", { name: "Notifications" });
  await expect(notificationList.getByRole("listitem").first()).toContainText(
    "New email",
  );
  await expect(bell(page)).toHaveAccessibleName("Notifications");
  await notificationList.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/mail\/[0-9A-Z]+$/);

  await bell(page).click();
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(
    page.getByText(
      "No notifications yet. New emails, SMS and failed webhook deliveries show up here.",
    ),
  ).toBeVisible();
});

test("UI-08.1 UI-08.2 with toasts off, no toast appears and the bell still counts", async ({
  page,
}) => {
  await openNotificationSettings(page);
  await page.getByLabel("Show pop-up toasts").click();
  await sendSampleEmail(page);

  await expect(bell(page)).toHaveAccessibleName(/^Notifications, \d+ unread$/);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);

  await page.reload();
  await openNotificationSettings(page);
  await expect(page.getByLabel("Show pop-up toasts")).not.toBeChecked();
});

test("UI-08.4 toasts appear where Settings > Notifications puts them", async ({
  page,
}) => {
  await openNotificationSettings(page);
  await page.getByText("Bottom left", { exact: true }).click();
  const previewToast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Toasts appear here" });
  await expect(previewToast).toBeVisible();
  await expect(page.locator("[data-sonner-toaster]")).toHaveAttribute(
    "data-y-position",
    "bottom",
  );
  await expect(page.locator("[data-sonner-toaster]")).toHaveAttribute(
    "data-x-position",
    "left",
  );
});
