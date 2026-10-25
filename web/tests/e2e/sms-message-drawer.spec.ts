import { expect, test, type Page } from "@playwright/test";

const threadList = "section[aria-label='Conversation list']";

async function openMessageDetails(page: Page, contactNumber: string) {
  await page.goto("/sms");
  await page.locator(threadList).getByText(contactNumber).click();
  await page.getByRole("button", { name: "Message actions" }).first().click();
  await page.getByRole("menuitem", { name: "Message details" }).click();

  return page.getByRole("dialog", { name: "Message details" });
}

test("SM-07.6 the drawer lists every status change, including one set by hand", async ({
  page,
}) => {
  const messageDrawer = await openMessageDetails(page, "+15005550101");
  const statusHistory = messageDrawer.getByRole("list", {
    name: "Status history",
  });
  await expect(statusHistory.getByRole("listitem")).toHaveText([
    /Queued/,
    /Sent/,
    /Undelivered.*30003 Unreachable destination handset/,
  ]);

  await messageDrawer
    .getByRole("button", { name: "Delivered", exact: true })
    .click();

  await expect(page.getByText("Status set to Delivered")).toBeVisible();
  // Read on view (SM-10.1) may add a Read entry after it, so Delivered need not be last.
  await expect(
    statusHistory.getByRole("listitem").filter({ hasText: /^Delivered/ }),
  ).toHaveCount(1);
});

test("a manual Failed status carries the picked error code", async ({
  page,
}) => {
  const messageDrawer = await openMessageDetails(page, "+14155550123");

  await messageDrawer
    .getByLabel("Error code for Undelivered and Failed")
    .click();
  await page.getByRole("option", { name: "30007 Message filtered" }).click();
  await messageDrawer
    .getByRole("button", { name: "Failed", exact: true })
    .click();

  await expect(
    messageDrawer
      .getByRole("list", { name: "Status history" })
      .getByRole("listitem")
      .last(),
  ).toHaveText(/Failed.*30007 Message filtered/);
});

test("SM-08.3 callback attempts are shown in the drawer, retries included", async ({
  page,
}) => {
  const messageDrawer = await openMessageDetails(page, "+15005550104");

  await messageDrawer.getByRole("tab", { name: "Callbacks (3)" }).click();
  const callbackAttempts = messageDrawer
    .getByRole("list", { name: "Callback attempts" })
    .getByRole("listitem");
  await expect(callbackAttempts).toHaveCount(3);
  await expect(callbackAttempts.nth(1)).toContainText("Attempt 1");
  await expect(callbackAttempts.nth(1)).toContainText("500");
  await expect(callbackAttempts.nth(2)).toContainText("Attempt 2");

  await callbackAttempts.nth(2).locator("summary").click();
  await expect(callbackAttempts.nth(2)).toContainText("MessageStatus=failed");
  await expect(callbackAttempts.nth(2)).toContainText("ErrorCode=30008");
});

test("the request tab shows the JSON the app sent and Escape closes the drawer", async ({
  page,
}) => {
  const messageDrawer = await openMessageDetails(page, "+15005550104");
  await expect(page).toHaveURL(/message=/);

  await messageDrawer.getByRole("tab", { name: "Request" }).click();
  await expect(
    messageDrawer.getByLabel("Request JSON", { exact: true }),
  ).toContainText('"To": "+15005550104"');
  await expect(
    messageDrawer.getByRole("link", { name: "Open in request log" }),
  ).toHaveAttribute("href", /\/logs\?request=/);

  await page.keyboard.press("Escape");
  await expect(messageDrawer).toBeHidden();
  await expect(page).not.toHaveURL(/message=/);
});
