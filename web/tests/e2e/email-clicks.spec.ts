import { type BrowserContext, expect, type Page, test } from "@playwright/test";

const emailList = "section[aria-label='Email list']";
const resetLink = "https://acme.test/reset?token=9f8e7d6c";

/** Links open in a new tab; answer them locally so no test reaches the network. */
async function answerExternalPagesLocally(browserContext: BrowserContext) {
  await browserContext.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>ok</p>" }),
  );
}

async function openResetEmail(page: Page) {
  await page.goto("/mail");
  await page
    .locator(emailList)
    .getByText("Reset your password", { exact: true })
    .first()
    .click();
}

async function readTimeline(page: Page) {
  await page.getByRole("tab", { name: "Timeline" }).click();
  return page.getByRole("tabpanel");
}

test("EM-20.1 a link clicked in the preview opens in a new tab and fires email.clicked", async ({
  page,
  context,
}) => {
  await answerExternalPagesLocally(context);
  await openResetEmail(page);
  const preview = page.frameLocator("iframe[title^='Preview of']");
  const newTab = context.waitForEvent("page");

  await preview.getByRole("link", { name: "Reset password" }).click();

  expect((await newTab).url()).toBe(resetLink);
  await expect(await readTimeline(page)).toContainText(
    `Link clicked in the SendMock preview: ${resetLink}`,
  );
});

test("EM-20.2 Simulate click fires email.clicked for the chosen link", async ({
  page,
}) => {
  await openResetEmail(page);

  await page.getByRole("button", { name: "Simulate an event" }).click();
  await page
    .getByRole("menuitem", { name: "Click a link (email.clicked)" })
    .click();
  await page.getByRole("menuitem", { name: resetLink }).click();

  await expect(page.getByText("email.clicked fired")).toBeVisible();
  await expect(await readTimeline(page)).toContainText(
    `Link clicked with Simulate click: ${resetLink}`,
  );
});

test("EM-20.2 a URL that is not one of the email's links answers 422 unknown_link", async ({
  page,
}) => {
  await openResetEmail(page);
  await expect(page).toHaveURL(/\/mail\/[0-9A-Z]{26}/);
  const emailId = new URL(page.url()).pathname.split("/").pop() ?? "";

  const clickAnswer = await page.evaluate(async (clickedEmailId) => {
    const response = await fetch(`/api/v1/emails/${clickedEmailId}/clicks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://elsewhere.test/" }),
    });
    return { status: response.status, body: await response.json() };
  }, emailId);

  expect(emailId).not.toBe("");
  expect(clickAnswer.status).toBe(422);
  expect(clickAnswer.body.error.code).toBe("unknown_link");
});
