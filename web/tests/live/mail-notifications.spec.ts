import { type APIRequestContext, expect, test } from "@playwright/test";

async function sendEmail(
  request: APIRequestContext,
  recipient: string,
  subject: string,
) {
  const sendResponse = await request.post("/api/v1/send", {
    data: { from: "shop@example.test", to: [recipient], subject, text: "Hi" },
  });
  expect(sendResponse.status()).toBe(201);
}

test("EM-16.1 with permission granted each new email notifies, and a search filters them", async ({
  page,
  request,
}) => {
  // The browser's notifications are replaced by a recorder that has permission.
  await page.addInitScript(() => {
    const shownNotifications: string[] = [];
    class RecordingNotification {
      static permission = "granted";
      static requestPermission = () => Promise.resolve("granted");
      constructor(title: string, options?: { body?: string }) {
        shownNotifications.push(`${title}: ${options?.body ?? ""}`);
      }
    }
    Object.assign(window, {
      Notification: RecordingNotification,
      shownNotifications,
    });
  });
  const readShownNotifications = () =>
    page.evaluate(
      () =>
        (window as unknown as { shownNotifications: string[] })
          .shownNotifications,
    );
  await page.goto("/mail");
  await page
    .getByRole("button", { name: "Notify me about new emails" })
    .click();

  await sendEmail(request, "sam@example.test", "Live notified welcome");
  await expect
    .poll(readShownNotifications)
    .toEqual(["New email: Live notified welcome"]);

  await page.getByLabel("Search emails").fill("to:*@my-feature.test");
  await expect(page).toHaveURL(/q=to/);
  await sendEmail(request, "lee@example.test", "Live filtered out");
  await sendEmail(request, "qa@my-feature.test", "Live feature mail");
  await expect
    .poll(readShownNotifications)
    .toEqual([
      "New email: Live notified welcome",
      "New email: Live feature mail",
    ]);
});
