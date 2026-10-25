import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/webhooks/variables");
  await expect(findVariableRow(page, "vars.tenant_id")).toBeVisible();
});

function findVariableRow(page: Page, variablePath: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByText(variablePath, { exact: true }) });
}

async function openAddSheet(page: Page) {
  await page.getByRole("button", { name: "Add variable" }).click();
  const variableSheet = page.getByRole("dialog", { name: "Add a variable" });
  await expect(variableSheet).toBeVisible();

  return variableSheet;
}

test("WH-07.11 the table lists every variable and narrows by kind, name and scope", async ({
  page,
}) => {
  await expect(findVariableRow(page, "vars.api_token")).toContainText(
    "••••••••3f9a",
  );
  await expect(findVariableRow(page, "vars.recipient")).toContainText(
    "data.to[0].address | lower",
  );
  await expect(findVariableRow(page, "vars.tenant_id")).toContainText("Global");

  await page.getByRole("button", { name: "Random", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "All kinds" }).click();

  await page.getByLabel("Search variables").fill("tenant");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("Search variables").fill("");

  await page.getByRole("combobox", { name: "Scope filter" }).click();
  await page.getByRole("option", { name: "Laravel inbound mail" }).click();
  await expect(page).toHaveURL(/endpoint=/);
  await expect(
    page.getByText("No variable matches these filters."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filter" }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
});

test("WH-07.12 each kind checks its value the same way as the API", async ({
  page,
}) => {
  const variableSheet = await openAddSheet(page);
  await variableSheet.getByLabel("Name").fill("retry_limit");
  await variableSheet.getByRole("radio", { name: /^Number/ }).check();
  await variableSheet
    .getByRole("textbox", { name: "Number", exact: true })
    .fill("lots");
  await variableSheet.getByRole("button", { name: "Add variable" }).click();
  await expect(variableSheet.getByText("Enter a number")).toBeVisible();

  await variableSheet.getByRole("radio", { name: /^JSON/ }).check();
  await variableSheet
    .getByRole("textbox", { name: "JSON", exact: true })
    .fill("{ nope");
  await variableSheet.getByRole("button", { name: "Add variable" }).click();
  await expect(variableSheet.getByText("Enter valid JSON")).toBeVisible();

  await variableSheet.getByRole("radio", { name: /^Number/ }).check();
  await variableSheet
    .getByRole("textbox", { name: "Number", exact: true })
    .fill("3");
  await variableSheet.getByRole("button", { name: "Add variable" }).click();
  await expect(findVariableRow(page, "vars.retry_limit")).toContainText(
    "Number",
  );
});

test("WH-07.12 a dynamic variable suggests values and previews what it resolves to", async ({
  page,
}) => {
  const variableSheet = await openAddSheet(page);
  await variableSheet.getByLabel("Name").fill("first_recipient");
  await variableSheet.getByRole("radio", { name: /^Dynamic/ }).check();
  const expressionField = variableSheet.getByLabel("Path or expression");
  await expect(variableSheet.getByTestId("resolved-value")).toHaveText(
    "Your verification code",
  );

  await expressionField.fill("");
  await expressionField.pressSequentially("data.to[0].a");
  await expect(
    page.getByRole("listbox", { name: "Suggestions" }),
  ).toContainText("data.to[0].address");
  await expressionField.press("Enter");
  await expect(expressionField).toHaveValue("data.to[0].address");
  await expect(variableSheet.getByTestId("resolved-value")).toHaveText(
    "you@example.com",
  );

  await expressionField.fill("data.to[0].address | shout");
  await expect(
    variableSheet.getByRole("region", { name: "Resolves to" }),
  ).toContainText("Unknown filter: shout");
  await variableSheet.getByRole("button", { name: "Add variable" }).click();
  await expect(
    variableSheet.getByText("Unknown filter: shout").first(),
  ).toBeVisible();
  await expect(variableSheet).toBeVisible();
});

test("WH-07.12 a secret is never shown again and an empty edit keeps it", async ({
  page,
}) => {
  const variableSheet = await openAddSheet(page);
  await variableSheet.getByLabel("Name").fill("crm_api_key");
  await variableSheet.getByRole("radio", { name: /^Secret/ }).check();
  await variableSheet
    .getByRole("textbox", { name: "Secret", exact: true })
    .fill("sk_live_abcd9876");
  await variableSheet.getByRole("button", { name: "Add variable" }).click();
  const secretRow = findVariableRow(page, "vars.crm_api_key");
  await expect(secretRow).toContainText("••••••••9876");
  await expect(page.getByText("sk_live_abcd9876")).toHaveCount(0);

  await page.getByRole("button", { name: "Edit crm_api_key" }).click();
  const editSheet = page.getByRole("dialog", { name: "vars.crm_api_key" });
  await expect(
    editSheet.getByRole("textbox", { name: "Secret", exact: true }),
  ).toHaveValue("");
  await editSheet.getByLabel("Description").fill("CRM token");
  await editSheet.getByRole("button", { name: "Save changes" }).click();
  await expect(secretRow).toContainText("••••••••9876");
  await expect(secretRow).toContainText("CRM token");
});

test("WH-07.13 a fixed random variable shows its value and Regenerate replaces it", async ({
  page,
}) => {
  const seedRow = findVariableRow(page, "vars.idempotency_seed");
  await expect(seedRow).toContainText("Fixed: k3Vq8LzP0aXm");
  await page
    .getByRole("button", { name: "Regenerate idempotency_seed" })
    .click();
  await expect(seedRow).not.toContainText("k3Vq8LzP0aXm");
  await expect(seedRow).toContainText(/Fixed: [A-Za-z0-9]{12}/);

  const variableSheet = await openAddSheet(page);
  await variableSheet.getByLabel("Name").fill("batch_id");
  await variableSheet.getByRole("radio", { name: /^Random/ }).check();
  await variableSheet.getByRole("radio", { name: /^Fixed/ }).check();
  await variableSheet.getByRole("button", { name: "Add variable" }).click();
  await expect(findVariableRow(page, "vars.batch_id")).toContainText(
    /Fixed: [A-Za-z0-9]{16}/,
  );
  await expect(findVariableRow(page, "vars.nonce")).toContainText(
    "New value per send",
  );
});
