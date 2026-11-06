import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import {
  createEndpoint,
  createRule,
  listEndpointDeliveries,
  makeUniqueName,
  pickOption,
  sendEmail,
  sendTestDelivery,
  startWebhookReceiver,
  waitForDelivery,
} from "./live-webhooks";

/** An endpoint whose deliveries a rule fires for each email with `subjectToken`. */
async function createRuleFiredEndpoint(
  request: APIRequestContext,
  endpointUrl: string,
  changedFields: Record<string, unknown> = {},
) {
  const endpointName = makeUniqueName("Live deliveries");
  const subjectToken = makeUniqueName("token").replaceAll(" ", "-");
  const endpointId = await createEndpoint(
    request,
    endpointName,
    endpointUrl,
    changedFields,
  );
  await createRule(
    request,
    `${endpointName} rule`,
    endpointId,
    ["email.received"],
    {
      field: "subject",
      operator: "contains",
      value: subjectToken,
    },
  );

  return { endpointName, endpointId, subjectToken };
}

async function openDeliveryDrawer(page: Page, deliveryId: string) {
  await page.goto(`/webhooks/deliveries?delivery=${deliveryId}`);
  const deliveryDrawer = page.getByRole("dialog", { name: "Delivery" });
  await expect(deliveryDrawer.getByText("Event id")).toBeVisible();

  return deliveryDrawer;
}

async function readTotalCount(page: Page): Promise<number> {
  const showingText =
    (await page.getByText(/^Showing \d+ of [\d,]+$/).textContent()) ?? "";

  return Number(
    /of ([\d,]+)/.exec(showingText)?.[1]?.replaceAll(",", "") ?? "0",
  );
}

