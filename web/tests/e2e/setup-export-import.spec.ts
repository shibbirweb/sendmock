import { expect, type Page, test } from "@playwright/test";

// Settings > Setup (PL-18) and the saved scenarios on the Scenarios screen (AI-07).

async function readDownload(
  page: Page,
  startDownload: () => Promise<void>,
): Promise<{ fileName: string; fileText: string }> {
  const downloadPromise = page.waitForEvent("download");
  await startDownload();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const { readFile } = await import("node:fs/promises");

  return {
    fileName: download.suggestedFilename(),
    fileText: await readFile(downloadPath, "utf8"),
  };
}

test("PL-18.1 PL-18.5 Settings > Setup exports the chosen sections in TOML, JSON or YAML", async ({
  page,
}) => {
  await page.goto("/settings?section=setup");
  const exportCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Export a setup" }) });

  await exportCard.getByRole("radio", { name: "JSON" }).click();
  const jsonExport = await readDownload(page, () =>
    exportCard
      .getByRole("button", { name: "Export sendmock.setup.json" })
      .click(),
  );
  expect(jsonExport.fileName).toBe("sendmock.setup.json");
  expect(JSON.parse(jsonExport.fileText).sendmock.format_version).toBe(2);

  await exportCard.getByRole("radio", { name: "YAML" }).click();
  await exportCard.getByLabel("Settings", { exact: true }).click();
  const yamlExport = await readDownload(page, () =>
    exportCard
      .getByRole("button", { name: "Export sendmock.setup.yaml" })
      .click(),
  );
  expect(yamlExport.fileText).toContain('format: "sendmock.setup"');
  expect(yamlExport.fileText).not.toContain("settings:");
});

test("PL-18.6 an export with encrypted secrets needs a passphrase of 8 characters", async ({
  page,
}) => {
  await page.goto("/settings?section=setup");
  const exportCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Export a setup" }) });
  const exportButton = exportCard.getByRole("button", {
    name: "Export sendmock.setup.toml",
  });

  await exportCard.getByText("Encrypted with a passphrase").click();
  await exportCard.getByLabel("Passphrase", { exact: true }).fill("short");
  await expect(exportButton).toBeDisabled();

  await exportCard
    .getByLabel("Passphrase", { exact: true })
    .fill("correct horse battery");
  const encryptedExport = await readDownload(page, () => exportButton.click());
  expect(encryptedExport.fileText).toContain("encrypted:v1:");
  expect(encryptedExport.fileText).not.toContain("${");
});

test("PL-18.8 a replace import previews what it removes and confirms the count", async ({
  page,
}) => {
  await page.goto("/settings?section=setup");
  const importCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Import a setup" }) });

  await importCard
    .getByLabel("Setup file", { exact: true })
    .fill('[[numbers]]\nnumber = "+15559990001"\nlabel = "Only"');
  await importCard.getByText("Replace", { exact: true }).click();
  await importCard.getByRole("button", { name: "Preview" }).click();

  const changes = importCard.getByRole("list", { name: "Changes" });
  await expect(changes).toContainText("Adds 1: +15559990001");
  await expect(changes).toContainText("Removes");

  await importCard.getByRole("button", { name: "Import", exact: true }).click();
  const confirmDialog = page.getByRole("alertdialog");
  await expect(confirmDialog).toContainText(/This removes \d+ items/);
  await confirmDialog.getByRole("button", { name: "Replace" }).click();
  await expect(page.getByText("Setup imported")).toBeVisible();
});

test("PL-18.3 an older file is upgraded for the import and its upgraded copy downloads", async ({
  page,
}) => {
  await page.goto("/settings?section=setup");
  const importCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Import a setup" }) });

  await importCard
    .getByLabel("Setup file", { exact: true })
    .fill('[[numbers]]\nnumber = "+15559990002"\nlabel = "Old"');
  await importCard.getByRole("button", { name: "Preview" }).click();
  await expect(importCard).toContainText("Upgraded from format 1");

  const upgradedCopy = await readDownload(page, () =>
    importCard
      .getByRole("button", { name: "Download the upgraded copy" })
      .click(),
  );
  expect(upgradedCopy.fileText).toContain("format_version = 2");
});

test("PL-18.4 PL-18.7 a newer format and a URL the demo cannot download are refused", async ({
  page,
}) => {
  await page.goto("/settings?section=setup");
  const importCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Import a setup" }) });

  await importCard
    .getByLabel("Setup file", { exact: true })
    .fill('[sendmock]\nformat = "sendmock.setup"\nformat_version = 99');
  await importCard.getByRole("button", { name: "Preview" }).click();
  await expect(
    importCard.getByRole("list", { name: "Setup errors" }),
  ).toContainText("Update SendMock to import it");
  await expect(
    importCard.getByRole("button", { name: "Import", exact: true }),
  ).toBeDisabled();

  await importCard.getByRole("radio", { name: "URL" }).click();
  await importCard
    .getByLabel("URL")
    .fill("https://example.com/sendmock.setup.toml");
  await importCard
    .getByLabel("Headers (optional)")
    .fill("Authorization: Bearer secret");
  await importCard.getByRole("button", { name: "Preview" }).click();
  await expect(importCard.getByRole("alert")).toContainText("cannot download");
});

test("AI-07.3 a scenario is saved, marked unsaved when edited, saved as a copy, renamed and deleted", async ({
  page,
}) => {
  await page.goto("/scenarios");
  const savedList = page.getByRole("complementary", {
    name: "Saved scenarios",
  });

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const nameDialog = page.getByRole("dialog", { name: "Save the scenario" });
  await nameDialog.getByLabel("Name").fill("otp-login");
  await nameDialog.getByRole("button", { name: "Save" }).click();
  await expect(
    savedList.getByRole("button", { name: "otp-login", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Unsaved changes")).toHaveCount(0);

  await page.getByRole("textbox", { name: "Scenario" }).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\n# edited");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Unsaved changes")).toHaveCount(0);

  await page.getByRole("button", { name: "Save as" }).click();
  const copyDialog = page.getByRole("dialog", { name: "Save a copy" });
  await copyDialog.getByLabel("Name").fill("otp-login-2");
  await copyDialog.getByRole("button", { name: "Save" }).click();
  await expect(
    savedList.getByRole("button", { name: "otp-login-2", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Load example" }).click();
  await page
    .getByRole("menuitem", { name: "Pay a Stripe checkout with a test card" })
    .click();
  await savedList
    .getByRole("button", { name: "otp-login", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Scenario" })).toContainText(
    "# edited",
  );

  await savedList
    .getByRole("button", { name: "Actions for otp-login-2" })
    .click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const renameDialog = page.getByRole("dialog", {
    name: "Rename the scenario",
  });
  await renameDialog.getByLabel("Name").fill("sms-login");
  await renameDialog.getByRole("button", { name: "Rename" }).click();
  await expect(
    savedList.getByRole("button", { name: "sms-login", exact: true }),
  ).toBeVisible();

  await savedList
    .getByRole("button", { name: "Actions for sms-login" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(
    savedList.getByRole("button", { name: "sms-login", exact: true }),
  ).toHaveCount(0);
});
