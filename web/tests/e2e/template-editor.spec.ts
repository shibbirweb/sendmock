import { readFile } from "node:fs/promises";

import { expect, type Page, test } from "@playwright/test";

/** Client-side navigation, so the in-browser mock data survives. */
async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

function findTemplateCard(page: Page, templateName: string) {
  return page.getByTestId("template-card").filter({ hasText: templateName });
}

async function openTemplate(page: Page, templateName: string) {
  await findTemplateCard(page, templateName).first().click();
  const templateSheet = page.getByRole("dialog", {
    name: new RegExp(templateName),
  });
  await expect(
    templateSheet.getByRole("region", { name: "Body template" }),
  ).toBeVisible();

  return templateSheet;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/webhooks/templates");
  await expect(findTemplateCard(page, "Native SendMock JSON")).toBeVisible();
});

test("WH-09.9 a new template opens in the editor and keeps its details", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New template" }).click();
  const nameDialog = page.getByRole("dialog", { name: "New template" });
  await nameDialog.getByLabel("Name").fill("Orders feed");
  await nameDialog.getByRole("button", { name: "Create" }).click();

  const editForm = page.getByRole("form", { name: "Edit Orders feed" });
  await expect(editForm).toBeVisible();
  await editForm.getByLabel("Description").fill("Order events for the ERP");
  await editForm.getByLabel("sms.inbound").check();
  await editForm
    .getByLabel("Variables this template needs")
    .fill("erp_api_key");
  await editForm.getByRole("button", { name: "Add", exact: true }).click();
  await editForm.getByRole("button", { name: "Save template" }).click();

  const templateSheet = page.getByRole("dialog", { name: /Orders feed/ });
  await expect(templateSheet).toContainText("Order events for the ERP");
  await expect(templateSheet.getByLabel("Template events")).toContainText(
    "sms.inbound",
  );
  await expect(templateSheet.getByLabel("Required variables")).toContainText(
    "erp_api_key",
  );

  await page.keyboard.press("Escape");
  const slackSheet = await openTemplate(page, "Slack: incoming webhook");
  await slackSheet.getByRole("button", { name: "Edit" }).click();
  await expect(slackSheet.getByText("Template details")).toBeHidden();
});

test("WH-09.1 an endpoint can be saved as a template with its overrides", async ({
  page,
}) => {
  await navigateInApp(page, "/webhooks/endpoints");
  await page.getByRole("button", { name: "Edit Team Slack alerts" }).click();
  const endpointSheet = page.getByRole("dialog", { name: "Team Slack alerts" });
  await endpointSheet.getByRole("tab", { name: "Request" }).click();
  await endpointSheet.getByRole("button", { name: "Add header" }).click();
  await endpointSheet.getByLabel("Header 1 name").fill("X-Team");
  await endpointSheet.getByLabel("Header 1 value").fill("ops");
  await endpointSheet.getByRole("button", { name: "Save changes" }).click();
  await expect(endpointSheet).toBeHidden();

  await page.getByRole("button", { name: "Edit Team Slack alerts" }).click();
  await endpointSheet.getByRole("tab", { name: "Request" }).click();
  await endpointSheet.getByRole("button", { name: "Save as template" }).click();
  const nameDialog = page.getByRole("dialog", { name: "Save as template" });
  await nameDialog.getByLabel("Name").fill("Slack with team header");
  await nameDialog.getByRole("button", { name: "Save template" }).click();
  await endpointSheet
    .getByRole("link", { name: "Slack with team header" })
    .click();

  const templateSheet = page.getByRole("dialog", {
    name: /Slack with team header/,
  });
  await expect(
    templateSheet.getByRole("region", { name: "Header templates" }),
  ).toContainText("X-Team");
  await expect(templateSheet).toContainText("Custom");
});

test("WH-09.3 an exported template imports back identically", async ({
  page,
}) => {
  const templateSheet = await openTemplate(
    page,
    "Postmark inbound with tenant header",
  );
  const originalBody = await templateSheet
    .getByRole("region", { name: "Body template" })
    .locator("pre")
    .textContent();
  const downloadPromise = page.waitForEvent("download");
  await templateSheet.getByRole("button", { name: "Export" }).click();
  const exportedText = await readFile(
    (await (await downloadPromise).path()) ?? "",
    "utf8",
  );
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Import" }).click();
  const importDialog = page.getByRole("dialog", { name: "Import a template" });
  await importDialog.getByLabel("Template text").fill(exportedText);
  await importDialog
    .getByRole("button", { name: "Import", exact: true })
    .click();
  await expect(importDialog.getByRole("alert")).toContainText(
    "custom.tenant_inbound exists",
  );
  await importDialog.getByRole("button", { name: "Import as copy" }).click();

  const copySheet = page.getByRole("dialog", {
    name: /Postmark inbound with tenant header/,
  });
  await expect(
    copySheet.getByRole("region", { name: "Body template" }).locator("pre"),
  ).toHaveText(originalBody ?? "");
  await expect(page).not.toHaveURL(/template=custom\.tenant_inbound(&|$)/);
});

test("WH-09.3 a file that is not a template is refused", async ({ page }) => {
  await page.getByRole("button", { name: "Import" }).click();
  const importDialog = page.getByRole("dialog", { name: "Import a template" });
  await importDialog
    .getByLabel("Template text")
    .fill('name = "Half a template"');
  await importDialog
    .getByRole("button", { name: "Import", exact: true })
    .click();

  await expect(importDialog).toContainText(
    "A template needs name, request.method",
  );
});

test("WH-09.5 history diffs a revision against the current one and restores it", async ({
  page,
}) => {
  const templateSheet = await openTemplate(
    page,
    "Postmark inbound with tenant header",
  );
  const history = templateSheet.getByRole("region", { name: "History" });
  await expect(history.getByTestId("template-revision")).toHaveCount(3);

  await history
    .getByTestId("template-revision")
    .nth(1)
    .getByRole("button", { name: "Compare" })
    .click();
  const revisionDiff = history.getByLabel(
    "Changes from revision 2 to the current one",
  );
  await expect(
    revisionDiff
      .locator("[data-change='added']")
      .filter({ hasText: "TextBody" }),
  ).toBeVisible();

  await history
    .getByTestId("template-revision")
    .nth(2)
    .getByRole("button", { name: "Restore" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Restore" })
    .click();
  await expect(templateSheet).toContainText("revision 4");
  await expect(
    templateSheet.getByRole("region", { name: "Body template" }),
  ).not.toContainText('"To"');
  await expect(history.getByTestId("template-revision")).toHaveCount(4);
});
