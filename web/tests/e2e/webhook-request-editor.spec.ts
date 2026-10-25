import { expect, type Page, test } from "@playwright/test";

const endpointName = "Laravel inbound mail";

async function openRequestTab(page: Page) {
  await page.goto("/webhooks/endpoints");
  await page.getByRole("button", { name: `Edit ${endpointName}` }).click();
  const endpointSheet = page.getByRole("dialog", { name: endpointName });
  await endpointSheet.getByRole("tab", { name: "Request" }).click();
  await expect(
    endpointSheet.getByRole("region", { name: "Rendered body" }),
  ).toBeVisible();

  return endpointSheet;
}

async function openRawEditor(page: Page) {
  const endpointSheet = await openRequestTab(page);
  await endpointSheet.getByRole("radio", { name: "Raw" }).click();
  const rawEditor = endpointSheet.getByRole("textbox", { name: "Raw body" });
  await expect(rawEditor).toBeVisible();

  return { endpointSheet, rawEditor };
}

test("WH-07.14 Fields mode builds a typed JSON body or a form body", async ({
  page,
}) => {
  const endpointSheet = await openRequestTab(page);
  const renderedBody = endpointSheet.getByRole("region", {
    name: "Rendered body",
  });
  await endpointSheet.getByRole("radio", { name: "Fields" }).click();
  await endpointSheet.getByRole("button", { name: "Add field" }).click();
  await endpointSheet.getByLabel("Field 1 name").fill("user.email");
  await endpointSheet
    .getByLabel("Field 1 value")
    .fill("{{ data.to[0].address }}");
  await endpointSheet.getByRole("button", { name: "Add field" }).click();
  await endpointSheet.getByLabel("Field 2 name").fill("count");
  await endpointSheet.getByRole("combobox", { name: "Field 2 type" }).click();
  await page.getByRole("option", { name: "Number" }).click();
  await endpointSheet.getByLabel("Field 2 value").fill("3");

  await expect(renderedBody).toContainText('"email": "you@example.com"');
  await expect(renderedBody).toContainText('"count": 3');

  await endpointSheet.getByRole("radio", { name: /^Form/ }).check();
  await expect(renderedBody).toContainText("user.email");
  await expect(renderedBody).not.toContainText('"count": 3');
  await expect(
    endpointSheet.getByRole("region", { name: "Rendered headers" }),
  ).toContainText("application/x-www-form-urlencoded");

  await endpointSheet.getByRole("radio", { name: /^JSON/ }).check();
  await endpointSheet.getByLabel("Field 2 value").fill("lots");
  await endpointSheet.getByRole("button", { name: "Save changes" }).click();
  await expect(endpointSheet.getByText("count must be a number")).toBeVisible();
  await expect(endpointSheet).toBeVisible();
});

test("WH-07.14 Raw mode has completion, hover values and an Insert menu, and is saved", async ({
  page,
}) => {
  const { endpointSheet, rawEditor } = await openRawEditor(page);
  await rawEditor.click();
  await rawEditor.pressSequentially('{"subject": "{{ data.su');
  await expect(
    page.getByRole("listbox", { name: "Suggestions" }),
  ).toContainText("data.subject");
  await rawEditor.press("Enter");
  await rawEditor.pressSequentially(' }}", "code": "');
  await endpointSheet.getByRole("button", { name: "Insert" }).click();
  await page.getByRole("menuitem", { name: /OTP code/ }).click();
  await rawEditor.pressSequentially('"}');

  await expect(rawEditor).toHaveText(
    '{"subject": "{{ data.subject }}", "code": "{{ data.extracted.otp[0] }}"}',
  );
  await expect(
    endpointSheet.getByRole("region", { name: "Rendered body" }),
  ).toContainText('"code": "739104"');

  await endpointSheet
    .locator(".cm-template-expression", { hasText: "data.subject" })
    .hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "e.g. Your verification code",
  );

  await endpointSheet.getByRole("button", { name: "Save changes" }).click();
  await expect(endpointSheet).toBeHidden();
  await page.getByRole("button", { name: `Edit ${endpointName}` }).click();
  const reopenedSheet = page.getByRole("dialog", { name: endpointName });
  await reopenedSheet.getByRole("tab", { name: "Request" }).click();
  await expect(reopenedSheet.getByRole("radio", { name: "Raw" })).toBeChecked();
  await expect(
    reopenedSheet.getByRole("textbox", { name: "Raw body" }),
  ).toContainText("data.extracted.otp[0]");
});

test("WH-07.14 Escape closes the suggestions, not the sheet", async ({
  page,
}) => {
  const { endpointSheet, rawEditor } = await openRawEditor(page);
  await rawEditor.click();
  await rawEditor.pressSequentially("{{ da");
  const suggestions = page.getByRole("listbox", { name: "Suggestions" });
  await expect(suggestions).toBeVisible();

  await rawEditor.press("Escape");
  await expect(suggestions).toBeHidden();
  await expect(endpointSheet).toBeVisible();
});

test("WH-07.15 each problem shows under its part and in the editor at its line and column", async ({
  page,
}) => {
  const endpointSheet = await openRequestTab(page);
  await endpointSheet.getByRole("button", { name: "Add query param" }).click();
  await endpointSheet.getByLabel("Query param 1 name").fill("ref");
  await endpointSheet.getByLabel("Query param 1 value").fill("{{ vars.nope }}");
  await expect(
    endpointSheet.getByRole("list", { name: "URL problems" }),
  ).toContainText("Query param ref: Undefined variable: vars.nope");

  await endpointSheet.getByRole("button", { name: "Add header" }).click();
  await endpointSheet.getByLabel("Header 1 name").fill("X-Tenant");
  await endpointSheet.getByLabel("Header 1 value").fill("{{ nope() }}");
  await expect(
    endpointSheet.getByRole("list", { name: "Headers problems" }),
  ).toContainText("Header X-Tenant: Unknown function: nope");

  await endpointSheet.getByRole("radio", { name: "Raw" }).click();
  await endpointSheet
    .getByRole("textbox", { name: "Raw body" })
    .fill('{\n"a": "{{ data.subjekt }}"\n}');
  await expect(
    endpointSheet.getByRole("list", { name: "Body problems" }),
  ).toContainText("Body, line 2 column 7: Undefined variable: data.subjekt");
  await expect(
    endpointSheet.locator('[data-problem="Undefined variable: data.subjekt"]'),
  ).toHaveText("{{ data.subjekt }}");
});

test("WH-07.15 the preview follows a chosen message", async ({ page }) => {
  const { endpointSheet, rawEditor } = await openRawEditor(page);
  await endpointSheet.getByLabel("Content type").fill("text/plain");
  await rawEditor.fill("{{ data.message_id }}");
  const renderedBody = endpointSheet.getByRole("region", {
    name: "Rendered body",
  });
  await expect(renderedBody).toContainText("<sample@sendmock.local>");

  await endpointSheet.getByRole("combobox", { name: "Preview with" }).click();
  await page
    .getByRole("option", { name: /^Email:/ })
    .first()
    .click();

  await expect(renderedBody).not.toContainText("<sample@sendmock.local>");
  await expect(renderedBody).toContainText("@");
});
