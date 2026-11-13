import { expect, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import {
  createEndpoint,
  createRule,
  listEndpointDeliveries,
  makeUniqueName,
  sendEmail,
  startWebhookReceiver,
} from "./live-webhooks";

test("WH-13.2 WH-13.3 WH-13.4 a live bounce names its webhook, opens it in a new tab and goes to two chosen endpoints", async ({
  page,
  request,
}) => {
  const receivers = await Promise.all([
    startWebhookReceiver(),
    startWebhookReceiver(),
    startWebhookReceiver(),
  ]);
  const namePrefix = makeUniqueName("Targets");
  const [ruledName, firstChosenName, secondChosenName] = [
    "ruled",
    "first",
    "second",
  ].map((suffix) => `${namePrefix} ${suffix}`);
  const [ruledEndpointId, firstChosenId, secondChosenId] = await Promise.all(
    [ruledName, firstChosenName, secondChosenName].map((endpointName, index) =>
      createEndpoint(request, endpointName, receivers[index]?.url ?? ""),
    ),
  );
  const subject = makeUniqueName("Live receipt");
  await createRule(
    request,
    `${namePrefix} bounces`,
    ruledEndpointId,
    ["email.bounced"],
    { field: "subject", operator: "equals", value: subject },
  );
  const emailId = await sendEmail(request, subject);
  const failedApiCalls = watchFailedApiCalls(page);

  try {
    await page.goto(`/mail/${emailId}`);
    await page.getByRole("button", { name: "Simulate an event" }).click();
    await expect(
      page.getByRole("menuitem", { name: /^Hard bounce/ }),
    ).toContainText(`Webhooks: ${ruledName}`);
    await page
      .getByRole("menuitem", {
        name: "Choose webhooks for Simulate hard bounce",
      })
      .click();

    const picker = page.getByRole("dialog", { name: "Choose webhooks" });
    await picker
      .getByRole("searchbox", { name: "Search endpoints" })
      .fill(namePrefix);
    await expect(
      picker.getByRole("checkbox", { name: `Send to ${ruledName}` }),
    ).toBeChecked();
    const newTabPromise = page.context().waitForEvent("page");
    await picker.getByRole("link", { name: firstChosenName }).click();
    const endpointTab = await newTabPromise;
    await expect(
      endpointTab.getByRole("dialog").getByRole("textbox", { name: "Name" }),
    ).toHaveValue(firstChosenName);
    await endpointTab.close();
    await expect(picker).toBeVisible();

    await picker
      .getByRole("checkbox", { name: `Send to ${ruledName}` })
      .uncheck();
    await picker
      .getByRole("checkbox", { name: `Send to ${firstChosenName}` })
      .check();
    await picker
      .getByRole("checkbox", { name: `Send to ${secondChosenName}` })
      .check();
    await picker.getByRole("button", { name: "Simulate hard bounce" }).click();

    for (const chosenEndpointId of [firstChosenId, secondChosenId]) {
      await expect
        .poll(
          async () =>
            (await listEndpointDeliveries(request, chosenEndpointId)).map(
              (delivery) => `${delivery.event_type} ${delivery.trigger}`,
            ),
          { timeout: 15_000 },
        )
        .toEqual(["email.bounced chosen"]);
    }
    expect(await listEndpointDeliveries(request, ruledEndpointId)).toEqual([]);
    expect(failedApiCalls).toEqual([]);
  } finally {
    await Promise.all(receivers.map((receiver) => receiver.close()));
  }
});
