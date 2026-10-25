import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/webhooks/rules");
  await expect(findRuleRow(page, "Support inbox to Laravel")).toBeVisible();
});

function findRuleRow(page: Page, ruleName: string) {
  return page.getByRole("row").filter({ hasText: ruleName });
}

async function readRuleOrder(page: Page): Promise<string[]> {
  const ruleNames = await page
    .locator("tbody tr td:nth-child(2) span:first-child")
    .allTextContents();

  return ruleNames.map((ruleName) => ruleName.trim());
}

async function pickOption(
  page: Page,
  comboboxName: string,
  optionName: string,
) {
  await page.getByRole("combobox", { name: comboboxName }).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
}

test("WH-02.6 the list shows order, endpoint, events and a plain-language filter", async ({
  page,
}) => {
  const bouncesRow = findRuleRow(page, "Bounces and complaints to Slack");

  await expect(bouncesRow).toContainText("to Team Slack alerts");
  await expect(bouncesRow).toContainText("email.bounced");
  await expect(bouncesRow.getByTestId("filter-summary")).toHaveText(
    "to matches *@example.com or tag is billing",
  );
  await expect(
    findRuleRow(page, "SMS delivery status").getByTestId("filter-summary"),
  ).toHaveText("Every event");
});

test("WH-02.6 rules can be reordered, switched and filtered by endpoint", async ({
  page,
}) => {
  expect((await readRuleOrder(page)).slice(0, 2)).toEqual([
    "Support inbox to Laravel",
    "SMS delivery status",
  ]);
  await page
    .getByRole("button", { name: "Move Support inbox to Laravel down" })
    .click();
  await expect
    .poll(async () => (await readRuleOrder(page)).slice(0, 2))
    .toEqual(["SMS delivery status", "Support inbox to Laravel"]);

  await page.getByRole("switch", { name: "Mirror everything enabled" }).click();
  await expect(page.getByText("Mirror everything enabled")).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Mirror everything enabled" }),
  ).toBeChecked();

  await pickOption(page, "Endpoint filter", "Team Slack alerts");
  await expect(page).toHaveURL(/\/webhooks\/rules\?endpoint=/);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Move Bounces and complaints to Slack up",
    }),
  ).toBeDisabled();
  // The filter lives in the URL: opening it again shows the same rules.
  const filteredPath =
    new URL(page.url()).pathname + new URL(page.url()).search;
  await pickOption(page, "Endpoint filter", "Every endpoint");
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, filteredPath);
  await expect(page.locator("tbody tr")).toHaveCount(1);
});

test("WH-02.3 the preview shows which of the last 50 messages match", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Edit Support inbox to Laravel" })
    .click();
  const ruleSheet = page.getByRole("dialog", {
    name: "Support inbox to Laravel",
  });
  const previewSummary = ruleSheet.getByTestId("preview-summary");
  await expect(previewSummary).toHaveText(
    /^Matches 0 of the last \d+ messages$/,
  );

  await ruleSheet
    .getByRole("textbox", { name: "Value 1" })
    .fill("billing@acme.test");
  await pickOption(page, "Field 1", "From");
  await ruleSheet
    .getByRole("textbox", { name: "Value 1" })
    .fill("billing@acme.test");
  await expect(previewSummary).toHaveText(
    /^Matches [1-9]\d* of the last \d+ messages$/,
  );
  const matchingItems = ruleSheet.locator(
    "[data-testid='preview-item'][data-match='true']",
  );
  await expect(matchingItems.first()).toContainText("billing@acme.test");
  await expect(ruleSheet.locator("[data-match='false']")).toHaveCount(0);

  await ruleSheet.getByText("Show non-matching").click();
  await expect(ruleSheet.locator("[data-match='false']").first()).toBeVisible();
});

test("WH-02.5 incomplete conditions are flagged before saving", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add rule" }).click();
  const ruleSheet = page.getByRole("dialog", { name: "Add a rule" });
  await ruleSheet.getByLabel("Name").fill("Header check");
  await ruleSheet.getByRole("button", { name: "Add condition" }).click();
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();
  await expect(ruleSheet.getByText("Enter a value")).toBeVisible();

  await pickOption(page, "Operator 1", "matches regex");
  await ruleSheet.getByRole("textbox", { name: "Value 1" }).fill("(");
  await expect(ruleSheet.getByText(/^Invalid regex/)).toBeVisible();

  await pickOption(page, "Field 1", "Header");
  await pickOption(page, "Operator 1", "exists");
  await expect(
    ruleSheet.getByRole("textbox", { name: "Value 1" }),
  ).toBeHidden();
  await expect(ruleSheet.getByText("Enter the header name")).toBeVisible();
  await ruleSheet.getByLabel("Header name 1").fill("X-Tenant");
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();

  await expect(
    findRuleRow(page, "Header check").getByTestId("filter-summary"),
  ).toHaveText("header X-Tenant exists");
});

test("WH-02.5 a nested group with not round-trips through save and edit", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add rule" }).click();
  const ruleSheet = page.getByRole("dialog", { name: "Add a rule" });
  await ruleSheet.getByLabel("Name").fill("VIP tickets");
  await ruleSheet
    .getByRole("button", { name: "Add condition" })
    .first()
    .click();
  await pickOption(page, "Field 1", "Subject");
  await ruleSheet.getByRole("textbox", { name: "Value 1" }).fill("Ticket");
  await ruleSheet.getByRole("button", { name: "Add group" }).click();
  const nestedGroup = ruleSheet.getByRole("group", { name: "Nested group" });
  await nestedGroup.getByRole("combobox", { name: "Field 1" }).click();
  await page.getByRole("option", { name: "Tag", exact: true }).click();
  await nestedGroup.getByRole("combobox", { name: "Operator 1" }).click();
  await page.getByRole("option", { name: "equals", exact: true }).click();
  await nestedGroup.getByRole("textbox", { name: "Value 1" }).fill("spam");
  await nestedGroup
    .getByRole("button", { name: "Negate nested group" })
    .click();
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();

  const expectedSummary = "subject contains Ticket and not tag is spam";
  await expect(
    findRuleRow(page, "VIP tickets").getByTestId("filter-summary"),
  ).toHaveText(expectedSummary);
  await page.getByRole("button", { name: "Edit VIP tickets" }).click();
  const editSheet = page.getByRole("dialog", { name: "VIP tickets" });
  await expect(
    editSheet.getByRole("group", { name: "Nested group" }).getByRole("button", {
      name: "Negate nested group",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await editSheet.getByRole("button", { name: "Save changes" }).click();
  await expect(
    findRuleRow(page, "VIP tickets").getByTestId("filter-summary"),
  ).toHaveText(expectedSummary);
});
