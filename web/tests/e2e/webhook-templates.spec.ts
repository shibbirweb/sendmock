import { readFile } from "node:fs/promises";

import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/webhooks/templates");
  await expect(findTemplateCard(page, "Native SendMock JSON")).toBeVisible();
});

function findTemplateCard(page: Page, templateName: string) {
  return page.getByTestId("template-card").filter({ hasText: templateName });
}

async function openTemplate(page: Page, templateName: string) {
  await findTemplateCard(page, templateName).click();
  const templateSheet = page.getByRole("dialog", { name: templateName });
  await expect(
    templateSheet.getByRole("region", { name: "Body template" }),
  ).toBeVisible();

  return templateSheet;
}

test("WH-08.3 the gallery filters by category, name or service, and event", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "SMS providers" }).click();
  await expect(page).toHaveURL(/category=sms-provider/);
  await expect(findTemplateCard(page, "Twilio: inbound SMS")).toBeVisible();
  await expect(findTemplateCard(page, "Postmark: inbound")).toBeHidden();

  await page.getByRole("tab", { name: "All" }).click();
  await page.getByLabel("Search templates").fill("slack");
  await expect(page.getByTestId("template-card")).toHaveCount(1);
  await expect(findTemplateCard(page, "Slack: incoming webhook")).toBeVisible();

  await page.getByLabel("Search templates").fill("");
  await page.getByRole("combobox", { name: "Event filter" }).click();
  await page
    .getByRole("option", { name: "webhook.failed", exact: true })
    .click();
  await expect(findTemplateCard(page, "Ops alert (plain text)")).toBeVisible();
  await expect(findTemplateCard(page, "Twilio: inbound SMS")).toBeHidden();

  await page.getByLabel("Search templates").fill("nothing like this");
  await expect(
    page.getByText("No template matches these filters."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filter" }).click();
  await expect(findTemplateCard(page, "Twilio: inbound SMS")).toBeVisible();
});

test("WH-08.4 the detail shows the template and previews it with warnings", async ({
  page,
}) => {
  const templateSheet = await openTemplate(page, "Telegram: bot message");

  await expect(templateSheet.getByLabel("Template events")).toContainText(
    "sms.inbound",
  );
  await expect(templateSheet.getByLabel("Required variables")).toContainText(
    "telegram_chat_id",
  );
  await expect(templateSheet).toContainText("POST · application/json");
  await expect(
    templateSheet.getByRole("link", { name: /Webhook reference/ }),
  ).toHaveAttribute("href", "https://core.telegram.org/bots/api#sendmessage");
  await expect(templateSheet).toContainText(
    "Verified against the docs as of 2026-09-30",
  );
  await expect(templateSheet.getByLabel("Preview warnings")).toContainText(
    "Undefined variable: vars.telegram_chat_id",
  );
  await expect(
    templateSheet.getByRole("region", { name: "Rendered body" }),
  ).toContainText("Your verification code");
});

test("WH-08.4 the preview renders against a picked recent message", async ({
  page,
}) => {
  const templateSheet = await openTemplate(page, "Postmark: inbound");
  await templateSheet.getByLabel("Preview with").click();
  const firstEmailOption = page
    .getByRole("option", { name: /^Email: / })
    .first();
  const emailSubject = ((await firstEmailOption.textContent()) ?? "").replace(
    /^Email: /,
    "",
  );
  await firstEmailOption.click();

  await expect(
    templateSheet.getByRole("region", { name: "Rendered body" }),
  ).toContainText(emailSubject);
});

test("WH-08.5 Use in new endpoint opens the endpoint sheet with the template", async ({
  page,
}) => {
  const templateSheet = await openTemplate(page, "Slack: incoming webhook");
  await templateSheet
    .getByRole("link", { name: "Use in new endpoint" })
    .click();

  const addSheet = page.getByRole("dialog", { name: "Add an endpoint" });
  await expect(addSheet).toBeVisible();
  await addSheet.getByRole("tab", { name: "Template" }).click();
  await expect(addSheet.getByRole("combobox")).toHaveText(
    "Slack: incoming webhook",
  );
  await expect(page).toHaveURL(/\/webhooks\/endpoints$/);
});

test("WH-09.1 a built-in template can be cloned into a custom one", async ({
  page,
}) => {
  const templateSheet = await openTemplate(page, "Postmark: inbound");
  await templateSheet.getByRole("button", { name: "Clone" }).click();
  const cloneDialog = page.getByRole("dialog", { name: "Clone template" });
  await cloneDialog.getByLabel("Name").fill("Postmark with tenant");
  await cloneDialog.getByRole("button", { name: "Clone" }).click();

  const clonedSheet = page.getByRole("dialog", {
    name: "Postmark with tenant",
  });
  await expect(clonedSheet).toContainText("Custom");
  await expect(
    clonedSheet.getByRole("region", { name: "Body template" }),
  ).toContainText('"TextBody"');
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Custom" }).click();
  await expect(findTemplateCard(page, "Postmark with tenant")).toBeVisible();
});

