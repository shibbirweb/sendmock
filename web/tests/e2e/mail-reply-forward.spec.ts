import { expect, test, type Page } from "@playwright/test";

const emailList = "section[aria-label='Email list']";

async function openEmail(page: Page, subject: string) {
  await page.goto("/mail");
  await page.locator(emailList).getByText(subject, { exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: subject }),
  ).toBeVisible();
}

test("EM-17.1 Reply creates an inbound reply linked to the original", async ({
  page,
}) => {
  await openEmail(page, "Your verification code");

  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const composer = page.getByRole("region", { name: "Reply as recipient" });
  await expect(composer.getByLabel("Subject")).toHaveValue(
    "Re: Your verification code",
  );
  // Gmail style: the quote is already in the body and typing starts above it.
  await expect(composer.getByLabel("Message")).toBeFocused();
  await expect(composer.getByLabel("Message")).toHaveValue(
    /^\n\nOn .+ wrote:\n> Verify your account/,
  );
  await page.keyboard.type("Thanks, that worked.");
  await composer.getByRole("button", { name: "Send reply" }).click();

  await page.getByRole("button", { name: "Open" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Re: Your verification code" }),
  ).toBeVisible();
  await expect(page.getByText("Reply to:")).toBeVisible();
  await expect(
    page.getByRole("main").getByText("Inbound").first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Text" }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "> Verify your account",
  );
});

test("EM-17.4 Forward sends the email on with its attachments", async ({
  page,
}) => {
  await openEmail(page, "Welcome to Acme: here is what is new this week");

  await page.keyboard.press("f");
  const composer = page.getByRole("region", { name: "Forward as recipient" });
  await expect(composer.getByLabel("Message")).toHaveValue(
    /---------- Forwarded message ---------/,
  );
  await composer.getByLabel("To").fill("support@inbound.app.test");
  await expect(composer.getByLabel(/Include attachments/)).toBeChecked();
  await composer.getByRole("button", { name: "Send forward" }).click();

  await page.getByRole("button", { name: "Open" }).click();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Fwd: Welcome to Acme: here is what is new this week",
    }),
  ).toBeVisible();
  await expect(page.getByText("support@inbound.app.test")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Attachments/ })).toBeVisible();
  await page.getByRole("tab", { name: "Text" }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "---------- Forwarded message ---------",
  );
});

test("EM-17.5 the original links to its replies, and incoming emails offer no reply", async ({
  page,
}) => {
  await openEmail(page, "Reset your password");
  const responseLinks = page.getByRole("navigation", {
    name: "Replies and forwards",
  });

  await responseLinks.getByRole("link", { name: /Rahim Uddin/ }).click();

  await expect(
    page.getByRole("heading", { level: 2, name: "Re: Reset your password" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reply", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Simulate an event" }),
  ).toHaveCount(0);
});

test("EM-17.3 is:inbound lists only incoming emails", async ({ page }) => {
  await page.goto("/mail?q=is%3Ainbound");

  const listRows = page.locator(emailList).getByRole("link");
  await expect(listRows).toHaveCount(1);
  await expect(listRows.first()).toContainText("Re: Reset your password");
  await expect(listRows.first()).toContainText("Inbound");
});

test("Esc asks before discarding a written reply", async ({ page }) => {
  await openEmail(page, "Your verification code");

  await page.keyboard.press("r");
  const composer = page.getByRole("region", { name: "Reply as recipient" });
  await page.keyboard.type("Half written");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Keep writing" }).click();
  await expect(composer.getByLabel("Message")).toHaveValue(/^Half written/);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(composer).toBeHidden();
});