test("WH-03.7 the live log shows each delivery and narrows by status, endpoint and event", async ({
  page,
  request,
}) => {
  const failingReceiver = await startWebhookReceiver(500, "down");
  const failing = await createRuleFiredEndpoint(request, failingReceiver.url);
  await sendEmail(request, `Order ${failing.subjectToken}`);
  await waitForDelivery(request, failing.endpointId, "failed");
  const passingReceiver = await startWebhookReceiver(200, "ok");
  const passingName = makeUniqueName("Live passing");
  const passingId = await createEndpoint(
    request,
    passingName,
    passingReceiver.url,
  );
  await sendTestDelivery(request, passingId);
  await page.goto("/webhooks/deliveries");

  for (const columnName of [
    "Time",
    "Event",
    "Endpoint",
    "Trigger",
    "Status",
    "Duration",
    "Attempt",
  ]) {
    await expect(
      page.getByRole("columnheader", { name: columnName }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Failed", exact: true }).click();
  await expect(
    page.locator("tbody tr").filter({ hasText: failing.endpointName }),
  ).toHaveCount(1);
  await expect(page.locator("[data-delivery-status='succeeded']")).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "All", exact: true }).click();
  await pickOption(page, "Endpoint filter", passingName);
  await pickOption(page, "Event filter", "test.ping");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText(passingName);
  await pickOption(page, "Event filter", "verify.started");
  await expect(
    page.getByText("No deliveries match these filters."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filter" }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await failingReceiver.close();
  await passingReceiver.close();
});

test("WH-03.7 the live log loads 50 rows at a time and shows new deliveries as they happen", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver(200, "ok");
  const endpointId = await createEndpoint(
    request,
    makeUniqueName("Live paging"),
    receiver.url,
  );
  for (let sendIndex = 0; sendIndex < 55; sendIndex += 1) {
    await sendTestDelivery(request, endpointId);
  }
  await page.goto("/webhooks/deliveries");
  await expect(page.locator("tbody tr")).toHaveCount(50);
  const totalBefore = await readTotalCount(page);
  expect(totalBefore).toBeGreaterThan(50);

  await page.getByText(/^Showing 50 of/).scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator("tbody tr").count()).toBeGreaterThan(50);

  await sendTestDelivery(request, endpointId);
  await expect
    .poll(() => readTotalCount(page), { timeout: 15_000 })
    .toBeGreaterThan(totalBefore);
  await receiver.close();
});

test("WH-03.8 a live delivery shows request and response, the truncation note, attempts, cause and cURL", async ({
  page,
  request,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const receiver = await startWebhookReceiver(500, "x".repeat(70 * 1024));
  const retrying = await createRuleFiredEndpoint(request, receiver.url, {
    retry_policy: {
      max_attempts: 3,
      backoff_seconds: [600, 600],
      retry_on_client_errors: false,
    },
  });
  await sendEmail(request, `Retry ${retrying.subjectToken}`);
  const failedAttempt = await waitForDelivery(
    request,
    retrying.endpointId,
    "failed",
  );
  const deliveryDrawer = await openDeliveryDrawer(page, failedAttempt.id);

  await expect(
    deliveryDrawer.getByRole("region", { name: "Request", exact: true }),
  ).toContainText("POST");
  await expect(
    deliveryDrawer.getByRole("region", { name: "Response", exact: true }),
  ).toContainText("500");
  await expect(
    deliveryDrawer.getByRole("region", { name: "Request body" }),
  ).toContainText('"type": "email.received"');
  await expect(
    deliveryDrawer.getByText(
      "Body truncated at 64 KB; the rest was not stored.",
    ),
  ).toBeVisible();
  await expect(deliveryDrawer.getByText("Caused by")).toBeVisible();
  const attemptsList = deliveryDrawer.getByRole("region", { name: "Attempts" });
  await expect(
    attemptsList.getByRole("link", { name: /Attempt 1/ }),
  ).toBeVisible();
  await expect(deliveryDrawer.getByText("1 of 3")).toBeVisible();

  await deliveryDrawer.getByRole("button", { name: "Copy as cURL" }).click();
  const curlCommand = await page.evaluate(() => navigator.clipboard.readText());
  expect(curlCommand.startsWith(`curl -X POST '${receiver.url}'`)).toBe(true);
  expect(curlCommand).toContain("-H 'webhook-signature: v1,");
  await receiver.close();
});

test("WH-03.9 Cancel retries stops a live retrying delivery for good", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver(500, "down");
  const retrying = await createRuleFiredEndpoint(request, receiver.url, {
    retry_policy: {
      max_attempts: 3,
      backoff_seconds: [600, 600],
      retry_on_client_errors: false,
    },
  });
  await sendEmail(request, `Cancel ${retrying.subjectToken}`);
  const failedAttempt = await waitForDelivery(
    request,
    retrying.endpointId,
    "failed",
  );
  const deliveryDrawer = await openDeliveryDrawer(page, failedAttempt.id);
  await expect(deliveryDrawer.getByText("Next attempt")).toBeVisible();

  await deliveryDrawer.getByRole("button", { name: "Cancel retries" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel retries" })
    .click();

  await expect(
    deliveryDrawer.locator("[data-delivery-status='cancelled']"),
  ).toBeVisible();
  await expect(
    deliveryDrawer.getByRole("button", { name: "Cancel retries" }),
  ).toBeHidden();
  await expect(deliveryDrawer.getByText("Next attempt")).toBeHidden();
  const deliveries = await listEndpointDeliveries(request, retrying.endpointId);
  expect(deliveries.map((delivery) => delivery.status)).toEqual(["cancelled"]);
  await receiver.close();
});

test("WH-03.9 a live render failure shows the template error instead of a request", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver(200, "ok");
  const broken = await createRuleFiredEndpoint(request, receiver.url, {
    headers: { "X-Missing": "{{ vars.missing_live_value }}" },
  });
  await sendEmail(request, `Broken ${broken.subjectToken}`);
  const renderFailure = await waitForDelivery(
    request,
    broken.endpointId,
    "render_failed",
  );
  const deliveryDrawer = await openDeliveryDrawer(page, renderFailure.id);

  await expect(deliveryDrawer.getByRole("alert")).toContainText(
    "Template error",
  );
  await expect(deliveryDrawer.getByText("Nothing was sent")).toBeVisible();
  await expect(
    deliveryDrawer.getByRole("button", { name: "Replay", exact: true }),
  ).toBeHidden();
  expect(receiver.receivedBodies).toEqual([]);
  await receiver.close();
});

test("WH-05.2 replay as-is, re-render, and edit and replay each reach the live app", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver(200, "ok");
  const delivered = await createRuleFiredEndpoint(request, receiver.url);
  await sendEmail(request, `Replay ${delivered.subjectToken}`);
  const firstDelivery = await waitForDelivery(
    request,
    delivered.endpointId,
    "succeeded",
  );
  const deliveryDrawer = await openDeliveryDrawer(page, firstDelivery.id);
  const firstUrl = page.url();

  await deliveryDrawer
    .getByRole("button", { name: "Replay", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Replay as-is" }).click();
  await expect(page).not.toHaveURL(firstUrl);
  await expect(
    deliveryDrawer.getByText("replay", { exact: true }),
  ).toBeVisible();
  const replayUrl = page.url();
  await deliveryDrawer
    .getByRole("button", { name: "Replay", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Re-render with fresh values" })
    .click();
  await expect(page).not.toHaveURL(replayUrl);

  await deliveryDrawer.getByRole("button", { name: "Edit and replay" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit and replay" });
  await editDialog.getByLabel("Body").fill("{ not json");
  await editDialog.getByRole("button", { name: "Send edited request" }).click();
  await expect(
    editDialog.getByText("The body is not valid JSON"),
  ).toBeVisible();
  await editDialog.getByLabel("Body").fill('{"edited":true}');
  await editDialog.getByRole("button", { name: "Send edited request" }).click();
  await expect(editDialog).toBeHidden();
  await expect(
    deliveryDrawer.getByRole("region", { name: "Request body" }),
  ).toContainText('"edited": true');
  await expect.poll(() => receiver.receivedBodies.length).toBe(4);
  expect(receiver.receivedBodies).toContain('{"edited":true}');
  await receiver.close();
});
