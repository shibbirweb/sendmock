import { expect, type Page, test } from "@playwright/test";

async function openConversation(page: Page, contactNumber: string) {
  await page.goto("/sms");
  await page.getByText(contactNumber, { exact: true }).click();
}

const replyWebhookResults = (page: Page) =>
  page.getByTestId("reply-webhook-result");

test("SM-09.7 an inbound bubble shows its reply webhook result; the drawer shows each attempt", async ({
  page,
}) => {
  await openConversation(page, "+8801722222222");
  await expect(replyWebhookResults(page).first()).toHaveText(
    "Fallback 200 after 11205",
  );

  await replyWebhookResults(page).first().click();
  const drawer = page.getByRole("dialog", { name: "Message details" });
  const panel = drawer.getByTestId("reply-webhook-panel");
  await expect(panel).toContainText(
    "Sent to the Messaging Service's request URL.",
  );
  const attempts = panel.getByRole("list", { name: "Reply webhook attempts" });
  await expect(attempts.getByRole("listitem")).toHaveCount(2);
  await expect(attempts).toContainText("Primary URL");
  await expect(attempts).toContainText("11205 HTTP connection failure");
  await expect(attempts).toContainText(
    "POST http://app.internal:8000/whatsapp/inbound",
  );
  await expect(attempts).toContainText("x-twilio-signature");

  await drawer.getByRole("button", { name: "Resend reply webhook" }).click();
  await expect(attempts.getByRole("listitem")).toHaveCount(4);
});

test("SM-09.7 a TwiML answer becomes a reply with a badge pointing at the message it answers", async ({
  page,
}) => {
  await openConversation(page, "+8801700000000");
  await page.getByLabel("Reply as +8801700000000").fill("Is the shop open?");
  await page.getByRole("button", { name: "Send reply" }).click();

  await expect(
    page.getByText(
      "Thanks! We got your message and will get back to you soon.",
    ),
  ).toBeVisible();
  await expect(replyWebhookResults(page).last()).toHaveText(
    "Reply webhook 200, 1 TwiML reply",
  );
  await page.getByRole("button", { name: "TwiML reply" }).click();
  await expect(
    page.locator("li", { hasText: "Is the shop open?" }).last(),
  ).toBeFocused();

  await replyWebhookResults(page).last().click();
  const drawer = page.getByRole("dialog", { name: "Message details" });
  await drawer.getByText("Primary URL").click();
  await expect(
    drawer.getByRole("list", { name: "Parsed TwiML" }),
  ).toContainText("Thanks! We got your message");
});

test("SM-09.7 a number without an inbound URL shows Rules only", async ({
  page,
}) => {
  await openConversation(page, "+61400000000");
  await expect(replyWebhookResults(page)).toHaveText(["Rules only"]);
});
