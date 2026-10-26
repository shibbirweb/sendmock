import { expect, type Page, test } from "@playwright/test";

import { navigateInApp } from "./support/app-screens";

// Each test follows the "Try it in the demo" steps of one recipe in
// docs/wiki/recipes/, so a renamed button or changed screen fails here (WS-06.4).

const emailList = "section[aria-label='Email list']";

async function openEmail(page: Page, subject: string) {
  await page.goto("/mail");
  await page.locator(emailList).getByText(subject, { exact: true }).click();
}

async function openGatewayCheckout(page: Page, gatewayName: string) {
  await page.goto("/payments/gateways");
  await page
    .getByRole("button", { name: `Edit ${gatewayName}`, exact: true })
    .click();
  await page.getByRole("tab", { name: "Checkout" }).click();
  await page.getByRole("button", { name: "Open a test checkout" }).click();
  await expect(page.getByRole("note", { name: "Test mode" })).toBeVisible();
}

const checkoutResult = (page: Page) =>
  page.getByRole("region", { name: "Checkout result" });

test("WS-06.4 recipe password reset email: the reset link is extracted", async ({
  page,
}) => {
  await openEmail(page, "Reset your password");
  await expect(
    page.getByRole("link", { name: "https://acme.test/reset?token=9f8e7d6c" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy link" }).first(),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Mobile width" }).click();
  await expect(page.getByRole("radio", { name: "Mobile width" })).toBeChecked();
});

test("WS-06.4 recipe read a code: the code shows with its copy button", async ({
  page,
}) => {
  await openEmail(page, "Your verification code");
  await expect(
    page.getByRole("button", { name: "Copy code 482913" }),
  ).toBeVisible();
});

test("WS-06.4 recipe bounces and complaints: the tester and Simulate", async ({
  page,
}) => {
  await page.goto("/settings?section=email");
  await page.getByLabel("Test an address").fill("bounce+hard@shop.test");
  await expect(page.getByTestId("email-outcome-result")).toHaveText(
    "Magic address: Hard bounce (550 5.1.1)",
  );

  await navigateInApp(page, "/mail");
  await page
    .locator(emailList)
    .getByText("Reset your password", { exact: true })
    .click();
  await page.getByRole("button", { name: "Simulate an event" }).click();
  await page.getByRole("menuitem", { name: "Hard bounce" }).click();
  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Simulated bounced");
});

test("WS-06.4 recipe failed SMS: the tester names the magic number and the custom rule", async ({
  page,
}) => {
  await page.goto("/settings?section=sms");
  const testerResult = page.getByTestId("sms-outcome-result");
  await page.getByLabel("Test a number").fill("+15005550001");
  await expect(testerResult).toHaveText("Magic number: Invalid number (21211)");
  await page.getByLabel("Test a number").fill("+15559990000");
  await expect(testerResult).toHaveText(
    "Custom rule 1: Accepted, then undelivered, 30007",
  );
});

test("WS-06.4 recipe Twilio Verify login: Expire ends a pending verification", async ({
  page,
}) => {
  await page.goto("/sms/verify");
  await page.getByRole("button", { name: "Pending", exact: true }).click();
  await page.getByRole("row").nth(1).getByRole("link").first().click();
  const drawer = page.getByRole("dialog", { name: "Verification" });
  await drawer.getByRole("button", { name: "Expire" }).click();
  await expect(drawer).toContainText("Expired");
  await expect(drawer.getByRole("button", { name: "Expire" })).toHaveCount(0);
});

test("WS-06.4 recipe two-way SMS: a reply gets the app's TwiML answer", async ({
  page,
}) => {
  await page.goto("/sms");
  await page.getByText("+8801700000000", { exact: true }).click();
  await page.getByLabel("Reply as +8801700000000").fill("Is the shop open?");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(
    page.getByText(
      "Thanks! We got your message and will get back to you soon.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "TwiML reply" }).last(),
  ).toBeVisible();
});

test("WS-06.4 recipe reply by email: the reply is forwarded by a route", async ({
  page,
}) => {
  await openEmail(page, "Your verification code");
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const composer = page.getByRole("region", { name: "Reply as recipient" });
  await composer.getByLabel("Message").fill("Got it, thanks.");
  await composer.getByRole("button", { name: "Send reply" }).click();
  await page.getByRole("button", { name: "Open" }).click();
  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Forwarded by route Replies to no-reply to http://localhost:8000/webhooks/mail/inbound (200)",
  );
});

test("WS-06.4 recipe inbound email: Use in new endpoint makes a Postmark endpoint", async ({
  page,
}) => {
  await page.goto("/webhooks/templates");
  await page.getByRole("tab", { name: "Email providers" }).click();
  await page
    .getByTestId("template-card")
    .filter({ hasText: "Postmark: inbound" })
    .click();
  await page.getByRole("link", { name: "Use in new endpoint" }).click();
  const endpointSheet = page.getByRole("dialog", { name: "Add an endpoint" });
  await endpointSheet.getByLabel("Name").fill("Postmark inbound");
  await endpointSheet
    .getByLabel("URL")
    .fill("http://localhost:8000/webhooks/postmark-inbound");
  await endpointSheet.getByRole("button", { name: "Add endpoint" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("row").filter({ hasText: "Postmark inbound" }).first(),
  ).toContainText("Postmark: inbound");
});

test("WS-06.4 recipe Stripe payment: a test card pays", async ({ page }) => {
  await openGatewayCheckout(page, "Stripe");
  const cardForm = page.getByRole("form", { name: "Card details" });
  await cardForm.getByLabel("Card number").fill("4242 4242 4242 4242");
  await cardForm.getByLabel("Expiry (MM/YY)").fill("12/34");
  await cardForm.getByLabel("CVC").fill("123");
  await cardForm.getByRole("button", { name: /^Pay / }).click();
  await expect(checkoutResult(page)).toContainText("Payment successful");
});

test("WS-06.4 recipe SSLCommerz and bKash: a test wallet pays and returns by POST", async ({
  page,
}) => {
  await openGatewayCheckout(page, "SSLCommerz");
  await page.getByRole("tab", { name: "Mobile banking" }).click();
  await page
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: "bKash" }) })
    .click();
  const walletForm = page.getByRole("form", { name: "bKash payment" });
  await walletForm.getByLabel("Your bKash account number").fill("01770000001");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await walletForm.getByLabel("Verification code").fill("123456");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await walletForm.getByLabel("PIN").fill("12121");
  await walletForm.getByRole("button", { name: "Confirm and pay" }).click();
  await expect(checkoutResult(page)).toContainText("by POST");
  await expect(
    page.getByRole("definition").filter({ hasText: "VALID" }),
  ).toBeVisible();
});

