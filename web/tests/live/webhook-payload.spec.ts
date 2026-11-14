import { expect, test } from "@playwright/test";

import { replaceCodeEditorText } from "../e2e/support/code-editor";
import { watchFailedApiCalls } from "./live-api-watch";
import {
  createEndpoint,
  createRule,
  listEndpointDeliveries,
  makeUniqueName,
  sendEmail,
  startWebhookReceiver,
} from "./live-webhooks";

test("WH-14.2 WH-14.3 a live bounce shows its payload and delivers the edited body as written", async ({
  page,
  request,
}) => {
  const receiver = await startWebhookReceiver();
  const endpointName = makeUniqueName("Payload");
  const endpointId = await createEndpoint(request, endpointName, receiver.url);
  const subject = makeUniqueName("Live payload");
  await createRule(
    request,
    `${endpointName} bounces`,
    endpointId,
    ["email.bounced"],
    { field: "subject", operator: "equals", value: subject },
  );
  const emailId = await sendEmail(request, subject);
  const failedApiCalls = watchFailedApiCalls(page);
  const editedBody = `{"note":"${makeUniqueName("edited")}"}`;

  try {
    await page.goto(`/mail/${emailId}`);
    await page.getByRole("button", { name: "Simulate an event" }).click();
    await page
      .getByRole("menuitem", {
        name: "Choose webhooks for Simulate hard bounce",
      })
      .click();
    const picker = page.getByRole("dialog", { name: "Choose webhooks" });
    await picker
      .getByRole("searchbox", { name: "Search endpoints" })
      .fill(endpointName);
    await picker
      .getByRole("button", { name: `Payload to ${endpointName}` })
      .click();

    const payloadDialog = page.getByRole("dialog", {
      name: `Payload to ${endpointName}`,
    });
    const bodyEditor = payloadDialog.getByRole("textbox", {
      name: "Payload body",
    });
    await expect(bodyEditor).toContainText("email.bounced");
    await replaceCodeEditorText(bodyEditor, editedBody);
    await payloadDialog
      .getByRole("button", { name: "Use this payload" })
      .click();
    await picker.getByRole("button", { name: "Simulate hard bounce" }).click();

    await expect
      .poll(() => receiver.receivedBodies, { timeout: 15_000 })
      .toEqual([editedBody]);
    const [editedDelivery] = await listEndpointDeliveries(request, endpointId);
    expect(editedDelivery?.event_type).toBe("email.bounced");
    expect(editedDelivery?.is_edited).toBe(true);
    expect(failedApiCalls).toEqual([]);
  } finally {
    await receiver.close();
  }
});
