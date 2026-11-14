import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import {
  createEndpoint,
  makeUniqueName,
  sendTestDelivery,
  startWebhookReceiver,
} from "./live-webhooks";

/** Nothing listens on port 9, so a delivery there fails at once. */
const unreachableUrl = "http://127.0.0.1:9/hooks";

type LiveEndpoint = { id: string; name: string; is_enabled: boolean };

async function readEndpoint(
  request: APIRequestContext,
  endpointName: string,
): Promise<LiveEndpoint | undefined> {
  const endpoints = (await (
    await request.get("/api/v1/webhooks/endpoints")
  ).json()) as LiveEndpoint[];

  return endpoints.find((endpoint) => endpoint.name === endpointName);
}

function findEndpointRow(page: Page, endpointName: string) {
  return page.getByRole("row").filter({ hasText: endpointName });
}

async function openSecurityTab(page: Page, endpointName: string) {
  await page.goto("/webhooks/endpoints");
  await page.getByRole("button", { name: `Edit ${endpointName}` }).click();
  const endpointSheet = page.getByRole("dialog", { name: endpointName });
  await endpointSheet.getByRole("tab", { name: "Security" }).click();

  return endpointSheet;
}

test("WH-01.1 an endpoint added in the UI is edited, switched off and deleted on the server", async ({
  page,
  request,
}) => {
  const endpointName = makeUniqueName("Live orders");
  const renamedEndpoint = `${endpointName} API`;
  const failedApiCalls = watchFailedApiCalls(page);
  await page.goto("/webhooks/endpoints");

  await page.getByRole("button", { name: "Add endpoint" }).click();
  const addSheet = page.getByRole("dialog", { name: "Add an endpoint" });
  await addSheet.getByLabel("Name").fill(endpointName);
  await addSheet.getByLabel("URL").fill(unreachableUrl);
  await addSheet.getByRole("button", { name: "Add endpoint" }).click();
  const editSheet = page.getByRole("dialog", { name: endpointName });
  await expect(editSheet.getByRole("tab", { name: "Security" })).toBeEnabled();
  await editSheet.getByLabel("Name").fill(renamedEndpoint);
  await editSheet.getByRole("button", { name: "Save changes" }).click();
  await expect(findEndpointRow(page, renamedEndpoint)).toContainText(
    unreachableUrl,
  );
  expect(await readEndpoint(request, renamedEndpoint)).toMatchObject({
    is_enabled: true,
  });

  await page
    .getByRole("switch", { name: `${renamedEndpoint} enabled` })
    .click();
  await expect
    .poll(
      async () => (await readEndpoint(request, renamedEndpoint))?.is_enabled,
    )
    .toBe(false);

  await page.getByRole("button", { name: `Delete ${renamedEndpoint}` }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(findEndpointRow(page, renamedEndpoint)).toBeHidden();
  expect(await readEndpoint(request, renamedEndpoint)).toBeUndefined();
  expect(failedApiCalls).toEqual([]);
});

test("WH-01.2 Send test delivers test.ping to the app and shows its response", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver(200, "ok");
  const endpointName = makeUniqueName("Live test ping");
  await createEndpoint(request, endpointName, receiver.url);
  await page.goto("/webhooks/endpoints");

  await page
    .getByRole("button", { name: `Send test to ${endpointName}` })
    .click();
  const testDialog = page.getByRole("dialog", {
    name: `Test sent to ${endpointName}`,
  });
  await expect(testDialog).toContainText("200");
  await expect(testDialog).toContainText("webhook-signature");
  await expect(testDialog).toContainText("Response bodyok");
  expect(receiver.receivedBodies).toHaveLength(1);
  expect(receiver.receivedBodies[0]).toMatch(/"type":\s*"test\.ping"/);
  await testDialog.getByRole("link", { name: "Open delivery" }).click();
  await expect(page).toHaveURL(/\/webhooks\/deliveries\?delivery=[0-9A-Z]+/);
  await receiver.close();
});

test("WH-01.3 the live secret stays masked until a confirmed reveal shows the server's value", async ({
  page,
  request,
}) => {
  const endpointName = makeUniqueName("Live secret");
  const endpointId = await createEndpoint(
    request,
    endpointName,
    unreachableUrl,
  );
  const { secret } = (await (
    await request.get(`/api/v1/webhooks/endpoints/${endpointId}/secret`)
  ).json()) as { secret: string };
  const endpointSheet = await openSecurityTab(page, endpointName);
  const secretText = endpointSheet.getByTestId("endpoint-secret");
  await expect(secretText).toHaveText(`whsec_••••${secret.slice(-4)}`);

  await endpointSheet.getByRole("button", { name: "Reveal" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel" })
    .click();
  await expect(secretText).toHaveText(`whsec_••••${secret.slice(-4)}`);

  await endpointSheet.getByRole("button", { name: "Reveal" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reveal" })
    .click();
  await expect(secretText).toHaveText(secret);
  await expect(
    endpointSheet.getByRole("button", { name: "Copy secret" }),
  ).toBeVisible();
});

test("WH-01.7 the table shows the live success rate and sparkline, and the switch applies at once", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver(200, "ok");
  const deliveredName = makeUniqueName("Live sparkline");
  const quietName = makeUniqueName("Live quiet");
  const deliveredId = await createEndpoint(
    request,
    deliveredName,
    receiver.url,
  );
  await createEndpoint(request, quietName, unreachableUrl);
  await sendTestDelivery(request, deliveredId);
  await page.goto("/webhooks/endpoints");

  const deliveredRow = findEndpointRow(page, deliveredName);
  await expect(deliveredRow.getByTestId("success-sparkline")).toBeVisible();
  await expect(deliveredRow).toContainText("100%");
  await expect(findEndpointRow(page, quietName)).toContainText("n/a");

  const quietSwitch = page.getByRole("switch", {
    name: `${quietName} enabled`,
  });
  await quietSwitch.click();
  await expect(quietSwitch).not.toBeChecked();
  await expect
    .poll(async () => (await readEndpoint(request, quietName))?.is_enabled)
    .toBe(false);
  await receiver.close();
});

test("WH-01.8 rotating the live secret shows the new masked secret and until when the old one signs", async ({
  page,
  request,
}) => {
  const endpointName = makeUniqueName("Live rotation");
  const endpointId = await createEndpoint(
    request,
    endpointName,
    unreachableUrl,
  );
  const endpointSheet = await openSecurityTab(page, endpointName);
  const secretText = endpointSheet.getByTestId("endpoint-secret");
  const maskedSecretBefore = (await secretText.textContent()) ?? "";
  await expect(
    endpointSheet.getByTestId("previous-secret-expiry"),
  ).toBeHidden();

  await endpointSheet.getByRole("button", { name: "Rotate secret" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Rotate" })
    .click();

  await expect(secretText).not.toHaveText(maskedSecretBefore);
  const { secret } = (await (
    await request.get(`/api/v1/webhooks/endpoints/${endpointId}/secret`)
  ).json()) as { secret: string };
  await expect(secretText).toHaveText(`whsec_••••${secret.slice(-4)}`);
  await expect(
    endpointSheet.getByTestId("previous-secret-expiry"),
  ).toContainText("The previous secret also signs until");
});
