import { expect, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

test("EM-17.1 EM-17.3 EM-17.5 a live reply as the recipient arrives inbound and links back", async ({
  page,
  request,
}) => {
  const subject = `Live receipt ${test.info().retry + 1}`;
  const sendResponse = await request.post("/api/v1/send", {
    data: {
      from: "Shop <shop@example.test>",
      to: ["sam@example.test"],
      subject,
      text: "Thanks for your order",
    },
  });
  const { id: emailId } = (await sendResponse.json()) as { id: string };
  const failedApiCalls = watchFailedApiCalls(page);
  await page.goto(`/mail/${emailId}`);

  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const composer = page.getByRole("region", { name: "Reply as recipient" });
  await expect(composer.getByLabel("Subject")).toHaveValue(`Re: ${subject}`);
  await page.keyboard.type("Where is it?");
  await composer.getByRole("button", { name: "Send reply" }).click();
  await page.getByRole("button", { name: "Open" }).click();

  await expect(
    page.getByRole("heading", { level: 2, name: `Re: ${subject}` }),
  ).toBeVisible();
  await expect(page.getByText("Reply to:")).toBeVisible();
  await expect(
    page.getByRole("main").getByText("Inbound").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reply", exact: true }),
  ).toHaveCount(0);
  expect(failedApiCalls).toEqual([]);
});