test("WH-09.6 deleting a template in use detaches its endpoints first", async ({
  page,
}) => {
  await page.goto("/webhooks/endpoints");
  await page.getByRole("button", { name: "Edit Team Slack alerts" }).click();
  const endpointSheet = page.getByRole("dialog", { name: "Team Slack alerts" });
  await endpointSheet.getByRole("tab", { name: "Template" }).click();
  await endpointSheet.getByRole("combobox").click();
  await page
    .getByRole("option", { name: "Postmark inbound with tenant header" })
    .click();
  await endpointSheet.getByRole("button", { name: "Save changes" }).click();
  await expect(endpointSheet).toBeHidden();

  await page.evaluate(() => {
    window.history.pushState({}, "", "/webhooks/templates");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  const templateSheet = await openTemplate(
    page,
    "Postmark inbound with tenant header",
  );
  await expect(templateSheet).toContainText("Used by1 endpoint");
  await templateSheet.getByRole("button", { name: "Delete" }).click();
  const confirmDialog = page.getByRole("alertdialog");
  await expect(confirmDialog).toContainText("1 endpoint uses it");
  await confirmDialog
    .getByRole("button", { name: "Detach and delete" })
    .click();

  await expect(
    findTemplateCard(page, "Postmark inbound with tenant header"),
  ).toBeHidden();
  await expect(page.getByText("Template deleted")).toBeVisible();
});

test("built-in templates cannot be deleted, and export downloads the TOML", async ({
  page,
}) => {
  const templateSheet = await openTemplate(page, "Slack: incoming webhook");
  await expect(
    templateSheet.getByRole("button", { name: "Delete" }),
  ).toBeHidden();

  const downloadPromise = page.waitForEvent("download");
  await templateSheet.getByRole("button", { name: "Export" }).click();
  const templateDownload = await downloadPromise;
  expect(templateDownload.suggestedFilename()).toBe(
    "slack.incoming_webhook.sendmock-template.toml",
  );
  const exportedToml = await readFile(
    (await templateDownload.path()) ?? "",
    "utf8",
  );
  expect(exportedToml).toContain('id = "slack.incoming_webhook"');
  expect(exportedToml).toContain("[request]");
});

test("WH-09.7 templates can be edited with a live preview; errors block saving", async ({
  page,
}) => {
  const templateSheet = await openTemplate(page, "Slack: incoming webhook");
  await templateSheet.getByRole("button", { name: "Edit" }).click();
  const bodyField = templateSheet.getByLabel("Body template");
  await bodyField.fill(
    '{ "text": "{{ data.subject | shout }} by {{ vars.team }}" }',
  );

  await expect(templateSheet.getByLabel("Preview errors")).toContainText(
    "Unknown filter: shout",
  );
  await expect(templateSheet.getByLabel("Preview warnings")).toContainText(
    "Undefined variable: vars.team",
  );
  await expect(
    templateSheet.getByRole("button", { name: "Save template" }),
  ).toBeDisabled();

  await bodyField.fill('{ "text": "New mail: {{ data.subject }}" }');
  await expect(templateSheet.getByLabel("Preview errors")).toBeHidden();
  await expect(
    templateSheet.getByRole("region", { name: "Rendered body" }),
  ).toContainText("New mail: Your verification code");
  await templateSheet.getByRole("button", { name: "Save template" }).click();
  await expect(
    templateSheet.getByRole("region", { name: "Body template" }),
  ).toContainText("New mail: {{ data.subject }}");
});

test("WH-09.7 file templates stay read-only", async ({ page }) => {
  const templateSheet = await openTemplate(page, "Ops alert (plain text)");

  await expect(
    templateSheet.getByRole("button", { name: "Edit" }),
  ).toBeHidden();
  await expect(
    templateSheet.getByRole("button", { name: "Clone" }),
  ).toBeVisible();
});

test("WH-09.8 an edited built-in is Modified, used by endpoints, and resets to default", async ({
  page,
}) => {
  const templateSheet = await openTemplate(page, "Slack: incoming webhook");
  await templateSheet.getByRole("button", { name: "Edit" }).click();
  await templateSheet
    .getByLabel("Body template")
    .fill('{ "text": "{{ data.subject }}" }');
  await expect(
    templateSheet.getByRole("button", { name: "Save template" }),
  ).toBeEnabled();
  await templateSheet.getByRole("button", { name: "Save template" }).click();
  await expect(
    templateSheet.getByRole("heading", { name: /Modified/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(findTemplateCard(page, "Slack: incoming webhook")).toContainText(
    "Modified",
  );

  await page.evaluate(() => {
    window.history.pushState({}, "", "/webhooks/endpoints");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.getByRole("button", { name: "Edit Team Slack alerts" }).click();
  const endpointSheet = page.getByRole("dialog", { name: "Team Slack alerts" });
  await endpointSheet.getByRole("tab", { name: "Template" }).click();
  await expect(endpointSheet).toContainText(
    "Based on Slack: incoming webhook rev 2",
  );
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    window.history.pushState({}, "", "/webhooks/templates");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  const reopenedSheet = await openTemplate(page, "Slack: incoming webhook");
  await reopenedSheet.getByRole("button", { name: "Reset to default" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reset to default" })
    .click();
  await expect(
    reopenedSheet.getByRole("region", { name: "Body template" }),
  ).toContainText('"blocks"');
  await expect(
    reopenedSheet.getByRole("button", { name: "Reset to default" }),
  ).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(
    findTemplateCard(page, "Slack: incoming webhook"),
  ).not.toContainText("Modified");
});
