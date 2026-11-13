import { expect, test } from "@playwright/test";

import { clickToastAction } from "../e2e/support/toasts";
import { watchFailedApiCalls } from "./live-api-watch";
import { makeUniqueName, startWebhookReceiver } from "./live-webhooks";

type StoredRoute = { id: string; description: string };

test("EM-22.1 EM-22.3 EM-22.4 EM-22.5 a live reply finds no destination, gets a route to the app in one step and links its request", async ({
  page,
  request,
}) => {
  const appReceiver = await startWebhookReceiver();
  const senderAddress = `${makeUniqueName("shop").replaceAll(" ", "-")}@live-replies.test`;
  const subject = makeUniqueName("Live order");
  const sendResponse = await request.post("/api/v1/send", {
    data: {
      from: senderAddress,
      to: ["sam@example.test"],
      subject,
      text: "Thanks for your order",
    },
  });
  const { id: emailId } = (await sendResponse.json()) as { id: string };
  const failedApiCalls = watchFailedApiCalls(page);

  try {
    await page.goto(`/mail/${emailId}`);
    await page.getByRole("button", { name: "Reply", exact: true }).click();
    const composer = page.getByRole("region", { name: "Reply as recipient" });
    await expect(
      composer.getByRole("button", { name: "Send reply" }),
    ).toBeEnabled();
    const deliversTo = composer.getByRole("group", { name: "Delivers to" });
    await expect(deliversTo).toContainText("Nothing receives this yet");

    await deliversTo
      .getByRole("button", { name: "Send replies to your app" })
      .click();
    const quickRoute = composer.getByRole("group", {
      name: "Send replies to your app",
    });
    await quickRoute.getByLabel("Your app's URL").fill(appReceiver.url);
    await quickRoute.getByRole("button", { name: "Create route" }).click();
    await expect(deliversTo).toContainText(appReceiver.url);

    await composer.getByRole("button", { name: "Send reply" }).click();
    const sentToast = page.locator("[data-sonner-toast]", {
      hasText: "Reply created",
    });
    await expect(sentToast).toContainText(appReceiver.url);
    await clickToastAction(page, "Reply created", "Open");
    const requests = page.getByRole("list", { name: "Webhook requests" });
    await expect(requests.getByRole("listitem")).toHaveCount(1);
    await expect(requests).toContainText("200");
    await expect
      .poll(() => appReceiver.receivedBodies.join("\n"))
      .toContain(subject);

    await requests.getByRole("link", { name: appReceiver.url }).click();
    await expect(page).toHaveURL(/\/webhooks\/deliveries\?delivery=/);
    expect(failedApiCalls).toEqual([]);
  } finally {
    const routes = (await (
      await request.get("/api/v1/inbound-routes")
    ).json()) as StoredRoute[];
    for (const createdRoute of routes.filter((route) =>
      route.description.includes(senderAddress),
    )) {
      await request.delete(`/api/v1/inbound-routes/${createdRoute.id}`);
    }
    await appReceiver.close();
  }
});
