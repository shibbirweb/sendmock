import { expect, type Page, test } from "@playwright/test";

import { navigateInApp } from "./support/app-screens";

const emailList = "section[aria-label='Email list']";
const shopSubject = "Your shop receipt";

async function createShopProject(page: Page) {
  await page.goto("/settings?section=projects");
  await expect(
    page.getByRole("cell", { name: "Default", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New project" }).click();
  const newProjectDialog = page.getByRole("dialog", { name: "New project" });
  await newProjectDialog.getByLabel("Key").fill("shop");
  await newProjectDialog.getByLabel("Name").fill("Shop");
  await newProjectDialog
    .getByRole("button", { name: "Create project" })
    .click();
  await expect(
    page.getByRole("cell", { name: "Shop", exact: true }),
  ).toBeVisible();
}

/** An email sent into the shop project, as an app naming it in the header would. */
async function sendShopEmail(page: Page) {
  const sendStatus = await page.evaluate(async (subject) => {
    const response = await fetch("/api/v1/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sendmock-project": "shop",
      },
      body: JSON.stringify({
        from: "shop@app.test",
        to: ["sam@example.com"],
        subject,
        text: "Thanks for your order",
      }),
    });

    return response.status;
  }, shopSubject);
  expect(sendStatus).toBe(201);
}

test("PL-10.7 the project switcher shows once a second project exists and filters Mail", async ({
  page,
}) => {
  await page.goto("/settings?section=projects");
  await expect(
    page.getByRole("cell", { name: "Default", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Project" })).toBeHidden();

  await createShopProject(page);
  await sendShopEmail(page);
  await navigateInApp(page, "/mail");
  await expect(page.locator(emailList).getByRole("link").first()).toBeVisible();
  await page.getByRole("combobox", { name: "Project" }).click();
  await page.getByRole("option", { name: "Shop" }).click();

  await expect(page).toHaveURL(/project=shop/);
  await expect(page.locator(emailList).getByRole("link")).toHaveCount(1);
  await expect(page.locator(emailList)).toContainText(shopSubject);
  await page.getByRole("link", { name: "SMS", exact: true }).first().click();
  await expect(page).toHaveURL(/\/sms.*project=shop/);
});

test("PL-10.7 Settings > Projects renames and deletes a project and shows how to send to it", async ({
  page,
}) => {
  await createShopProject(page);

  await expect(page.getByText("X-SendMock-Project: shop")).toBeVisible();
  await expect(
    page.getByText("http://127.0.0.1:8026/projects/shop"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rename Shop" }).click();
  const renameDialog = page.getByRole("dialog", { name: "Rename project" });
  await renameDialog.getByRole("textbox").fill("Shop team");
  await renameDialog.getByRole("button", { name: "Rename" }).click();
  await expect(
    page.getByRole("cell", { name: "Shop team", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete Shop team" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(
    page.getByRole("cell", { name: "Shop team", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Delete Default" }),
  ).toBeHidden();
});
