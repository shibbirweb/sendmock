import { expect, type Page, test } from "@playwright/test";

import { countSpecOperations } from "./support/count-spec-operations";

const sendButton = (page: Page) =>
  page.getByRole("button", { name: "Send to the demo API" });

async function openPlayground(page: Page) {
  await page.goto("/playground/");
  await expect(sendButton(page)).toBeEnabled({ timeout: 30_000 });
}

test("WS-04.1 UI-11.5 every endpoint in the spec can be called and is answered by the in-browser mock", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await openPlayground(page);
  const endpointSelect = page.getByRole("combobox", { name: "Endpoint" });
  const operationValues = await endpointSelect
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
  expect(operationValues.length).toBe(countSpecOperations());

  const unansweredOperations: string[] = [];
  for (const operationValue of operationValues) {
    await endpointSelect.selectOption(operationValue);
    await expect(page.getByTestId("response-status")).toHaveCount(0);
    await sendButton(page).click();
    const responseStatus = page.getByTestId("response-status");
    try {
      await expect(responseStatus).toHaveText(/^\d{3}$/, { timeout: 5_000 });
    } catch {
      unansweredOperations.push(operationValue);
    }
  }

  expect(unansweredOperations).toEqual([]);
});

test("WS-04.1 a request uses real demo ids, so it opens a stored email", async ({
  page,
}) => {
  await openPlayground(page);
  await page
    .getByRole("combobox", { name: "Endpoint" })
    .selectOption({ label: "GET /api/v1/emails/{emailId}" });
  await expect(page.getByRole("textbox", { name: /emailId/ })).not.toHaveValue(
    "",
  );
  await sendButton(page).click();

  await expect(page.getByTestId("response-status")).toHaveText("200");
});

test("WS-04.2 snippets in nine languages follow the form", async ({ page }) => {
  await openPlayground(page);
  await page
    .getByRole("combobox", { name: "Endpoint" })
    .selectOption({ label: "GET /api/v1/emails/{emailId}" });
  const emailIdField = page.getByRole("textbox", { name: /emailId/ });
  await expect(emailIdField).not.toHaveValue("");
  await emailIdField.fill("01JTESTEMAIL");

  const languageButtons = page
    .getByRole("group", { name: "Snippet language" })
    .getByRole("button");
  await expect(languageButtons).toHaveCount(9);
  for (const languageName of [
    "cURL",
    "PHP",
    "JavaScript",
    "Python",
    "Go",
    "Java",
    "Rust",
    "Ruby",
    "C#",
  ]) {
    await languageButtons.filter({ hasText: languageName }).first().click();
    await expect(page.getByTestId("code-snippet")).toContainText(
      "http://127.0.0.1:8025/api/v1/emails/01JTESTEMAIL",
    );
  }
});

test("WS-04.3 the event stream shows the events a request triggered", async ({
  page,
}) => {
  await openPlayground(page);
  await page
    .getByRole("combobox", { name: "Endpoint" })
    .selectOption({ label: "POST /api/v1/sms" });
  await page.getByRole("textbox", { name: /^Body/ }).fill(
    JSON.stringify({
      from: "+15550001111",
      to: "+8801700000000",
      body: "Hello from the playground",
    }),
  );
  await sendButton(page).click();

  await expect(page.getByTestId("response-status")).toHaveText("201");
  await expect(page.getByTestId("event-stream").first()).toContainText(
    "sms.sent",
  );
});

test("WS-04.3 scenario mode runs a multi-step flow and reads the code", async ({
  page,
}) => {
  await openPlayground(page);
  await page.getByRole("button", { name: "Run scenario" }).click();
  const scenarioSteps = page
    .getByTestId("scenario-steps")
    .getByRole("listitem");

  await expect(scenarioSteps).toHaveCount(3);
  await expect(scenarioSteps.nth(2)).toContainText("Code 731905");
});

test("the reference page for a tag documents its endpoints with Try it", async ({
  page,
}) => {
  await page.goto("/api/email/");
  const operations = page.getByTestId("api-operation");
  await expect(operations.first()).toBeVisible();
  const healthOperation = page.locator("#getEmails");

  await healthOperation.getByText("Try it in Demo mode").click();
  await expect(
    healthOperation.getByRole("button", { name: "Send to the demo API" }),
  ).toBeEnabled({
    timeout: 30_000,
  });
  await healthOperation
    .getByRole("button", { name: "Send to the demo API" })
    .click();
  await expect(healthOperation.getByTestId("response-status")).toHaveText(
    "200",
  );
});
