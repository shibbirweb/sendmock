import { expect, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

test("PN-01.6 an Expo push sent to the live binary shows on the Push screen with its preview and answer", async ({
  page,
  request,
}) => {
  const pushToken = "ExponentPushToken[live-screen-test]";
  const sendResponse = await request.post(
    "/providers/expo/--/api/v2/push/send",
    {
      data: [
        {
          to: pushToken,
          title: "Your table is ready",
          body: "Show this at the door.",
          data: { booking_id: "b-42" },
        },
      ],
    },
  );
  expect(sendResponse.status()).toBe(200);
  const answer = (await sendResponse.json()) as {
    data: { id: string }[];
  };
  const ticketId = answer.data[0]?.id ?? "";
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/push");
  await page
    .getByRole("textbox", { name: "Filter by device token" })
    .fill(pushToken);
  await page.getByRole("link", { name: "Your table is ready" }).click();
  const drawer = page.getByRole("dialog", { name: "Push notification" });

  await expect(
    drawer.getByRole("region", { name: "Phone preview" }),
  ).toContainText("Show this at the door.");
  await expect(drawer.getByRole("region", { name: "Data" })).toContainText(
    "b-42",
  );
  await expect(
    drawer.getByRole("region", { name: "Answer (200)" }),
  ).toContainText(ticketId);
  expect(failedApiCalls).toEqual([]);
});
