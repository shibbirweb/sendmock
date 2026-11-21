import { expect, test } from "@playwright/test";

test("EM-23.5 the Mailgun provider's Complaints tab lists each domain's complaints and clears them", async ({
  page,
}) => {
  await page.goto("/mail/providers");
  await page.getByRole("button", { name: "Edit Mailgun", exact: true }).click();
  const providerSheet = page.getByRole("dialog", { name: "Mailgun" });
  await providerSheet.getByRole("tab", { name: "Complaints" }).click();

  const domainGroup = providerSheet.getByRole("group", {
    name: "Complaints for mg.acme.test",
  });
  await expect(domainGroup).toContainText("complaint@example.test");

  await domainGroup.getByRole("button", { name: "Clear" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Clear", exact: true })
    .click();
  await expect(domainGroup).toHaveCount(0);
  await expect(providerSheet).toContainText("No complaints yet.");
});

test("EM-23.5 only the Mailgun provider has a Complaints tab", async ({
  page,
}) => {
  await page.goto("/mail/providers");
  await page
    .getByRole("button", { name: "Edit SendGrid", exact: true })
    .click();
  const providerSheet = page.getByRole("dialog", { name: "SendGrid" });

  await expect(
    providerSheet.getByRole("tab", { name: "General" }),
  ).toBeVisible();
  await expect(
    providerSheet.getByRole("tab", { name: "Complaints" }),
  ).toHaveCount(0);
});
