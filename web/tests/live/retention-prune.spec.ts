import { expect, test } from "@playwright/test";

const keptEmailLimit = 3;
const sentEmailCount = 5;
/** Retention sweeps every 10 s, so one sweep always lands within this wait. */
const sweepWaitMs = 25_000;

let maxEmailsBefore: number | null = null;

test.beforeAll(async ({ request }) => {
  const { max_emails: maxEmails } = await (
    await request.get("/api/v1/settings")
  ).json();
  maxEmailsBefore = maxEmails ?? null;
  await request.delete("/api/v1/emails");
});

test.afterAll(async ({ request }) => {
  await request.delete("/api/v1/emails");
  if (maxEmailsBefore !== null) {
    await request.patch("/api/v1/settings", {
      data: { max_emails: maxEmailsBefore },
    });
  }
});

test("PL-08.5 when retention prunes emails, the open list, its count and the unread badge drop without a reload", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const subjectLabel = `Pruned ${Date.now()}`;
  await page.goto("/mail");
  await expect(page.getByText("0 emails", { exact: true })).toBeVisible();

  await request.patch("/api/v1/settings", {
    data: { max_emails: keptEmailLimit },
  });
  for (let emailNumber = 1; emailNumber <= sentEmailCount; emailNumber++) {
    const sendResponse = await request.post("/api/v1/send", {
      data: {
        from: "app@shop.test",
        to: ["sam@example.test"],
        subject: `${subjectLabel} ${emailNumber}`,
        text: "Hello",
      },
    });
    expect(sendResponse.ok()).toBe(true);
  }

  await expect(
    page.getByText(`${keptEmailLimit} emails`, { exact: true }),
  ).toBeVisible({ timeout: sweepWaitMs });
  await expect(
    page.getByText(`${subjectLabel} ${sentEmailCount}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`${subjectLabel} 1`, { exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name: /^Mail/ }) })
      .locator('[data-sidebar="menu-badge"]'),
  ).toHaveText(String(keptEmailLimit));
});
