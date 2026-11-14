import { expect, type Page, test } from "@playwright/test";

function openBin(page: Page, binName: string) {
  return page
    .getByRole("navigation", { name: "Bin list" })
    .getByRole("button", { name: new RegExp(`^${binName}`) })
    .click();
}

function capturedRows(page: Page) {
  return page.getByTestId("captured-request");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/http");
  await expect(capturedRows(page).first()).toBeVisible();
});

test("HC-01.6 bins list their requests, and can be added, cleared and deleted", async ({
  page,
}) => {
  const binList = page.getByRole("navigation", { name: "Bin list" });
  await expect(binList.getByRole("button", { name: /^slack/ })).toContainText(
    "Slack",
  );
  await openBin(page, "slack");
  await expect(capturedRows(page)).toHaveCount(2);
  await expect(page.getByTestId("catch-url")).toHaveText(
    "http://127.0.0.1:8025/catch/slack",
  );

  await page.getByRole("button", { name: "New bin" }).click();
  const newBinDialog = page.getByRole("dialog", { name: "New bin" });
  await newBinDialog.getByLabel("Name").fill("orders");
  await newBinDialog.getByRole("combobox", { name: "Preset" }).click();
  await page.getByRole("option", { name: "Discord webhook" }).click();
  await newBinDialog.getByRole("button", { name: "Add bin" }).click();
  await expect(page.getByRole("heading", { name: "orders" })).toBeVisible();
  await expect(page.getByText("No requests in orders yet.")).toBeVisible();

  await page.getByRole("button", { name: "Delete bin" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(binList.getByRole("button", { name: /^orders/ })).toBeHidden();

  await openBin(page, "slack");
  await page.getByRole("button", { name: "Clear requests" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Clear requests" })
    .click();
  await expect(page.getByText("No requests in slack yet.")).toBeVisible();
});

test("HC-01.3 a new request appears live", async ({ page }) => {
  await openBin(page, "slack");
  await expect(capturedRows(page)).toHaveCount(2);

  await page.evaluate(() =>
    fetch("/catch/slack", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"text":"Live from the test"}',
    }),
  );

  await expect(capturedRows(page)).toHaveCount(3);
});

test("HC-01.2 and HC-01.7 the detail shows the body pretty or raw, files, query and the response sent", async ({
  page,
}) => {
  await openBin(page, "uploads");
  await capturedRows(page).first().click();
  const requestBody = page.getByRole("region", { name: "Request body" });
  await expect(requestBody).toContainText("user_id");
  await expect(requestBody).toContainText("report.csv (file)");
  await expect(page.getByRole("link", { name: "Download" })).toHaveAttribute(
    "href",
    /\/http\/requests\/.+\/files\/0$/,
  );
  await page.getByRole("radio", { name: "Raw" }).click();
  await expect(page.getByRole("region", { name: "Raw body" })).toContainText(
    "----sendmock-boundary",
  );

  await openBin(page, "analytics");
  await capturedRows(page).first().click();
  await expect(page.getByTestId("request-url")).toHaveText(
    "http://127.0.0.1:8025/catch/analytics/track?source=web",
  );
  await page.getByRole("tab", { name: "Query" }).click();
  await expect(
    page.getByRole("region", { name: "Query parameters" }),
  ).toContainText("web");
  await page.getByRole("tab", { name: "Response", exact: true }).click();
  await expect(page.getByTestId("answered-by")).toContainText(
    "Rule: Rate limited in test mode",
  );
  await expect(
    page.getByRole("region", { name: "Response body" }),
  ).toContainText('"event": "signup"');
});

test("HC-03.2 Slack, Discord and push payloads are previewed", async ({
  page,
}) => {
  await openBin(page, "slack");
  await capturedRows(page).first().click();
  const slackMessage = page.getByRole("article", { name: "Slack message" });
  await expect(slackMessage).toContainText("Email bounced");
  await expect(slackMessage.locator("strong").first()).toHaveText(
    "unknown-user@example.com",
  );

  await openBin(page, "discord");
  await capturedRows(page).first().click();
  await expect(
    page.getByRole("article", { name: "Discord message" }),
  ).toContainText("api v2.14.0 is live");
  await expect(page.getByTestId("discord-embed")).toHaveCSS(
    "border-left-color",
    "rgb(87, 242, 135)",
  );

  await openBin(page, "push");
  await capturedRows(page).first().click();
  await expect(
    page.getByRole("list", { name: "Push notifications" }),
  ).toContainText("Order shipped");
});

test("HC-01.5 a request is copied as cURL and forwarded to a URL", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openBin(page, "analytics");
  await capturedRows(page).first().click();

  await page.getByRole("button", { name: "Copy as cURL" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain(
      "curl -X POST 'http://127.0.0.1:8025/catch/analytics/track?source=web'",
    );

  await page.getByRole("button", { name: "Forward to URL" }).click();
  const forwardDialog = page.getByRole("dialog", { name: "Forward to URL" });
  await forwardDialog.getByLabel("URL").fill("http://localhost:3000/hooks");
  await forwardDialog.getByRole("button", { name: "Forward" }).click();
  await expect(forwardDialog.getByTestId("forward-result")).toContainText(
    "200",
  );
});

test("HC-01.7 a captured request is sent to a webhook as http.captured", async ({
  page,
}) => {
  await openBin(page, "slack");
  await capturedRows(page).first().click();
  await page.getByRole("button", { name: "Send to webhook" }).click();
  const sendDialog = page.getByRole("dialog", { name: "Send to webhook" });
  await sendDialog.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: "Native SendMock JSON" }).click();
  const renderedBody = sendDialog.getByRole("region", {
    name: "Rendered body",
  });
  await expect(renderedBody).toContainText('"type": "http.captured"');
  await expect(renderedBody).toContainText('"bin": "slack"');

  await sendDialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(sendDialog.getByTestId("sent-delivery-result")).toContainText(
    "Sent to",
  );
});

test("HC-02.4 rules are added with a live preview, ordered, toggled and deleted; the default reply is editable", async ({
  page,
}) => {
  await openBin(page, "push");
  await page.getByRole("tab", { name: "Responses" }).click();
  await expect(page.getByTestId("response-rule")).toHaveCount(1);

  await page.getByRole("button", { name: "Add rule" }).click();
  const ruleSheet = page.getByRole("dialog", { name: "Add a rule" });
  await ruleSheet.getByLabel("Name", { exact: true }).fill("Quota exceeded");
  await ruleSheet.getByLabel("Path").fill("/v1/*");
  await ruleSheet.getByLabel("Status code", { exact: true }).fill("429");
  await ruleSheet.getByLabel("Failure rate (%)").fill("10");
  await expect(ruleSheet.getByTestId("rule-match")).toHaveText(
    "This rule answers this request.",
  );
  await ruleSheet.getByLabel("Path").fill("/v2/*");
  await expect(ruleSheet.getByTestId("rule-match")).toContainText(
    "Not matched: Path /v1/projects/acme/messages:send does not match /v2/*",
  );
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();

  const ruleRows = page.getByTestId("response-rule");
  await expect(ruleRows).toHaveCount(2);
  await expect(ruleRows.nth(1)).toContainText(
    "Any method /v2/*: 429, 10% fail with 500",
  );
  await page.getByRole("button", { name: "Move Quota exceeded up" }).click();
  await expect(ruleRows.first()).toContainText("Quota exceeded");
  await page.getByRole("switch", { name: "Quota exceeded enabled" }).click();
  await expect(
    page.getByRole("switch", { name: "Quota exceeded enabled" }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Delete Quota exceeded" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(ruleRows).toHaveCount(1);

  await page.getByRole("button", { name: "Edit default reply" }).click();
  const replySheet = page.getByRole("dialog", {
    name: "Default reply of push",
  });
  await replySheet.getByLabel("Status code").fill("202");
  await replySheet.getByRole("button", { name: "Save reply" }).click();
  await expect(
    page.getByRole("region", { name: "Default reply" }),
  ).toContainText("202");
});

test("HC-02.1 a request gets the first matching rule, else the default reply", async ({
  page,
}) => {
  await openBin(page, "push");
  await page.evaluate(() =>
    fetch("/catch/push/v1/projects/acme/messages:send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"message":{"token":"expired-token-1"}}',
    }),
  );
  await expect(capturedRows(page)).toHaveCount(3);
  await capturedRows(page).first().click();
  await page.getByRole("tab", { name: "Response", exact: true }).click();
  await expect(page.getByTestId("answered-by")).toContainText(
    "Rule: Unregistered token",
  );

  await page.evaluate(() =>
    fetch("/catch/push/v1/projects/acme/messages:send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"message":{"token":"fresh-token"}}',
    }),
  );
  await expect(capturedRows(page)).toHaveCount(4);
  await capturedRows(page).first().click();
  await page.getByRole("tab", { name: "Response", exact: true }).click();
  await expect(page.getByTestId("answered-by")).toContainText("Default reply");
});
