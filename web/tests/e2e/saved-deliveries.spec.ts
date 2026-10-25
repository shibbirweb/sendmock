import { expect, type Page, test } from "@playwright/test";

/** Client-side navigation, so the in-browser mock data survives. */
async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

function findSavedItem(page: Page, savedName: string) {
  return page.getByTestId("saved-delivery").filter({ hasText: savedName });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/webhooks/saved");
  await expect(findSavedItem(page, "Twilio STOP reply")).toBeVisible();
});

test("WH-10.4 saved deliveries show their stored request and can be searched", async ({
  page,
}) => {
  const stopReply = findSavedItem(page, "Twilio STOP reply");
  await expect(stopReply).toContainText("http://localhost:8000/sms/inbound");
  await expect(stopReply).toContainText("Twilio: inbound SMS");

  await stopReply
    .getByRole("button", { name: /Twilio STOP reply/, expanded: false })
    .click();
  await expect(stopReply.getByRole("region", { name: "Body" })).toContainText(
    "STOP",
  );
  await expect(
    stopReply.getByRole("region", { name: "Headers" }),
  ).toContainText("application/x-www-form-urlencoded");

  await page.getByLabel("Search saved deliveries").fill("invoice");
  await expect(
    page.getByText("No saved delivery has that name."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(stopReply).toBeVisible();
});

test("WH-10.4 saved deliveries can be renamed and deleted", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Rename Twilio STOP reply" }).click();
  const renameDialog = page.getByRole("dialog", {
    name: "Rename saved delivery",
  });
  await renameDialog.getByLabel("Name").fill("STOP keyword reply");
  await renameDialog.getByRole("button", { name: "Rename" }).click();
  await expect(findSavedItem(page, "STOP keyword reply")).toBeVisible();

  await page.getByRole("button", { name: "Delete STOP keyword reply" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("Nothing saved yet")).toBeVisible();
});

test("WH-10.2 a saved delivery can be sent to any endpoint and saved as a template", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Send Twilio STOP reply" }).click();
  const sendDialog = page.getByRole("dialog", {
    name: 'Send "Twilio STOP reply"',
  });
  await sendDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Team Slack alerts" }).click();
  await sendDialog.getByRole("button", { name: "Send", exact: true }).click();
  const sendResult = sendDialog.getByTestId("sent-delivery-result");
  await expect(sendResult).toContainText("200");
  await expect(sendResult).toContainText("Sent to Team Slack alerts");
  await sendResult.getByRole("link", { name: "Open delivery" }).click();
  const deliveryDrawer = page.getByRole("dialog", { name: "Delivery" });
  await expect(
    deliveryDrawer.getByRole("region", { name: "Request", exact: true }),
  ).toContainText("http://127.0.0.1:8025/catch/slack");
  await expect(
    deliveryDrawer.getByText("manual", { exact: true }),
  ).toBeVisible();

  await navigateInApp(page, "/webhooks/saved");
  await page
    .getByRole("button", { name: "Save as template Twilio STOP reply" })
    .click();
  const templateDialog = page.getByRole("dialog", { name: "Save as template" });
  await templateDialog.getByLabel("Name").fill("STOP reply template");
  await templateDialog.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByText("Template saved")).toBeVisible();

  await navigateInApp(page, "/webhooks/endpoints");
  await page.getByRole("button", { name: "Edit Team Slack alerts" }).click();
  await page.getByRole("tab", { name: "Request" }).click();
  await page
    .getByRole("dialog", { name: "Team Slack alerts" })
    .getByRole("combobox", { name: "Template" })
    .click();
  await expect(
    page.getByRole("option", { name: "STOP reply template" }),
  ).toBeVisible();
});

test("WH-10.1 a delivery saved from the log survives reset", async ({
  page,
}) => {
  await navigateInApp(page, "/webhooks/deliveries");
  await page
    .locator("tbody tr")
    .filter({ hasText: "Team Slack alerts" })
    .first()
    .getByRole("link")
    .click();
  await page
    .getByRole("dialog", { name: "Delivery" })
    .getByRole("button", { name: "Save" })
    .click();
  const saveDialog = page.getByRole("dialog", { name: "Save this delivery" });
  await saveDialog.getByLabel("Name").fill("Slack alert sample");
  await saveDialog.getByRole("button", { name: "Save" }).click();
  await expect(saveDialog).toBeHidden();

  await navigateInApp(page, "/settings?section=general");
  await page.getByRole("button", { name: "Reset to seed" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reset" })
    .click();
  await expect(page.getByText("Reset to the seed state")).toBeVisible();

  await navigateInApp(page, "/webhooks/saved");
  await expect(findSavedItem(page, "Slack alert sample")).toContainText(
    "From Team Slack alerts",
  );
});
