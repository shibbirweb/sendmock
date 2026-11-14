import { expect, test, type Page } from "@playwright/test";

async function postJson(page: Page, apiPath: string, requestBody: unknown) {
  return page.evaluate(
    async ({ apiPath: requestPath, requestBody: body }) => {
      const response = await fetch(requestPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      return { status: response.status, body: await response.json() };
    },
    { apiPath, requestBody },
  );
}

test("SM-07.7 custom outcome numbers can be added, reordered, switched off and deleted", async ({
  page,
}) => {
  await page.goto("/settings?section=sms");
  const rulesCard = page
    .locator("section")
    .filter({ hasText: "Custom outcome numbers" });
  await expect(rulesCard.locator("tbody tr")).toHaveCount(2);

  await rulesCard.getByRole("button", { name: "Add number" }).click();
  const ruleDialog = page.getByRole("dialog", { name: "New outcome number" });
  await ruleDialog.getByLabel("Number or pattern").fill("+15551112222");
  await ruleDialog.getByLabel("Outcome").click();
  await page.getByRole("option", { name: "Accepted, then failed" }).click();
  // Wait for the dropdown to close so the next click is not swallowed.
  await expect(page.getByRole("listbox")).toBeHidden();
  await ruleDialog.getByLabel("Error code").fill("");
  await ruleDialog.getByRole("button", { name: "Add rule" }).click();
  await expect(
    ruleDialog.getByText("Enter the error code, for example 30007"),
  ).toBeVisible();
  await ruleDialog.getByLabel("Error code").fill("30008");
  await ruleDialog.getByRole("button", { name: "Add rule" }).click();

  const thirdRow = rulesCard.locator("tbody tr").nth(2);
  await expect(thirdRow).toContainText("+15551112222");
  await expect(thirdRow).toContainText("Accepted, then failed, 30008");

  await rulesCard.getByRole("button", { name: "Move rule 3 up" }).click();
  await expect(rulesCard.locator("tbody tr").nth(1)).toContainText(
    "+15551112222",
  );

  await rulesCard.getByLabel("Rule 2 enabled").click();
  await expect(rulesCard.getByLabel("Rule 2 enabled")).not.toBeChecked();

  await rulesCard.getByRole("button", { name: "Delete rule 2" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(rulesCard.locator("tbody tr")).toHaveCount(2);
  await expect(rulesCard).not.toContainText("+15551112222");
});

test("SM-07.8 SM-07.9 the tester follows rules, magic numbers and the switch", async ({
  page,
}) => {
  await page.goto("/settings?section=sms");
  const testerInput = page.getByLabel("Test a number");
  const testerResult = page.getByTestId("sms-outcome-result");

  await testerInput.fill("+15559990000");
  await expect(testerResult).toHaveText(
    "Custom rule 1: Accepted, then undelivered, 30007",
  );
  await testerInput.fill("+15557771234");
  await expect(testerResult).toHaveText("Custom rule 2: Delivered after 10 s");
  await testerInput.fill("+15005550001");
  await expect(testerResult).toHaveText("Magic number: Invalid number (21211)");

  const simulationForm = page.getByRole("form", {
    name: "Delivery simulation",
  });
  await simulationForm.getByLabel("Magic numbers").click();
  await simulationForm.getByRole("button", { name: "Save changes" }).click();
  await expect(testerResult).toHaveText(/the realistic profile applies/);
  await expect(
    page.getByText(
      "Switched off: these numbers currently behave like any other number.",
    ),
  ).toBeVisible();
});

test("SM-07.8 rules and magic numbers decide what happens to a native send", async ({
  page,
}) => {
  await page.goto("/sms");
  await expect(
    page.locator("section[aria-label='Conversation list'] a").first(),
  ).toBeVisible();

  const rejectedSend = await postJson(page, "/api/v1/sms", {
    from: "+15550001111",
    to: "+15005550001",
    body: "Hi",
  });
  expect(rejectedSend.status).toBe(400);
  expect(rejectedSend.body.error.message).toBe(
    "Rejected with error 21211 (magic number)",
  );

  const acceptedSend = await postJson(page, "/api/v1/sms", {
    from: "+15550001111",
    to: "+15559990000",
    body: "QA",
  });
  expect(acceptedSend.status).toBe(201);

  await page
    .locator("section[aria-label='Conversation list']")
    .getByText("+15559990000")
    .click();
  await expect(
    page.locator(
      "section[aria-label='Conversation'] [data-sms-status='undelivered']",
    ),
  ).toHaveAttribute("aria-label", "Undelivered: 30007 Message filtered");
});

test("EM-10.5 EM-10.6 custom outcome addresses, the tester and sends", async ({
  page,
}) => {
  await page.goto("/settings?section=email");
  const testerInput = page.getByLabel("Test an address");
  const testerResult = page.getByTestId("email-outcome-result");

  await testerInput.fill("ops@bounce.qa.test");
  await expect(testerResult).toHaveText(
    "Custom rule 1: Hard bounce, 550 5.1.1",
  );
  await testerInput.fill("bounce+hard@shop.test");
  await expect(testerResult).toHaveText(
    "Magic address: Hard bounce (550 5.1.1)",
  );

  const rulesCard = page
    .locator("section")
    .filter({ hasText: "Custom outcome addresses" });
  await rulesCard.getByRole("button", { name: "Add address" }).click();
  const ruleDialog = page.getByRole("dialog", { name: "New outcome address" });
  await ruleDialog.getByLabel("Address or pattern").fill("*@blocked.test");
  await ruleDialog.getByLabel("Outcome").click();
  await page.getByRole("option", { name: "Reject the recipient" }).click();
  // Wait for the dropdown to close so the next click is not swallowed.
  await expect(page.getByRole("listbox")).toBeHidden();
  await ruleDialog.getByRole("button", { name: "Add rule" }).click();
  await expect(rulesCard.locator("tbody tr").nth(1)).toContainText(
    "Reject the recipient, 550 5.7.1",
  );

  const rejectedSend = await postJson(page, "/api/v1/send", {
    from: "app@app.test",
    to: ["someone@blocked.test"],
    subject: "Blocked",
  });
  expect(rejectedSend.body.error.message).toBe(
    "someone@blocked.test rejected with 550 5.7.1 (custom rule 2)",
  );

  const receivingForm = page.getByRole("form", {
    name: "Receiving and delivery outcomes",
  });
  await receivingForm.getByLabel("Magic addresses").click();
  await receivingForm.getByRole("button", { name: "Save changes" }).click();
  await testerInput.fill("bounce+hard@shop.test");
  await expect(testerResult).toHaveText(/outcome profile applies/);
});
