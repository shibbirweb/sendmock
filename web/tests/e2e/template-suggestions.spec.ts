import { expect, type Page, test } from "@playwright/test";

async function openSlackEditor(page: Page) {
  await page.goto("/webhooks/templates");
  await page
    .getByTestId("template-card")
    .filter({ hasText: "Slack: incoming webhook" })
    .click();
  const templateSheet = page.getByRole("dialog", {
    name: /Slack: incoming webhook/,
  });
  await templateSheet.getByRole("button", { name: "Edit" }).click();
  const bodyField = templateSheet.getByLabel("Body template");
  await bodyField.fill("");
  // Suggestions need the reference, which loads with the editor.
  await expect(
    templateSheet.getByRole("button", { name: /^event/ }).first(),
  ).toBeVisible();

  return { templateSheet, bodyField };
}

test("WH-07.9 the reference panel explains every value and inserts it", async ({
  page,
}) => {
  const { templateSheet, bodyField } = await openSlackEditor(page);
  const referencePanel = templateSheet.getByRole("complementary", {
    name: "Template reference",
  });

  await referencePanel.getByRole("button", { name: "Expand data" }).click();
  const subjectEntry = referencePanel.getByRole("button", {
    name: /^data\.subject/,
  });
  await expect(subjectEntry).toContainText("Email subject.");
  await expect(subjectEntry).toContainText("e.g. Your verification code");
  await expect(
    referencePanel.getByRole("region", { name: "Functions" }),
  ).toContainText("random_string(length)");
  await expect(
    referencePanel.getByRole("region", { name: "Filters" }),
  ).toContainText("urlencode");

  await subjectEntry.click();
  await expect(bodyField).toHaveValue("{{ data.subject }}");
  await referencePanel.getByRole("button", { name: /^lower/ }).click();
  await expect(bodyField).toHaveValue("{{ data.subject }} | lower");

  await referencePanel.getByLabel("Search the reference").fill("tenant");
  await expect(
    referencePanel.getByRole("button", { name: /^vars\.tenant_id/ }),
  ).toContainText("e.g. acme");
  await expect(
    referencePanel.getByRole("button", { name: /^data\.subject/ }),
  ).toBeHidden();
});

test("WH-07.10 typing inside {{ }} suggests keys, children, filters and functions", async ({
  page,
}) => {
  const { templateSheet, bodyField } = await openSlackEditor(page);
  const suggestions = page.getByRole("listbox", { name: "Suggestions" });

  await bodyField.pressSequentially("{{ ev");
  await expect(suggestions.getByRole("option")).toHaveText([/^event/]);

  await bodyField.pressSequentially("ent.");
  await expect(suggestions.getByRole("option")).toHaveText([
    /^event\.id/,
    /^event\.type/,
    /^event\.created_at/,
  ]);
  await bodyField.press("ArrowDown");
  await bodyField.press("Enter");
  await expect(bodyField).toHaveValue("{{ event.type");

  await bodyField.pressSequentially(" | lo");
  await expect(suggestions.getByRole("option")).toHaveText([/^lower/]);
  await bodyField.press("Tab");
  await expect(bodyField).toHaveValue("{{ event.type | lower");

  await bodyField.pressSequentially(" }} {{ now");
  await expect(suggestions.getByRole("option").first()).toContainText(
    "now_unix",
  );
  await bodyField.press("Enter");
  await expect(bodyField).toHaveValue("{{ event.type | lower }} {{ now_unix()");

  await bodyField.pressSequentially(" }} {{ da");
  await expect(suggestions).toBeVisible();
  await bodyField.press("Escape");
  await expect(suggestions).toBeHidden();
  await expect(templateSheet).toBeVisible();
});
