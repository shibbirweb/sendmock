import { expect, type Page, test } from "@playwright/test";

const sendButton = (page: Page) =>
  page.getByRole("button", { name: "Send to the demo API" });

async function openOperation(page: Page, operationLabel: string) {
  await page.goto("/playground/");
  await expect(sendButton(page)).toBeEnabled({ timeout: 30_000 });
  await page
    .getByRole("combobox", { name: "Endpoint" })
    .selectOption({ label: operationLabel });
}

test("WS-04.1 the demo bridge loads only after the playground listens for its ready message", async ({
  request,
}) => {
  const playgroundHtml = await (await request.get("/playground/")).text();

  expect(playgroundHtml).not.toContain("playground-bridge.html");
});

test("WS-04.4 the Inputs panel lists every parameter and body field with what it takes", async ({
  page,
}) => {
  await openOperation(page, "PATCH /api/v1/emails/{emailId}");
  const inputsPanel = page.getByRole("region", { name: "Inputs" });
  await expect(inputsPanel).toContainText("emailId");
  await expect(inputsPanel).toContainText("The email's ID");
  await expect(inputsPanel).toContainText("is_read");
  await expect(inputsPanel).toContainText(
    "Marks the email as read (true) or unread (false).",
  );
  await expect(inputsPanel).toContainText('Example: ["signup","qa"]');

  await page
    .getByRole("combobox", { name: "Endpoint" })
    .selectOption({ label: "GET /api/v1/emails" });
  await expect(inputsPanel).toContainText("No body.");
  await expect(inputsPanel).toContainText(
    "How it arrived: smtp, sendmail, native_api, verify, simulated, or an email provider's key",
  );

  await page
    .getByRole("combobox", { name: "Endpoint" })
    .selectOption({ label: "POST /api/v1/webhooks/endpoints" });
  await expect(inputsPanel).toContainText("retry_policy.max_attempts");
  await expect(inputsPanel).toContainText("required");
});

test("WS-04.5 the body starts as a full example, fields can be added and removed, and problems are pointed out", async ({
  page,
}) => {
  await openOperation(page, "PATCH /api/v1/emails/{emailId}");
  const bodyEditor = page.getByRole("textbox", { name: /Body/ });
  const inputsPanel = page.getByRole("region", { name: "Inputs" });
  await expect(bodyEditor).toHaveValue(/"is_read": true/);
  await expect(bodyEditor).toHaveValue(/"signup"/);

  await inputsPanel.getByRole("button", { name: "Remove tags" }).click();
  await expect(bodyEditor).not.toHaveValue(/tags/);
  await inputsPanel.getByRole("button", { name: "Add tags" }).click();
  await expect(bodyEditor).toHaveValue(/"tags"/);

  await bodyEditor.fill('{"is_read": true, "colour": "blue"}');
  await expect(page.getByRole("status", { name: "Body check" })).toContainText(
    "colour is not a field of this request",
  );
  await inputsPanel.getByRole("button", { name: "Reset to example" }).click();
  await expect(bodyEditor).toHaveValue(/"tags"/);

  await page
    .getByRole("combobox", { name: "Endpoint" })
    .selectOption({ label: "POST /api/v1/emails/{emailId}/simulate" });
  await page
    .getByRole("textbox", { name: /Body/ })
    .fill('{"event": "exploded"}');
  await expect(page.getByRole("status", { name: "Body check" })).toContainText(
    "event must be one of delivered",
  );

  await page
    .getByRole("combobox", { name: "Endpoint" })
    .selectOption({ label: "GET /api/v1/emails" });
  await page.getByRole("textbox", { name: /source/ }).fill("smtp");
  await page.getByRole("checkbox", { name: /is_unread/ }).check();
  await expect(page.getByTestId("code-snippet")).toContainText(
    "source=smtp&is_unread=true",
  );
});

test("WS-04.6 the CLI and MCP tabs follow the form and link to their reference entries", async ({
  page,
}) => {
  await openOperation(page, "GET /api/v1/emails/{emailId}");
  const emailIdField = page.getByRole("textbox", { name: /emailId/ });
  await expect(emailIdField).not.toHaveValue("");
  await emailIdField.fill("01JTESTEMAIL");
  const snippetTabs = page.getByRole("group", { name: "Snippet language" });

  await snippetTabs.getByRole("button", { name: "CLI", exact: true }).click();
  await expect(page.getByTestId("code-snippet")).toHaveText(
    "sendmock email show 01JTESTEMAIL",
  );
  await expect(
    page.getByRole("link", { name: "Every input in the CLI reference" }),
  ).toHaveAttribute("href", "/cli/email/#email-show");

  await snippetTabs.getByRole("button", { name: "MCP", exact: true }).click();
  await expect(page.getByTestId("code-snippet")).toContainText(
    '"name": "sendmock_email_get"',
  );
  await expect(page.getByTestId("code-snippet")).toContainText(
    '"email_id": "01JTESTEMAIL"',
  );
});
