import { expect, test } from "@playwright/test";

test("PL-27.4 the Laravel, Mailgun and Twilio preset runs from Settings and shows the .env lines", async ({
  page,
}) => {
  await page.goto("/settings?section=setup");
  const appUrlField = page.getByLabel("App URL");
  await appUrlField.fill("http://localhost:8000");

  await page.getByRole("button", { name: "Apply the preset" }).click();

  await expect(
    page.getByText(
      "Set the Twilio Debugger URL to http://localhost:8000/webhooks/twilio/debugger.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("MAIL_MAILER=mailgun", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy the .env lines" }),
  ).toBeVisible();
});
