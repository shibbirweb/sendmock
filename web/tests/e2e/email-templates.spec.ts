import { expect, test } from "@playwright/test";

test("EM-26.2 Mail > Templates adds, changes and deletes a local email template", async ({
  page,
}) => {
  await page.goto("/mail/templates");
  const templatesTable = page.getByRole("table", { name: "Email templates" });
  await expect(templatesTable).toContainText("welcome-email");

  await page.getByRole("button", { name: "New template" }).click();
  const newSheet = page.getByRole("dialog", { name: "New template" });
  await newSheet.getByLabel("Template id or name").fill("password-reset");
  await newSheet.getByLabel("Subject").fill("Reset your password");
  await newSheet.getByRole("button", { name: "Save" }).click();
  await expect(newSheet.getByText("Write a text or HTML body")).toBeVisible();
  await newSheet
    .getByLabel("Text body")
    .fill("Use {{ reset_url }} to reset it.");
  await newSheet.getByRole("button", { name: "Save" }).click();
  await expect(newSheet).toBeHidden();
  await expect(templatesTable).toContainText("password-reset");
  await expect(templatesTable).toContainText("Reset your password");

  await templatesTable.getByRole("button", { name: "password-reset" }).click();
  const editSheet = page.getByRole("dialog", { name: "password-reset" });
  await editSheet.getByLabel("Subject").fill("Reset your SendMock password");
  await editSheet.getByRole("button", { name: "Save" }).click();
  await expect(editSheet).toBeHidden();
  await expect(templatesTable).toContainText("Reset your SendMock password");

  await templatesTable.getByRole("button", { name: "password-reset" }).click();
  await page
    .getByRole("dialog", { name: "password-reset" })
    .getByRole("button", { name: "Delete" })
    .click();
  await page
    .getByRole("button", { name: "Delete", exact: true })
    .last()
    .click();
  await expect(templatesTable).not.toContainText("password-reset");
});
