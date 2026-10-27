import { expect, type Page, test } from "@playwright/test";

function providerRow(page: Page, providerName: string) {
  return page
    .getByTestId("message-provider-row")
    .filter({ has: page.getByText(providerName, { exact: true }) });
}

async function chooseRowAction(
  page: Page,
  providerName: string,
  actionName: string,
) {
  await page
    .getByRole("button", { name: `More for ${providerName}`, exact: true })
    .click();
  await page.getByRole("menuitem", { name: actionName }).click();
}

test("EM-18.1 Mail > Providers lists the six email built-ins", async ({
  page,
}) => {
  await page.goto("/mail/providers");

  await expect(
    page.getByRole("heading", { name: "Email providers" }),
  ).toBeVisible();
  await expect(page.getByTestId("message-provider-row")).toHaveCount(6);
  await expect(providerRow(page, "SendGrid")).toContainText("Built-in");
  await expect(providerRow(page, "Amazon SES")).toContainText("ses");
});

test("SM-16.1 SMS > Providers lists the built-ins and the demo's custom provider", async ({
  page,
}) => {
  await page.goto("/sms/providers");

  await expect(page.getByTestId("message-provider-row")).toHaveCount(6);
  await expect(providerRow(page, "SSL Wireless")).toContainText("Custom");
  await expect(providerRow(page, "Twilio")).toContainText("Built-in");
});

test("EM-18.2 a provider is added as a copy of a built-in", async ({
  page,
}) => {
  await page.goto("/mail/providers");
  await page.getByRole("button", { name: "Add provider" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a provider" });
  await addDialog.getByLabel("Name").fill("Acme Mail");
  await expect(addDialog.getByLabel("Key")).toHaveValue("acme_mail");
  await addDialog.getByLabel("Start from").click();
  await page.getByRole("option", { name: "A copy of SendGrid" }).click();
  await addDialog.getByRole("button", { name: "Add provider" }).click();

  await expect(addDialog).toBeHidden();
  await expect(providerRow(page, "Acme Mail")).toContainText("Custom");
});

test("SM-16.3 a built-in is removed and restored, and a custom provider is deleted", async ({
  page,
}) => {
  await page.goto("/sms/providers");

  await chooseRowAction(page, "Vonage", "Remove");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  const removedGroup = page.getByRole("region", { name: "Removed" });
  await expect(removedGroup).toContainText("Vonage");
  await expect(providerRow(page, "Vonage")).toHaveCount(0);

  await removedGroup.getByRole("button", { name: "Restore" }).click();
  await expect(providerRow(page, "Vonage")).toBeVisible();
  await expect(removedGroup).toBeHidden();

  await chooseRowAction(page, "SSL Wireless", "Delete");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(providerRow(page, "SSL Wireless")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Removed" })).toBeHidden();
});

async function openProvider(page: Page, providerName: string) {
  await page
    .getByRole("button", { name: `Edit ${providerName}`, exact: true })
    .click();

  return page.getByRole("dialog", { name: providerName });
}

test("EM-18.3 an edited built-in shows Modified, and Reset to default puts it back", async ({
  page,
}) => {
  await page.goto("/mail/providers");
  const providerSheet = await openProvider(page, "SendGrid");
  await providerSheet.getByLabel("Host").fill("api.eu.sendgrid.com");
  await providerSheet.getByRole("button", { name: "Save provider" }).click();
  await expect(providerSheet).toBeHidden();
  await expect(providerRow(page, "SendGrid")).toContainText("Modified");

  await chooseRowAction(page, "SendGrid", "Reset to default");
  await page.getByRole("button", { name: "Reset to default" }).click();
  await expect(providerRow(page, "SendGrid")).not.toContainText("Modified");
});

test("EM-18.4 the preview shows the stored message and the answer, and a refused request stores nothing", async ({
  page,
}) => {
  await page.goto("/mail/providers");
  const providerSheet = await openProvider(page, "SendGrid");
  await providerSheet.getByRole("tab", { name: "Preview" }).click();

  await expect(
    providerSheet.getByTestId("provider-stored-message"),
  ).toContainText("ana@example.test");
  await expect(
    providerSheet.getByTestId("provider-preview-response"),
  ).toContainText("202");

  await providerSheet.getByLabel("Sample body").fill("{}");
  await expect(
    providerSheet.getByTestId("provider-stored-message"),
  ).toContainText("Nothing is stored");
  await expect(
    providerSheet.getByTestId("provider-preview-response"),
  ).toContainText("400");
});

test("SM-16.4 a template error is shown and blocks Save", async ({ page }) => {
  await page.goto("/sms/providers");
  const providerSheet = await openProvider(page, "Twilio");
  await providerSheet.getByRole("tab", { name: "Responses" }).click();
  await providerSheet.getByLabel("Message id").fill("SM{{ random_hex(32) ");

  await expect(providerSheet.getByText(/template error/)).toBeVisible();
  await expect(
    providerSheet.getByRole("button", { name: "Save provider" }),
  ).toBeDisabled();
});

test("an email sent through a provider links to it, and the link opens its sheet", async ({
  page,
}) => {
  await page.goto("/mail");
  await page
    .getByRole("link", { name: /Welcome to Acme: here is what is new/ })
    .first()
    .click();
  await page.getByRole("link", { name: "SendGrid", exact: true }).click();

  await expect(page).toHaveURL(/\/mail\/providers\?provider=sendgrid/);
  await expect(page.getByRole("dialog", { name: "SendGrid" })).toBeVisible();
});

test("Settings > Connection lists the enabled SMS providers, custom ones included", async ({
  page,
}) => {
  await page.goto("/settings?section=connection");
  const smsProviderApis = page.getByRole("region", {
    name: "SMS provider APIs",
  });

  await expect(smsProviderApis).toContainText("SSL Wireless");
  await expect(smsProviderApis).toContainText(
    "http://127.0.0.1:8025/providers/sslwireless",
  );
});
