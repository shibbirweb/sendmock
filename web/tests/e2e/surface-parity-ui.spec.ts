import { expect, test } from "@playwright/test";

import { navigateInApp } from "./support/app-screens";

// The UI added so every feature also has a screen (UI-11.6).

test("UI-11.6 the Scenarios screen validates and runs an example step by step", async ({
  page,
}) => {
  await page.goto("/scenarios");
  await page.getByRole("button", { name: "Load example" }).click();
  await page
    .getByRole("menuitem", { name: "Pay a Stripe checkout with a test card" })
    .click();
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByRole("region", { name: "Validation" })).toContainText(
    "Valid: 4 steps in stripe-checkout.",
  );

  await page.getByRole("button", { name: "Run" }).click();
  const runReport = page.getByRole("region", { name: "Run report" });
  await expect(runReport.getByRole("status")).toContainText(
    "Passed: 4 of 4 steps",
  );
  await expect(page.getByTestId("scenario-step")).toHaveCount(4);
  await expect(
    page.getByRole("listitem", { name: "Step 2: checkout.complete" }),
  ).toContainText("Passed");
});

test("UI-11.6 Import .eml stores a message as sent or as incoming", async ({
  page,
}) => {
  await page.goto("/mail");
  await page.getByRole("button", { name: "Import .eml" }).click();
  const importDialog = page.getByRole("dialog", { name: "Import .eml" });
  await importDialog
    .getByLabel("Message")
    .fill(
      "From: app@app.test\nTo: rahim@example.test\nSubject: Imported hello\n\nHi there.",
    );
  await importDialog.getByRole("button", { name: "Import" }).click();
  await expect(importDialog).toBeHidden();
  await expect(
    page
      .locator("section[aria-label='Email list']")
      .getByText("Imported hello", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Import .eml" }).click();
  await importDialog.getByText("Incoming to your app").click();
  await importDialog
    .getByLabel("Message")
    .fill(
      "From: rahim@example.test\nTo: support@inbound.app.test\nSubject: Need help\n\nIt broke.",
    );
  await importDialog.getByRole("button", { name: "Import" }).click();
  await page
    .locator("section[aria-label='Email list']")
    .getByText("Need help", { exact: true })
    .click();
  await expect(page.getByText("Inbound").first()).toBeVisible();
});

test("UI-11.6 EM-12.3 a tag rule is added, switched off and deleted in Settings > Email", async ({
  page,
}) => {
  await page.goto("/settings?section=email");
  const tagRulesCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Tag rules" }) });
  await tagRulesCard.getByRole("button", { name: "Add rule" }).click();
  const ruleSheet = page.getByRole("dialog", { name: "Add a tag rule" });
  await ruleSheet.getByLabel("Name").fill("Receipts");
  await ruleSheet.getByLabel("Tag").fill("receipts");
  await ruleSheet.getByRole("button", { name: "Add condition" }).click();
  await ruleSheet.getByRole("textbox", { name: "Value 1" }).fill("Receipt");
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();
  await expect(ruleSheet).toBeHidden();

  const receiptsRow = page
    .getByTestId("message-rule-row")
    .filter({ hasText: "Receipts" });
  await expect(receiptsRow).toContainText("receipts");
  await page.getByRole("button", { name: "Move Receipts up" }).click();
  await expect(page.getByTestId("message-rule-row").first()).toContainText(
    "Receipts",
  );
  await page.getByRole("switch", { name: "Receipts enabled" }).click();
  await expect(
    page.getByRole("switch", { name: "Receipts enabled" }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Delete Receipts" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(receiptsRow).toHaveCount(0);
});

test("UI-11.6 EM-14.3 an auto-forward rule needs an address and is listed", async ({
  page,
}) => {
  await page.goto("/settings?section=email");
  const forwardCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Auto-forward rules" }) });
  await forwardCard.getByRole("button", { name: "Add rule" }).click();
  const ruleSheet = page.getByRole("dialog", {
    name: "Add an auto-forward rule",
  });
  await ruleSheet.getByLabel("Name").fill("Ops copies");
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();
  await expect(ruleSheet.getByText("Add at least one address")).toBeVisible();
  await ruleSheet.getByLabel("Forward to").fill("ops@company.com");
  await ruleSheet.getByLabel("Forward to").press("Enter");
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();
  await expect(
    page.getByTestId("message-rule-row").filter({ hasText: "Ops copies" }),
  ).toContainText("ops@company.com");
});

test("UI-11.6 Settings > Connection shows each AI agent's setup and sends the edited request", async ({
  page,
}) => {
  await page.goto("/settings?section=connection");
  await expect(
    page.getByRole("region", { name: "Install command" }),
  ).toContainText("sendmock ai install --target claude-code");
  await page.getByRole("combobox", { name: "AI agent" }).click();
  await page.getByRole("option", { name: "Cursor" }).click();
  await expect(
    page.getByRole("region", { name: "MCP configuration" }),
  ).toContainText('"sendmock"');
  await expect(
    page.getByRole("link", { name: "Download the skill" }),
  ).toHaveAttribute("href", /\/ai\/skill$/);

  await page.getByText("Customize the request").click();
  await page.getByRole("button", { name: "Send this request" }).first().click();
  await expect(
    page.getByRole("status").filter({ hasText: "Sent: stored as" }),
  ).toBeVisible();
  await navigateInApp(page, "/mail");
  await expect(
    page
      .locator("section[aria-label='Email list']")
      .getByText("Hi", { exact: true })
      .first(),
  ).toBeVisible();
});