test("WS-06.4 recipe Slack and push: a Slack bin gets its catch URL and previews", async ({
  page,
}) => {
  await page.goto("/http");
  await page.getByRole("button", { name: "New bin" }).click();
  const newBinDialog = page.getByRole("dialog", { name: "New bin" });
  await newBinDialog.getByLabel("Name").fill("alerts");
  await newBinDialog.getByRole("combobox", { name: "Preset" }).click();
  await page.getByRole("option", { name: "Slack incoming webhook" }).click();
  await newBinDialog.getByRole("button", { name: "Add bin" }).click();
  await expect(page.getByTestId("catch-url")).toHaveText(
    "http://127.0.0.1:8025/catch/alerts",
  );

  await page
    .getByRole("navigation", { name: "Bin list" })
    .getByRole("button", { name: /^slack/ })
    .click();
  await page.getByTestId("captured-request").first().click();
  await expect(
    page.getByRole("article", { name: "Slack message" }),
  ).toBeVisible();
});

test("WS-06.4 recipe replay a failed webhook: Replay as-is makes a replay delivery", async ({
  page,
}) => {
  await page.goto("/webhooks/deliveries");
  await page.getByRole("button", { name: "Failed", exact: true }).click();
  await page.getByRole("row").nth(1).getByRole("link").first().click();
  const deliveryDrawer = page.getByRole("dialog", { name: "Delivery" });
  await deliveryDrawer
    .getByRole("button", { name: "Replay", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Replay as-is" }).click();
  await expect(
    deliveryDrawer.getByText("replay", { exact: true }),
  ).toBeVisible();
});

test("WS-06.4 recipe share your setup: the seed file downloads", async ({
  page,
}) => {
  await page.goto("/settings?section=seed");
  const seedDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export sendmock.seed.toml" }).click();
  expect((await seedDownload).suggestedFilename()).toBe("sendmock.seed.toml");
});
