import { expect, test, type Page } from "@playwright/test";

/** Each traffic list, where it lives and what its toolbar calls the items. */
const trafficLists = [
  { screenPath: "/mail", itemsName: "emails" },
  { screenPath: "/sms", itemsName: "conversations" },
  { screenPath: "/sms/verify", itemsName: "verifications" },
  { screenPath: "/push", itemsName: "push notifications" },
  { screenPath: "/http", itemsName: "requests" },
  { screenPath: "/webhooks/deliveries", itemsName: "deliveries" },
  { screenPath: "/payments", itemsName: "payments" },
  { screenPath: "/payments/subscriptions", itemsName: "subscriptions" },
  { screenPath: "/logs", itemsName: "SMTP sessions" },
  { screenPath: "/logs?tab=http", itemsName: "API requests" },
];

function conversationList(page: Page) {
  return page.getByRole("list").filter({
    has: page.getByRole("checkbox", { name: /^Select conversation with/ }),
  });
}

for (const { screenPath, itemsName } of trafficLists) {
  test(`UI-14.1 ${screenPath} has the shared list toolbar`, async ({
    page,
  }) => {
    await page.goto(screenPath);

    await expect(
      page.getByRole("checkbox", { name: `Select all loaded ${itemsName}` }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Delete all ${itemsName}` }),
    ).toBeVisible();
  });
}

test("UI-14.1 X ticks the open conversation and the toolbar counts it", async ({
  page,
}) => {
  await page.goto("/sms");
  await conversationList(page).getByRole("link").first().click();

  await page.keyboard.press("x");

  await expect(page.getByText("1 selected")).toBeVisible();
});

test("UI-14.2 checked conversations are marked unread and read, then deleted after one confirmation", async ({
  page,
}) => {
  await page.goto("/sms");
  const rows = conversationList(page).getByRole("listitem");
  const rowCount = await rows.count();
  const firstRow = rows.first();
  const firstCheckbox = firstRow.getByRole("checkbox");

  await firstCheckbox.check();
  await page.getByRole("button", { name: "Mark unread" }).click();
  await expect(firstRow.getByRole("img", { name: "Unread" })).toBeVisible();

  await firstCheckbox.check();
  await page.getByRole("button", { name: "Mark read" }).click();
  await expect(firstRow.getByRole("img", { name: "Unread" })).toBeHidden();

  await firstCheckbox.check();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Delete 1 conversation?",
  });
  await confirmation.getByRole("button", { name: "Delete" }).click();
  await expect(rows).toHaveCount(rowCount - 1);
});

test("UI-14.4 Delete all names how many go and what stays, and Cancel keeps everything", async ({
  page,
}) => {
  await page.goto("/sms/verify");
  const rows = page.locator("table tbody tr");
  const rowCount = await rows.count();

  await page.getByRole("button", { name: "Delete all verifications" }).click();
  const confirmation = page.getByRole("alertdialog", {
    name: `Delete all ${rowCount} verifications?`,
  });
  await expect(confirmation).toContainText("Verify services stay.");
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(rows).toHaveCount(rowCount);

  await page.getByRole("button", { name: "Delete all verifications" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete all" })
    .click();
  await expect(page.getByText("No verifications yet")).toBeVisible();
});

test("UI-14.3 opening a push marks it read, and Mark unread brings it back", async ({
  page,
}) => {
  await page.goto("/push");
  const unreadLink = page.getByRole("link", { name: /^Unread: / }).first();
  const pushTitle = (await unreadLink.textContent())?.replace("Unread: ", "");

  await unreadLink.click();
  await page.keyboard.press("Escape");
  const pushRow = page
    .locator("table tbody tr")
    .filter({ hasText: pushTitle ?? "" });
  await expect(pushRow.getByRole("link", { name: /^Unread: / })).toHaveCount(0);

  await pushRow.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Mark unread" }).click();
  await expect(pushRow.getByRole("link", { name: /^Unread: / })).toHaveCount(1);
});

test("UI-14.6 Delete all traffic empties every list and keeps the configuration", async ({
  page,
}) => {
  await page.goto("/settings?section=general");
  await page.getByRole("button", { name: "Delete all traffic" }).click();
  await page
    .getByRole("alertdialog", { name: "Delete all traffic?" })
    .getByRole("button", { name: "Delete all traffic" })
    .click();

  // The demo keeps its data in the page, so move within the app, not by reloading.
  const sidebar = page.locator("[data-sidebar='sidebar']");
  await sidebar.getByRole("link", { name: /^Push/ }).click();
  await expect(page.getByText("No push notifications yet")).toBeVisible();
  await sidebar.getByRole("link", { name: /^HTTP Catcher/ }).click();
  await expect(page.getByText("No requests caught yet.")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Bin list" }).getByRole("button"),
  ).not.toHaveCount(0);
});
