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
