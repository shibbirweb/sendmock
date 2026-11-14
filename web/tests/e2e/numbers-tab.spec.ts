import { expect, test } from "@playwright/test";

test("SM-12.1 a number can be added with an inbound webhook, edited and deleted", async ({
  page,
}) => {
  await page.goto("/numbers");
  await page.getByRole("button", { name: "Add number" }).click();
  const numberSheet = page.getByRole("dialog", { name: "Add a number" });

  await numberSheet.getByLabel("Number").fill("+15550004444");
  await numberSheet.getByLabel("Label").fill("Sales");
  await numberSheet
    .getByLabel("Webhook URL")
    .fill("http://localhost:8000/sales/inbound");
  await numberSheet.getByLabel("Method").click();
  await page.getByRole("option", { name: "GET" }).click();
  await numberSheet.getByRole("button", { name: "Add number" }).click();

  const salesRow = page.getByRole("row").filter({ hasText: "+15550004444" });
  await expect(salesRow).toContainText("Sales");
  await expect(salesRow).toContainText("GET");
  await expect(salesRow).toContainText("http://localhost:8000/sales/inbound");

  await page.getByRole("button", { name: "Edit +15550004444" }).click();
  const editSheet = page.getByRole("dialog", { name: "Edit number" });
  await editSheet.getByLabel("Label").fill("Sales team");
  await editSheet.getByRole("button", { name: "Save changes" }).click();
  await expect(salesRow).toContainText("Sales team");

  await page.getByRole("button", { name: "Delete +15550004444" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(salesRow).toHaveCount(0);
});

test("SM-12.3 the form rejects invalid, duplicate and channel-less numbers", async ({
  page,
}) => {
  await page.goto("/numbers");
  await page.getByRole("button", { name: "Add number" }).click();
  const numberSheet = page.getByRole("dialog", { name: "Add a number" });
  const saveButton = numberSheet.getByRole("button", { name: "Add number" });

  await numberSheet.getByLabel("Label").fill("Test");
  await numberSheet.getByLabel("Number").fill("15550001111");
  await saveButton.click();
  await expect(
    numberSheet.getByText("Use E.164, for example +15550001111"),
  ).toBeVisible();

  await numberSheet.getByLabel("Number").fill("+15550001111");
  await numberSheet.getByLabel("SMS").uncheck();
  await numberSheet.getByLabel("Webhook URL").fill("ftp://example.com");
  await saveButton.click();
  await expect(
    numberSheet.getByText("This number is already registered"),
  ).toBeVisible();
  await expect(
    numberSheet.getByText("Pick at least one channel"),
  ).toBeVisible();
  await expect(
    numberSheet.getByText("Enter an http:// or https:// URL"),
  ).toBeVisible();
});

test("SM-03.4 a service picks numbers from another pool and both pools update", async ({
  page,
}) => {
  await page.goto("/numbers?tab=services");
  await page.getByRole("button", { name: "New service" }).click();
  const serviceSheet = page.getByRole("dialog", {
    name: "New Messaging Service",
  });

  await serviceSheet.getByLabel("Name").fill("E2E pool");
  await serviceSheet.getByRole("checkbox", { name: /\+15550003333/ }).check();
  await expect(
    serviceSheet.getByText("Moves here from Acme WhatsApp"),
  ).toBeVisible();
  await serviceSheet.getByText("Send a webhook").click();
  await serviceSheet.getByRole("button", { name: "Create service" }).click();
  await expect(serviceSheet.getByText("Enter the request URL")).toBeVisible();

  await serviceSheet
    .getByLabel("Request URL", { exact: true })
    .fill("http://localhost:8000/pool/inbound");
  await serviceSheet.getByRole("button", { name: "Create service" }).click();

  const newServiceRow = page.getByRole("row").filter({ hasText: "E2E pool" });
  await expect(newServiceRow).toContainText("+15550003333");
  await expect(newServiceRow).toContainText("Send a webhook");
  await expect(
    page.getByRole("row").filter({ hasText: "Acme WhatsApp" }),
  ).toContainText("Generated number");

  await page.getByRole("tab", { name: "Numbers" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "+15550003333" }),
  ).toContainText("E2E pool");
});

test("deleting a service leaves its numbers registered without a pool", async ({
  page,
}) => {
  await page.goto("/numbers?tab=services");
  await page.getByRole("button", { name: "Delete Acme notifications" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Acme notifications" }),
  ).toHaveCount(0);

  await page.getByRole("tab", { name: "Numbers" }).click();
  const supportRow = page.getByRole("row").filter({ hasText: "+15550001111" });
  await expect(supportRow).toBeVisible();
  await expect(supportRow).toContainText("None");
});
