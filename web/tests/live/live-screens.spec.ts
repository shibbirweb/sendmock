import { expect, test } from "@playwright/test";

import { settingsSectionIds } from "../../src/features/settings/settings-sections";
import { watchFailedApiCalls } from "./live-api-watch";

for (const sectionId of settingsSectionIds) {
  test(`UI-12.2 Settings > ${sectionId} works on the live binary without failing calls`, async ({
    page,
  }) => {
    const failedApiCalls = watchFailedApiCalls(page);

    await page.goto(`/settings?section=${sectionId}`);
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "Settings", level: 2 }),
    ).toBeVisible();
    expect(failedApiCalls).toEqual([]);
  });
}

test("UI-12.2 an email opens with every tab and no failing calls", async ({
  page,
  request,
}) => {
  const sendResponse = await request.post("/api/v1/send", {
    data: {
      from: "App <app@shop.test>",
      to: ["sam@example.test"],
      subject: "Live check",
      text: "Your code is 482913. https://shop.test/verify",
      html: "<p>Your code is <b>482913</b>. <a href='https://shop.test/verify'>Verify</a></p>",
    },
  });
  expect(sendResponse.status()).toBe(201);
  const { id: emailId } = (await sendResponse.json()) as { id: string };
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto(`/mail/${emailId}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Live check" })).toBeVisible();
  for (const detailTab of await page.getByRole("tab").all()) {
    if (await detailTab.isEnabled()) {
      await detailTab.click();
      await page.waitForLoadState("networkidle");
    }
  }

  expect(failedApiCalls).toEqual([]);
});

test("UI-12.2 buttons for operations not served yet are disabled and say when they arrive", async ({
  page,
  request,
}) => {
  const sendResponse = await request.post("/api/v1/send", {
    data: {
      from: "app@shop.test",
      to: ["sam@example.test"],
      subject: "Buttons",
      text: "Hello",
    },
  });
  const { id: emailId } = (await sendResponse.json()) as { id: string };

  await page.goto(`/mail/${emailId}`);
  const replyButton = page.getByRole("button", {
    name: "Reply: Available in Phase 4",
  });
  await replyButton.hover({ force: true });

  await expect(replyButton).toBeDisabled();
  await expect(page.getByRole("tooltip")).toHaveText("Available in Phase 4");
  await expect(
    page.getByRole("tab", { name: "Checks: Available in Phase 4" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Simulate an event", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Mark as unread" }),
  ).toBeEnabled();
});
