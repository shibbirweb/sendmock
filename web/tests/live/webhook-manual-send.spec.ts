import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import {
  createEndpoint,
  createVariable,
  makeUniqueName,
  makeUniqueVariableName,
  pickOption,
  sendEmail,
  startWebhookReceiver,
} from "./live-webhooks";

const threadList = "section[aria-label='Conversation list']";

async function openSendDialogForEmail(
  page: Page,
  emailId: string,
  endpointName: string,
) {
  await page.goto(`/mail/${emailId}`);
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Send to webhook" }).click();
  const sendDialog = page.getByRole("dialog", { name: "Send to webhook" });
  await expect(
    sendDialog.getByRole("region", { name: "Rendered body" }),
  ).toBeVisible();
  await pickOption(page, "Endpoint", endpointName);

  return sendDialog;
}

/** A text variable and a Prompt variable, both read by the endpoint's headers. */
async function createHeaderVariables(request: APIRequestContext) {
  const tenantVariable = makeUniqueVariableName("live_tenant");
  const reasonVariable = makeUniqueVariableName("live_reason");
  await createVariable(request, tenantVariable, "text", "acme");
  await createVariable(request, reasonVariable, "prompt", "manual test");

  return {
    tenantVariable,
    reasonVariable,
    endpointHeaders: {
      "X-Tenant": `{{ vars.${tenantVariable} }}`,
      "X-Reason": `{{ vars.${reasonVariable} }}`,
    },
  };
}

test("WH-05.1 a live email is sent to the chosen endpoint in the chosen format", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver(200, "ok");
  const endpointName = makeUniqueName("Live manual email");
  await createEndpoint(request, endpointName, receiver.url);
  const subject = makeUniqueName("Welcome");
  const emailId = await sendEmail(request, subject);
  const sendDialog = await openSendDialogForEmail(page, emailId, endpointName);
  const renderedBody = sendDialog.getByRole("region", {
    name: "Rendered body",
  });
  await expect(renderedBody).toContainText(subject);

  await pickOption(page, "Format", "Slack: incoming webhook");
  await expect(renderedBody).toContainText('"blocks"');
  await sendDialog.getByRole("button", { name: "Send", exact: true }).click();
  const sendResult = sendDialog.getByTestId("sent-delivery-result");
  await expect(sendResult).toContainText(`Sent to ${endpointName}`);
  expect(receiver.receivedBodies.at(-1)).toContain('"blocks"');

  await sendResult.getByRole("link", { name: "Open delivery" }).click();
  const deliveryDrawer = page.getByRole("dialog", { name: "Delivery" });
  await expect(deliveryDrawer).toContainText("manual");
  await expect(deliveryDrawer).toContainText('"blocks"');
  await receiver.close();
});

test("WH-05.1 a live SMS is sent to a webhook from its message menu", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver(200, "ok");
  const endpointName = makeUniqueName("Live manual SMS");
  await createEndpoint(request, endpointName, receiver.url);
  const contactNumber = "+14155550177";
  const smsResponse = await request.post("/api/v1/sms", {
    data: { from: "+15550001111", to: contactNumber, body: "Live webhook SMS" },
  });
  expect(smsResponse.status()).toBe(201);
  await page.goto("/sms");
  await page.locator(threadList).getByText(contactNumber).click();

  await page.getByRole("button", { name: "Message actions" }).last().click();
  await page.getByRole("menuitem", { name: "Send to webhook" }).click();
  const sendDialog = page.getByRole("dialog", { name: "Send to webhook" });
  await expect(
    sendDialog.getByRole("region", { name: "Rendered body" }),
  ).toBeVisible();
  await pickOption(page, "Endpoint", endpointName);
  await sendDialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(sendDialog.getByTestId("sent-delivery-result")).toContainText(
    `Sent to ${endpointName}`,
  );
  expect(receiver.receivedBodies.at(-1)).toContain("Live webhook SMS");
  await receiver.close();
});

