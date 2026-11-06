import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import {
  createEndpoint,
  makeUniqueName,
  sendTestDelivery,
  startWebhookReceiver,
} from "./live-webhooks";

/** Nothing listens on port 9, so a delivery there fails at once. */
const unreachableUrl = "http://127.0.0.1:9/hooks";

function findSavedItem(page: Page, savedName: string) {
  return page.getByTestId("saved-delivery").filter({ hasText: savedName });
}

/** Saves a test delivery of a new endpoint under `savedName` through the API. */
async function saveTestDelivery(
  request: APIRequestContext,
  endpointId: string,
  savedName: string,
) {
  const testDelivery = await sendTestDelivery(request, endpointId);
  const saveResponse = await request.post("/api/v1/webhooks/saved", {
    data: { name: savedName, delivery_id: testDelivery.id },
  });
  expect(saveResponse.status()).toBe(201);
}

async function listSavedNames(request: APIRequestContext): Promise<string[]> {
  const savedDeliveries = (await (
    await request.get("/api/v1/webhooks/saved")
  ).json()) as {
    name: string;
  }[];

  return savedDeliveries.map((savedDelivery) => savedDelivery.name);
}

test("WH-10.4 live saved deliveries list newest first with their stored request and can be searched", async ({
  page,
  request,
}) => {
  const endpointId = await createEndpoint(
    request,
    makeUniqueName("Live saved"),
    unreachableUrl,
  );
  const olderName = makeUniqueName("Live older ping");
  const newerName = makeUniqueName("Live newer ping");
  await saveTestDelivery(request, endpointId, olderName);
  await saveTestDelivery(request, endpointId, newerName);
  await page.goto("/webhooks/saved");

  const shownNames = await page.getByTestId("saved-delivery").allTextContents();
  const newerIndex = shownNames.findIndex((shownText) =>
    shownText.includes(newerName),
  );
  const olderIndex = shownNames.findIndex((shownText) =>
    shownText.includes(olderName),
  );
  expect(newerIndex).toBeGreaterThanOrEqual(0);
  expect(newerIndex).toBeLessThan(olderIndex);
  const newerItem = findSavedItem(page, newerName);
  await expect(newerItem).toContainText(unreachableUrl);
  await newerItem
    .getByRole("button", { name: new RegExp(newerName), expanded: false })
    .click();
  await expect(newerItem.getByRole("region", { name: "Body" })).toContainText(
    "test.ping",
  );
  await expect(
    newerItem.getByRole("region", { name: "Headers" }),
  ).toContainText("application/json");

  await page
    .getByLabel("Search saved deliveries")
    .fill("no saved delivery is called this");
  await expect(
    page.getByText("No saved delivery has that name."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(newerItem).toBeVisible();
});

test("WH-10.4 a live saved delivery is renamed and deleted on the server", async ({
  page,
  request,
}) => {
  const endpointId = await createEndpoint(
    request,
    makeUniqueName("Live rename"),
    unreachableUrl,
  );
  const savedName = makeUniqueName("Live keep");
  const renamedName = `${savedName} renamed`;
  await saveTestDelivery(request, endpointId, savedName);
  await page.goto("/webhooks/saved");

  await page.getByRole("button", { name: `Rename ${savedName}` }).click();
  const renameDialog = page.getByRole("dialog", {
    name: "Rename saved delivery",
  });
  await renameDialog.getByLabel("Name").fill(renamedName);
  await renameDialog.getByRole("button", { name: "Rename" }).click();
  await expect(findSavedItem(page, renamedName)).toBeVisible();
  await expect.poll(() => listSavedNames(request)).toContain(renamedName);

  await page.getByRole("button", { name: `Delete ${renamedName}` }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(findSavedItem(page, renamedName)).toBeHidden();
  await expect.poll(() => listSavedNames(request)).not.toContain(renamedName);
});

test("WH-10.2 a live saved delivery is sent to another endpoint and turned into a template", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver(200, "ok");
  const sourceId = await createEndpoint(
    request,
    makeUniqueName("Live source"),
    unreachableUrl,
  );
  const targetName = makeUniqueName("Live target");
  await createEndpoint(request, targetName, receiver.url);
  const savedName = makeUniqueName("Live resend");
  await saveTestDelivery(request, sourceId, savedName);
  await page.goto("/webhooks/saved");

  await page.getByRole("button", { name: `Send ${savedName}` }).click();
  const sendDialog = page.getByRole("dialog", { name: `Send "${savedName}"` });
  await sendDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: targetName, exact: true }).click();
  await sendDialog.getByRole("button", { name: "Send", exact: true }).click();
  const sendResult = sendDialog.getByTestId("sent-delivery-result");
  await expect(sendResult).toContainText("200");
  await expect(sendResult).toContainText(`Sent to ${targetName}`);
  expect(receiver.receivedBodies.at(-1)).toContain("test.ping");
  await sendResult.getByRole("link", { name: "Open delivery" }).click();
  const deliveryDrawer = page.getByRole("dialog", { name: "Delivery" });
  await expect(
    deliveryDrawer.getByRole("region", { name: "Request", exact: true }),
  ).toContainText(receiver.url);
  await expect(
    deliveryDrawer.getByText("manual", { exact: true }),
  ).toBeVisible();

  const templateName = makeUniqueName("Live template");
  await page.goto("/webhooks/saved");
  await page
    .getByRole("button", { name: `Save as template ${savedName}` })
    .click();
  const templateDialog = page.getByRole("dialog", { name: "Save as template" });
  await templateDialog.getByLabel("Name").fill(templateName);
  await templateDialog.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByText("Template saved")).toBeVisible();
  const templates = (await (
    await request.get("/api/v1/webhooks/templates")
  ).json()) as {
    name: string;
  }[];
  expect(templates.map((template) => template.name)).toContain(templateName);
  await receiver.close();
});

test("WH-10.1 a delivery saved from the live log survives reset", async ({
  page,
  request,
}) => {
  const endpointName = makeUniqueName("Live reset source");
  const endpointId = await createEndpoint(
    request,
    endpointName,
    unreachableUrl,
  );
  const testDelivery = await sendTestDelivery(request, endpointId);
  const savedName = makeUniqueName("Live survivor");
  await page.goto(`/webhooks/deliveries?delivery=${testDelivery.id}`);
  const deliveryDrawer = page.getByRole("dialog", { name: "Delivery" });
  await deliveryDrawer.getByRole("button", { name: "Save" }).click();
  const saveDialog = page.getByRole("dialog", { name: "Save this delivery" });
  await saveDialog.getByLabel("Name").fill(savedName);
  await saveDialog.getByRole("button", { name: "Save" }).click();
  await expect(saveDialog).toBeHidden();

  await page.goto("/settings?section=general");
  await page.getByRole("button", { name: "Reset to seed" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reset" })
    .click();
  await expect(page.getByText("Reset to the seed state")).toBeVisible();
  const deliveriesAfterReset = (await (
    await request.get("/api/v1/webhooks/deliveries")
  ).json()) as { items: unknown[] };
  expect(deliveriesAfterReset.items).toEqual([]);

  await page.goto("/webhooks/saved");
  await expect(findSavedItem(page, savedName)).toContainText(
    `From ${endpointName}`,
  );
});
