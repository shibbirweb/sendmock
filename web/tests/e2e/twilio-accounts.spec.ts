import { expect, type Page, test } from "@playwright/test";

async function openTwilioAccounts(page: Page) {
  await page.goto("/sms/providers");
  await page.getByRole("button", { name: "Edit Twilio", exact: true }).click();
  const providerSheet = page.getByRole("dialog", { name: "Twilio" });
  await providerSheet.getByRole("tab", { name: "Accounts" }).click();

  return providerSheet;
}

test("SM-19.4 the Twilio provider's Accounts tab adds, edits, reveals and removes a subaccount", async ({
  page,
}) => {
  const providerSheet = await openTwilioAccounts(page);
  const subaccounts = providerSheet.getByRole("list", { name: "Subaccounts" });
  await expect(subaccounts).toContainText("Acme Clinic");

  await providerSheet.getByRole("button", { name: "Add subaccount" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add subaccount" });
  await addDialog.getByLabel("Name").fill("Bayside Dental");
  await addDialog.getByLabel("Auth token").fill("bayside-token-7a1c");
  await addDialog.getByRole("button", { name: "Add subaccount" }).click();
  await expect(addDialog).toBeHidden();
  await expect(subaccounts).toContainText("Bayside Dental");
  await expect(subaccounts).toContainText("••••7a1c");
  await expect(subaccounts).not.toContainText("bayside-token-7a1c");

  await providerSheet
    .getByRole("button", { name: "Edit Bayside Dental", exact: true })
    .click();
  const editDialog = page.getByRole("dialog", { name: "Edit subaccount" });
  await editDialog.getByLabel("Status").click();
  await page.getByRole("option", { name: "Suspended" }).click();
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(editDialog).toBeHidden();
  await expect(subaccounts).toContainText("Suspended");

  await providerSheet
    .getByRole("button", { name: "Reveal the token of Bayside Dental" })
    .click();
  await page.getByRole("button", { name: "Reveal", exact: true }).click();
  await expect(subaccounts).toContainText("bayside-token-7a1c");

  await providerSheet
    .getByRole("button", { name: "Remove Bayside Dental", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(subaccounts).not.toContainText("Bayside Dental");
});

test("SM-19.4 only the Twilio provider has an Accounts tab", async ({
  page,
}) => {
  await page.goto("/sms/providers");
  await page.getByRole("button", { name: "Edit Vonage", exact: true }).click();
  const providerSheet = page.getByRole("dialog", { name: "Vonage" });

  await expect(
    providerSheet.getByRole("tab", { name: "General" }),
  ).toBeVisible();
  await expect(
    providerSheet.getByRole("tab", { name: "Accounts" }),
  ).toHaveCount(0);
});
