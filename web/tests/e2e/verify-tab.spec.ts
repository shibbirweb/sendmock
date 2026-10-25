import { expect, test } from "@playwright/test";

const pendingRecipient = "+8801700000000";

test("VF-04.3 the table lists code, status, attempts and a live countdown", async ({
  page,
}) => {
  await page.goto("/sms/verify");
  const pendingRow = page
    .getByRole("row")
    .filter({ hasText: pendingRecipient });

  await expect(pendingRow).toContainText("482913");
  await expect(pendingRow).toContainText("Pending");
  await expect(pendingRow).toContainText("0 / 5");
  await expect(pendingRow).toContainText(/Expires in \d+:\d\d/);
});

test("status chips narrow the table to failed verifications", async ({
  page,
}) => {
  await page.goto("/sms/verify");
  await page.getByRole("button", { name: "Failed", exact: true }).click();

  const bodyRows = page.locator("tbody tr");
  await expect(bodyRows).toHaveCount(3);
  await expect(page.locator("tbody")).not.toContainText("Pending");
});

test("VF-04.1 forcing Approve in the drawer changes the state at once", async ({
  page,
}) => {
  await page.goto("/sms/verify");
  await page.getByRole("link", { name: pendingRecipient }).click();
  const drawer = page.getByRole("dialog", { name: "Verification" });

  await drawer.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByText("Verification approved")).toBeVisible();
  await expect(
    drawer.locator("[data-verification-status='approved']"),
  ).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(
    drawer
      .getByRole("list", { name: "Verification timeline" })
      .getByRole("listitem")
      .last(),
  ).toContainText("Forced from SendMock");
});

test("VF-04.4 the drawer shows the timeline and opens the SMS with the code", async ({
  page,
}) => {
  await page.goto("/sms/verify");
  await page.getByRole("link", { name: pendingRecipient }).click();
  const drawer = page.getByRole("dialog", { name: "Verification" });

  await expect(
    drawer
      .getByRole("list", { name: "Verification timeline" })
      .getByRole("listitem"),
  ).toHaveText([/Started/, /Code sent/]);

  await drawer.getByRole("link", { name: "Open the message" }).click();
  await expect(page).toHaveURL(/\/sms\/.+message=/);
  await expect(
    page.getByRole("dialog", { name: "Message details" }),
  ).toContainText("482913");
});

test("VF-01.3 a service can be created, edited and deleted", async ({
  page,
}) => {
  await page.goto("/sms/verify?tab=services");
  await page.getByRole("button", { name: "New service" }).click();
  const serviceDialog = page.getByRole("dialog", {
    name: "New Verify service",
  });

  await serviceDialog.getByLabel("Name").fill("E2E Signup");
  await serviceDialog.getByLabel("Fixed code (optional)").fill("12");
  await serviceDialog.getByRole("button", { name: "Create service" }).click();
  await expect(serviceDialog.getByText("Use exactly 6 digits")).toBeVisible();

  await serviceDialog.getByLabel("Fixed code (optional)").fill("654321");
  await serviceDialog.getByRole("button", { name: "Create service" }).click();
  const serviceRow = page.getByRole("row").filter({ hasText: "E2E Signup" });
  await expect(serviceRow).toContainText("fixed 654321");

  await page.getByRole("button", { name: "Edit E2E Signup" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit Verify service" });
  await editDialog.getByLabel("Name").fill("E2E Signup v2");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "E2E Signup v2" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Delete E2E Signup v2" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "E2E Signup" }),
  ).toHaveCount(0);
});
