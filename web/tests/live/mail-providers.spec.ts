import { expect, type Page, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

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

test.beforeEach(async ({ request }) => {
  await request.post("/api/v1/emails/providers/sendgrid/reset");
});

test("EM-18.1 the live Mail > Providers lists the six email built-ins without failing calls", async ({
  page,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/mail/providers");

  await expect(
    page.getByRole("heading", { name: "Email providers" }),
  ).toBeVisible();
  for (const providerName of [
    "SendGrid",
    "Mailgun",
    "Postmark",
    "Resend",
    "Amazon SES",
    "Brevo",
  ]) {
    await expect(providerRow(page, providerName)).toContainText("Built-in");
  }
  expect(failedApiCalls).toEqual([]);
});

test("EM-18.2 a live provider is added as a copy of a built-in and deleted", async ({
  page,
}) => {
  const providerName = `Live Acme Mail ${test.info().retry + 1}`;
  await page.goto("/mail/providers");
  await page.getByRole("button", { name: "Add provider" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a provider" });
  await addDialog.getByLabel("Name").fill(providerName);
  await addDialog.getByLabel("Start from").click();
  await page.getByRole("option", { name: "A copy of SendGrid" }).click();
  await addDialog.getByRole("button", { name: "Add provider" }).click();

  await expect(addDialog).toBeHidden();
  const providerSheet = page.getByRole("dialog", { name: providerName });
  await expect(providerSheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(providerSheet).toBeHidden();
  await expect(providerRow(page, providerName)).toContainText("Custom");

  await chooseRowAction(page, providerName, "Delete");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(providerRow(page, providerName)).toHaveCount(0);
});

test("EM-18.3 a live edited built-in shows Modified, and Reset to default puts it back", async ({
  page,
}) => {
  await page.goto("/mail/providers");
  await page
    .getByRole("button", { name: "Edit SendGrid", exact: true })
    .click();
  const providerSheet = page.getByRole("dialog", { name: "SendGrid" });
  await providerSheet.getByLabel("Host").fill("api.eu.sendgrid.com");
  await providerSheet.getByRole("button", { name: "Save provider" }).click();
  await expect(providerSheet).toBeHidden();
  await expect(providerRow(page, "SendGrid")).toContainText("Modified");

  await chooseRowAction(page, "SendGrid", "Reset to default");
  await page.getByRole("button", { name: "Reset to default" }).click();
  await expect(providerRow(page, "SendGrid")).not.toContainText("Modified");
});

test("EM-18.4 the live preview shows the stored message and SendGrid's answer", async ({
  page,
}) => {
  await page.goto("/mail/providers");
  await page
    .getByRole("button", { name: "Edit SendGrid", exact: true })
    .click();
  const providerSheet = page.getByRole("dialog", { name: "SendGrid" });
  await providerSheet.getByRole("tab", { name: "Preview" }).click();

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
