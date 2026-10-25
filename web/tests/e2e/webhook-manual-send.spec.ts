import { expect, type Page, test } from "@playwright/test";

const emailList = "section[aria-label='Email list']";
const threadList = "section[aria-label='Conversation list']";

async function openSendDialogForEmail(page: Page) {
  await page.goto("/mail");
  await page.locator(emailList).getByText("Welcome to Acme").first().click();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Send to webhook" }).click();
  const sendDialog = page.getByRole("dialog", { name: "Send to webhook" });
  await expect(
    sendDialog.getByRole("region", { name: "Rendered body" }),
  ).toBeVisible();

  return sendDialog;
}

test("WH-05.1 an email is sent to the chosen endpoint in the chosen format", async ({
  page,
}) => {
  const sendDialog = await openSendDialogForEmail(page);
  const renderedBody = sendDialog.getByRole("region", {
    name: "Rendered body",
  });
  await expect(renderedBody).toContainText('"Subject": "Welcome to Acme');

  await sendDialog.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: "Slack: incoming webhook" }).click();
  await expect(renderedBody).toContainText('"blocks"');

  await sendDialog.getByRole("button", { name: "Send", exact: true }).click();
  const sendResult = sendDialog.getByTestId("sent-delivery-result");
  await expect(sendResult).toContainText("Sent to Laravel inbound mail");

  await sendResult.getByRole("link", { name: "Open delivery" }).click();
  const deliveryDrawer = page.getByRole("dialog", { name: "Delivery" });
  await expect(deliveryDrawer).toContainText("manual");
  await expect(deliveryDrawer).toContainText('"blocks"');
});

test("WH-05.1 an SMS can be sent to a webhook from its message menu, starting with an SMS endpoint", async ({
  page,
}) => {
  await page.goto("/sms");
  await page.locator(threadList).getByRole("link").first().click();
  await page.getByRole("button", { name: "Message actions" }).first().click();
  await page.getByRole("menuitem", { name: "Send to webhook" }).click();
  const sendDialog = page.getByRole("dialog", { name: "Send to webhook" });
  await expect(
    sendDialog.getByRole("region", { name: "Rendered body" }),
  ).toBeVisible();

  await expect(
    sendDialog.getByRole("combobox", { name: "Endpoint" }),
  ).toHaveText("SMS status callbacks");
  await expect(
    sendDialog.getByRole("list", { name: "Body problems" }),
  ).toBeHidden();
  await sendDialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(sendDialog.getByTestId("sent-delivery-result")).toContainText(
    "Sent to SMS status callbacks",
  );
});

test("WH-05.5 Prompt variables start at their default and overrides win for one send", async ({
  page,
}) => {
  const sendDialog = await openSendDialogForEmail(page);
  await expect(sendDialog.getByLabel("vars.reason")).toHaveValue("manual test");

  await sendDialog.getByRole("combobox", { name: "Format" }).click();
  await page
    .getByRole("option", { name: "Postmark inbound with tenant header" })
    .click();
  const renderedHeaders = sendDialog.getByRole("region", {
    name: "Rendered headers",
  });
  await expect(renderedHeaders).toContainText("acme");

  await sendDialog.getByRole("button", { name: "Add override" }).click();
  await sendDialog.getByLabel("Override 1 name").fill("tenant_id");
  await sendDialog.getByLabel("Override 1 value").fill("globex");
  await expect(renderedHeaders).toContainText("globex");
});

test("WH-05.6 an edited body is sent as written and the result can be saved", async ({
  page,
}) => {
  const sendDialog = await openSendDialogForEmail(page);
  await sendDialog.getByRole("switch", { name: "Edit body" }).click();
  const bodyEditor = sendDialog.getByRole("textbox", { name: "Edited body" });
  await expect(bodyEditor).toContainText("Welcome to Acme");
  await bodyEditor.fill('{ "note": "edited by hand" }');

  await sendDialog.getByRole("button", { name: "Send", exact: true }).click();
  const sendResult = sendDialog.getByTestId("sent-delivery-result");
  await expect(sendResult).toContainText("Sent to");

  await sendResult.getByRole("button", { name: "Save" }).click();
  const nameDialog = page.getByRole("dialog", { name: "Save this request" });
  await nameDialog.getByLabel("Name").fill("Edited welcome");
  await nameDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await sendResult.getByRole("link", { name: "Open delivery" }).click();
  await expect(page.getByRole("dialog", { name: "Delivery" })).toContainText(
    "edited by hand",
  );
});

test("WH-05.3 the composer sends a request started from a template preset", async ({
  page,
}) => {
  await page.goto("/webhooks/composer");
  await page.getByRole("combobox", { name: "Preset" }).click();
  await page.getByRole("option", { name: "Slack: incoming webhook" }).click();
  const rawEditor = page.getByRole("textbox", { name: "Raw body" });
  await expect(rawEditor).toContainText('"blocks"');
  await expect(page.getByLabel("Content type")).toHaveValue("application/json");

  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByTestId("sent-delivery-result")).toContainText(
    "Sent to Laravel inbound mail",
  );
});

test("WH-05.5 the composer asks for Prompt variables and WH-05.6 errors block sending", async ({
  page,
}) => {
  await page.goto("/webhooks/composer");
  const rawEditor = page.getByRole("textbox", { name: "Raw body" });
  await expect(rawEditor).toBeVisible();
  await page.getByLabel("Content type").fill("text/plain");
  await rawEditor.fill("Reason: {{ vars.reason }}");
  const renderedBody = page.getByRole("region", { name: "Rendered body" });
  await expect(renderedBody).toContainText("Reason: manual test");

  await page.getByLabel("vars.reason").fill("smoke run");
  await expect(renderedBody).toContainText("Reason: smoke run");

  await rawEditor.fill("{{ nope() }}");
  await expect(
    page.getByText("Fix the errors in the preview to send."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeDisabled();
});