test("WH-05.5 live Prompt variables start at their default and overrides win for one send", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver(200, "ok");
  const variables = await createHeaderVariables(request);
  const endpointName = makeUniqueName("Live prompts");
  await createEndpoint(request, endpointName, receiver.url, {
    headers: variables.endpointHeaders,
  });
  const emailId = await sendEmail(request, makeUniqueName("Prompted"));
  const sendDialog = await openSendDialogForEmail(page, emailId, endpointName);
  await expect(
    sendDialog.getByLabel(`vars.${variables.reasonVariable}`),
  ).toHaveValue("manual test");
  const renderedHeaders = sendDialog.getByRole("region", {
    name: "Rendered headers",
  });
  await expect(renderedHeaders).toContainText("acme");

  await sendDialog.getByRole("button", { name: "Add override" }).click();
  await sendDialog.getByLabel("Override 1 name").fill(variables.tenantVariable);
  await sendDialog.getByLabel("Override 1 value").fill("globex");
  await expect(renderedHeaders).toContainText("globex");
  await sendDialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(sendDialog.getByTestId("sent-delivery-result")).toContainText(
    `Sent to ${endpointName}`,
  );

  const storedVariables = (await (
    await request.get("/api/v1/webhooks/variables")
  ).json()) as {
    name: string;
    value: string;
  }[];
  expect(
    storedVariables.find(
      (variable) => variable.name === variables.tenantVariable,
    )?.value,
  ).toBe("acme");
  await receiver.close();
});

test("WH-05.6 an edited live body is sent as written and the result is saved", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver(200, "ok");
  const endpointName = makeUniqueName("Live edited");
  await createEndpoint(request, endpointName, receiver.url);
  const subject = makeUniqueName("Edit me");
  const emailId = await sendEmail(request, subject);
  const sendDialog = await openSendDialogForEmail(page, emailId, endpointName);
  await sendDialog.getByRole("switch", { name: "Edit body" }).click();
  const bodyEditor = sendDialog.getByRole("textbox", { name: "Edited body" });
  await expect(bodyEditor).toContainText(subject);
  await bodyEditor.fill('{ "note": "edited by hand" }');

  await sendDialog.getByRole("button", { name: "Send", exact: true }).click();
  const sendResult = sendDialog.getByTestId("sent-delivery-result");
  await expect(sendResult).toContainText(`Sent to ${endpointName}`);
  expect(receiver.receivedBodies.at(-1)).toBe('{ "note": "edited by hand" }');
  const savedName = makeUniqueName("Edited welcome");
  await sendResult.getByRole("button", { name: "Save" }).click();
  const nameDialog = page.getByRole("dialog", { name: "Save this request" });
  await nameDialog.getByLabel("Name").fill(savedName);
  await nameDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const savedDeliveries = (await (
    await request.get("/api/v1/webhooks/saved")
  ).json()) as {
    name: string;
  }[];
  expect(savedDeliveries.map((saved) => saved.name)).toContain(savedName);

  await sendResult.getByRole("link", { name: "Open delivery" }).click();
  await expect(page.getByRole("dialog", { name: "Delivery" })).toContainText(
    "edited by hand",
  );
  await receiver.close();
});

test("WH-05.3 the composer sends a live request started from a template preset", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver(200, "ok");
  const endpointName = makeUniqueName("Live composer");
  await createEndpoint(request, endpointName, receiver.url);
  await page.goto("/webhooks/composer");
  await pickOption(page, "Send to", endpointName);
  await pickOption(page, "Preset", "Slack: incoming webhook");
  await expect(page.getByRole("textbox", { name: "Raw body" })).toContainText(
    '"blocks"',
  );
  await expect(page.getByLabel("Content type")).toHaveValue("application/json");

  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByTestId("sent-delivery-result")).toContainText(
    `Sent to ${endpointName}`,
  );
  expect(receiver.receivedBodies.at(-1)).toContain('"blocks"');
  await receiver.close();
});

test("WH-05.5 the live composer asks for Prompt variables and WH-05.6 errors block sending", async ({
  page,
  request,
}) => {
  const reasonVariable = makeUniqueVariableName("live_reason");
  await createVariable(request, reasonVariable, "prompt", "manual test");
  const endpointName = makeUniqueName("Live composer prompts");
  await createEndpoint(request, endpointName, "http://127.0.0.1:9/hooks");
  await page.goto("/webhooks/composer");
  await pickOption(page, "Send to", endpointName);
  const rawEditor = page.getByRole("textbox", { name: "Raw body" });
  await page.getByLabel("Content type").fill("text/plain");
  await rawEditor.fill(`Reason: {{ vars.${reasonVariable} }}`);
  const renderedBody = page.getByRole("region", { name: "Rendered body" });
  await expect(renderedBody).toContainText("Reason: manual test");

  await page.getByLabel(`vars.${reasonVariable}`).fill("smoke run");
  await expect(renderedBody).toContainText("Reason: smoke run");
  await rawEditor.fill("{{ nope() }}");
  await expect(
    page.getByText("Fix the errors in the preview to send."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeDisabled();
});
