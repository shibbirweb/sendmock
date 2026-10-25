import { expect, test } from "@playwright/test";

test("EM-09.1 SMTP sessions are listed, failed ones highlighted with their reason", async ({
  page,
}) => {
  await page.goto("/logs");
  const failedAuthRow = page.getByRole("row").filter({ hasText: "worker-3" });

  await expect(failedAuthRow).toContainText("Rejected");
  await expect(failedAuthRow).toContainText(
    "535 5.7.8 Authentication credentials invalid",
  );
  await expect(failedAuthRow).toHaveClass(/bg-destructive/);

  await page.getByRole("button", { name: "Failed", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(page.locator("tbody")).not.toContainText("Delivered");
});

test("EM-09.4 the transcript tells commands from replies and colours reply codes", async ({
  page,
}) => {
  await page.goto("/logs");
  await page.getByRole("link", { name: "worker-3" }).click();
  const transcript = page
    .getByRole("dialog", { name: "SMTP session" })
    .getByRole("list", { name: "SMTP transcript" });

  await expect(
    transcript
      .locator("[data-speaker='client']")
      .filter({ hasText: "AUTH LOGIN" }),
  ).toBeVisible();
  await expect(transcript.locator("[data-reply-class='5xx']")).toHaveText(
    "535",
  );
  await expect(
    transcript.locator("[data-reply-class='2xx']").first(),
  ).toHaveText("220");
  await expect(transcript).toContainText("••••••••");
});

test("EM-09.3 an SMTP email links to its session and back", async ({
  page,
}) => {
  await page.goto("/mail");
  await page
    .locator("section[aria-label='Email list']")
    .getByText("Your verification code", { exact: true })
    .click();

  await page
    .getByRole("link", { name: /SMTP/, exact: false })
    .and(page.locator("[title^='Open the SMTP session']"))
    .click();
  const sessionDrawer = page.getByRole("dialog", { name: "SMTP session" });
  await expect(sessionDrawer).toContainText("RCPT TO:<rahim@example.com>");

  await sessionDrawer.getByRole("link", { name: "Open email" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Your verification code" }),
  ).toBeVisible();
});

test("SM-13.3 the request log filters by status class, API and path", async ({
  page,
}) => {
  await page.goto("/logs?tab=http");
  const bodyRows = page.locator("tbody tr");
  await expect(bodyRows.first()).toBeVisible();

  await page.getByRole("button", { name: "4xx", exact: true }).click();
  await expect(bodyRows).toHaveCount(3);
  await expect(bodyRows.first()).toHaveClass(/bg-destructive/);

  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Filter by API").click();
  await page.getByRole("option", { name: "Vonage" }).click();
  await expect(bodyRows).toHaveCount(1);
  await expect(bodyRows.first()).toContainText("/sms/json");

  await page.getByLabel("Search request paths").fill("Messages.json");
  await expect(page.getByText("No requests match")).toBeVisible();
});

test("SM-13.4 bodies are formatted and the request links to its SMS", async ({
  page,
}) => {
  await page.goto("/logs?tab=http");
  await page
    .getByRole("link", { name: /POST.*Messages\.json/ })
    .first()
    .click();
  const requestDrawer = page.getByRole("dialog", { name: "API request" });

  const requestBody = requestDrawer.getByRole("region", {
    name: "Request body",
  });
  await expect(requestBody.getByText("To", { exact: true })).toBeVisible();
  await expect(requestBody.getByText("+8801700000000")).toBeVisible();
  await expect(
    requestDrawer.getByRole("region", { name: "Response body" }),
  ).toContainText('"status": "queued"');

  await requestDrawer.getByRole("link", { name: "Open SMS" }).click();
  await expect(
    page.getByRole("dialog", { name: "Message details" }),
  ).toContainText("482913");

  await page
    .getByRole("dialog", { name: "Message details" })
    .getByRole("tab", { name: "Request" })
    .click();
  await page.getByRole("link", { name: "Open in request log" }).click();
  await expect(page.getByRole("dialog", { name: "API request" })).toContainText(
    "Messages.json",
  );
});

test("SM-13.1 a rejected native request is logged with its response", async ({
  page,
}) => {
  await page.goto("/logs?tab=http");
  await expect(page.locator("tbody tr").first()).toBeVisible();

  const responseStatus = await page.evaluate(async () => {
    const response = await fetch("/api/v1/sms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "+15550001111", body: "No recipient" }),
    });

    return response.status;
  });
  expect(responseStatus).toBe(400);

  await page.getByLabel("Search request paths").fill("/api/v1/sms");
  await page
    .getByRole("link", { name: /POST \/api\/v1\/sms/ })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "API request" })).toContainText(
    "No recipient",
  );
});

test("EM-09.5 SM-13.5 both logs load 50 rows at a time and more on scroll", async ({
  page,
}) => {
  await page.goto("/logs");
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByLabel("Data set").click();
  await page.getByRole("option", { name: /Large/ }).click();
  await page.keyboard.press("Escape");

  const smtpCount = page.getByText(/^Showing 50 of [\d,]+$/);
  await expect(smtpCount).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await smtpCount.scrollIntoViewIfNeeded();
  await expect(page.locator("tbody tr")).toHaveCount(100);

  await page.getByRole("tab", { name: "API requests" }).click();
  await expect(page.getByText(/^Showing 50 of 2,006$/)).toBeVisible();
  // The fallback button, clicked without scrolling: scrolling the footer into
  // view would start the automatic load and race the click.
  await page.getByRole("button", { name: "Load more" }).dispatchEvent("click");
  await expect(page.getByText(/^Showing 100 of 2,006$/)).toBeVisible();
});
