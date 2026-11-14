import { expect, type Page, test } from "@playwright/test";

import { replaceCodeEditorText } from "./support/code-editor";

const emailList = "section[aria-label='Email list']";
const threadList = "section[aria-label='Conversation list']";
// The demo email "Your verification code" was sent by the app, so it can be simulated.
const sentSubject = "Your verification code";
const editedBody = '{"note":"typed by hand"}';

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

async function openSmsDrawer(page: Page, contactNumber: string) {
  await page.goto("/sms");
  await page.locator(threadList).getByText(contactNumber).click();
  await page.getByRole("button", { name: "Message actions" }).first().click();
  await page.getByRole("menuitem", { name: "Message details" }).click();

  return page.getByRole("dialog", { name: "Message details" });
}

async function openEditedDelivery(page: Page, endpointName: string) {
  await navigateInApp(page, "/webhooks/deliveries");
  const editedRow = page
    .getByRole("row")
    .filter({ hasText: endpointName })
    .filter({ hasText: "edited" });
  await expect(editedRow).toHaveCount(1);
  await editedRow.getByRole("link").first().click();

  return page.getByRole("dialog", { name: "Delivery" });
}

test("WH-14.2 each webhook in a composer row has a Payload showing its request", async ({
  page,
}) => {
  const messageDrawer = await openSmsDrawer(page, "+15005550101");
  await messageDrawer
    .getByRole("group", { name: "Webhooks" })
    .getByRole("button", { name: "Payload to SMS status callbacks" })
    .click();

  const payloadDialog = page.getByRole("dialog", {
    name: "Payload to SMS status callbacks",
  });
  await expect(payloadDialog.getByTestId("payload-url")).not.toBeEmpty();
  await expect(
    payloadDialog.getByRole("region", { name: "Headers" }),
  ).toBeVisible();
  await expect(
    payloadDialog.getByRole("textbox", { name: "Payload body" }),
  ).not.toBeEmpty();
  await expect(payloadDialog.getByText("Edited", { exact: true })).toHaveCount(
    0,
  );
});

test("WH-14.3 an edited payload is marked Edited, Reset restores it, and it is delivered as written", async ({
  page,
}) => {
  const messageDrawer = await openSmsDrawer(page, "+15005550101");
  const webhooksRow = messageDrawer.getByRole("group", { name: "Webhooks" });
  await webhooksRow
    .getByRole("button", { name: "Payload to SMS status callbacks" })
    .click();
  const payloadDialog = page.getByRole("dialog", {
    name: "Payload to SMS status callbacks",
  });
  const bodyEditor = payloadDialog.getByRole("textbox", {
    name: "Payload body",
  });
  await expect(bodyEditor).not.toBeEmpty();
  const renderedText = await bodyEditor.textContent();

  await replaceCodeEditorText(bodyEditor, editedBody);
  await expect(
    payloadDialog.getByText("Edited", { exact: true }),
  ).toBeVisible();
  await payloadDialog.getByRole("button", { name: "Reset" }).click();
  await expect(bodyEditor).toHaveText(renderedText ?? "");
  await expect(payloadDialog.getByText("Edited", { exact: true })).toHaveCount(
    0,
  );

  await replaceCodeEditorText(bodyEditor, editedBody);
  await payloadDialog.getByRole("button", { name: "Use this payload" }).click();
  await expect(webhooksRow.getByText("Edited", { exact: true })).toBeVisible();
  await messageDrawer.getByRole("button", { name: "Delivered" }).click();
  await expect(page.getByText("Status set to Delivered")).toBeVisible();

  await page.keyboard.press("Escape");
  const deliveryDrawer = await openEditedDelivery(page, "SMS status callbacks");
  await expect(deliveryDrawer).toContainText("typed by hand");
  await expect(deliveryDrawer).toContainText("payload edited before sending");
});

test("WH-14.2 WH-14.3 the picker edits the payload of a chosen endpoint for one simulation", async ({
  page,
}) => {
  await page.goto("/mail");
  await page.locator(emailList).getByText(sentSubject, { exact: true }).click();
  await page.getByRole("button", { name: "Simulate an event" }).click();
  await page
    .getByRole("menuitem", { name: "Choose webhooks for Simulate delivered" })
    .click();

  const picker = page.getByRole("dialog", { name: "Choose webhooks" });
  for (const checkedBox of await picker
    .getByRole("checkbox", { checked: true })
    .all()) {
    await checkedBox.uncheck();
  }
  await expect(
    picker.getByRole("button", { name: "Payload to Shop payments" }),
  ).toHaveCount(0);
  await picker.getByRole("checkbox", { name: "Send to Shop payments" }).check();
  await picker
    .getByRole("button", { name: "Payload to Shop payments" })
    .click();
  const payloadDialog = page.getByRole("dialog", {
    name: "Payload to Shop payments",
  });
  await replaceCodeEditorText(
    payloadDialog.getByRole("textbox", { name: "Payload body" }),
    editedBody,
  );
  await payloadDialog.getByRole("button", { name: "Use this payload" }).click();
  await expect(picker.getByText("Edited", { exact: true })).toBeVisible();
  await picker.getByRole("button", { name: "Simulate delivered" }).click();
  await expect(page.getByText("Simulated: delivered")).toBeVisible();

  const deliveryDrawer = await openEditedDelivery(page, "Shop payments");
  await expect(deliveryDrawer).toContainText("typed by hand");
});
