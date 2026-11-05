import { expect, type Locator, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import {
  buildCustomerEmail,
  chooseSimulateAction,
  createCheckout,
  openPaymentDrawer,
  paymentRow,
  sendGatewayNotifications,
  simulatePayment,
} from "./live-payments";

const paymentOverview = (paymentDrawer: Locator) =>
  paymentDrawer.getByRole("region", { name: "Payment overview" });

test("PY-09.3 a waiting checkout is declined with a reason from the live menu, and the list shows it at once", async ({
  page,
  request,
}) => {
  const customerEmail = buildCustomerEmail("simulate-decline");
  const paymentId = await createCheckout(request, customerEmail);
  const failedApiCalls = watchFailedApiCalls(page);
  const paymentDrawer = await openPaymentDrawer(page, paymentId);

  await paymentDrawer.getByRole("button", { name: "Simulate" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Expire checkout" }),
  ).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Refund..." })).toBeHidden();
  await page.getByRole("menuitem", { name: "Decline" }).click();
  await page.getByRole("menuitem", { name: "Insufficient funds" }).click();

  await expect(paymentOverview(paymentDrawer)).toContainText(
    "Failed: insufficient funds",
  );
  await expect(paymentRow(page, customerEmail)).toContainText(
    "Failed: insufficient funds",
  );
  expect(failedApiCalls).toEqual([]);
});

test("PY-09.3 a waiting checkout succeeds or expires from the live menu", async ({
  page,
  request,
}) => {
  const succeededPaymentId = await createCheckout(
    request,
    buildCustomerEmail("simulate-succeed"),
  );
  const expiredPaymentId = await createCheckout(
    request,
    buildCustomerEmail("simulate-expire"),
  );

  const succeededDrawer = await openPaymentDrawer(page, succeededPaymentId);
  await chooseSimulateAction(page, succeededDrawer, "Succeed");
  await expect(paymentOverview(succeededDrawer)).toContainText("Succeeded");

  const expiredDrawer = await openPaymentDrawer(page, expiredPaymentId);
  await chooseSimulateAction(page, expiredDrawer, "Expire checkout");
  await expect(paymentOverview(expiredDrawer)).toContainText("Canceled");
  await expect(
    expiredDrawer.getByRole("button", { name: "Simulate" }),
  ).toBeDisabled();
});

test("PY-09.3 live refunds are capped, then a dispute is opened and lost", async ({
  page,
  request,
}) => {
  const paymentId = await createCheckout(
    request,
    buildCustomerEmail("simulate-refund"),
  );
  await simulatePayment(request, paymentId, { action: "succeed" });
  const paymentDrawer = await openPaymentDrawer(page, paymentId);

  await chooseSimulateAction(page, paymentDrawer, "Refund...");
  const refundDialog = page.getByRole("dialog", { name: "Refund payment" });
  await expect(refundDialog.getByLabel("Amount (USD)")).toHaveValue("49.00");
  await refundDialog.getByLabel("Amount (USD)").fill("60");
  await refundDialog.getByRole("button", { name: "Refund" }).click();
  await expect(
    refundDialog.getByText("That is more than is left to refund"),
  ).toBeVisible();
  await refundDialog.getByLabel("Amount (USD)").fill("20");
  await refundDialog.getByRole("button", { name: "Refund" }).click();
  await expect(refundDialog).toBeHidden();
  const overview = paymentOverview(paymentDrawer);
  await expect(overview).toContainText("Partly refunded");
  await expect(overview).toContainText("$20.00");

  await chooseSimulateAction(page, paymentDrawer, "Open dispute");
  await expect(overview).toContainText("Disputed");
  await chooseSimulateAction(page, paymentDrawer, "Resolve dispute", "Lost");
  await expect(overview).toContainText("Refunded");
  await expect(overview).toContainText("lost");
});

test("PY-09.3 a live dispute can be won, keeping the payment", async ({
  page,
  request,
}) => {
  const paymentId = await createCheckout(
    request,
    buildCustomerEmail("simulate-dispute-won"),
  );
  await simulatePayment(request, paymentId, { action: "succeed" });
  const paymentDrawer = await openPaymentDrawer(page, paymentId);

  await chooseSimulateAction(page, paymentDrawer, "Open dispute");
  await expect(paymentOverview(paymentDrawer)).toContainText("Disputed");
  await chooseSimulateAction(page, paymentDrawer, "Resolve dispute", "Won");

  await expect(paymentOverview(paymentDrawer)).toContainText("Succeeded");
  await expect(paymentOverview(paymentDrawer)).toContainText("won");
});

test("PY-07.3 a live dispute is answered with evidence, goes under review and is then won", async ({
  page,
  request,
}) => {
  const paymentId = await createCheckout(
    request,
    buildCustomerEmail("simulate-dispute-answer"),
  );
  await simulatePayment(request, paymentId, { action: "succeed" });
  await simulatePayment(request, paymentId, { action: "dispute" });
  const paymentDrawer = await openPaymentDrawer(page, paymentId);

  await chooseSimulateAction(page, paymentDrawer, "Answer dispute...");
  const answerDialog = page.getByRole("dialog", { name: "Answer dispute" });
  await answerDialog.getByLabel("Evidence").fill("Signed delivery receipt.");
  await answerDialog.getByRole("button", { name: "Send answer" }).click();

  await expect(answerDialog).toBeHidden();
  await expect(paymentOverview(paymentDrawer)).toContainText("under review");
  await expect(paymentOverview(paymentDrawer)).toContainText(
    "Signed delivery receipt.",
  );
  await chooseSimulateAction(page, paymentDrawer, "Resolve dispute", "Won");
  await expect(paymentOverview(paymentDrawer)).toContainText("won");
});

test("PY-09.3 a live authorization is captured or voided, and a notification can be resent", async ({
  page,
  request,
}) => {
  await sendGatewayNotifications(request, "stripe");
  const capturedPaymentId = await createCheckout(
    request,
    buildCustomerEmail("simulate-capture"),
    { captureMethod: "manual" },
  );
  const voidedPaymentId = await createCheckout(
    request,
    buildCustomerEmail("simulate-void"),
    { captureMethod: "manual" },
  );
  await simulatePayment(request, capturedPaymentId, { action: "succeed" });
  await simulatePayment(request, voidedPaymentId, { action: "succeed" });

  const capturedDrawer = await openPaymentDrawer(page, capturedPaymentId);
  await expect(paymentOverview(capturedDrawer)).toContainText("Authorized");
  await chooseSimulateAction(page, capturedDrawer, "Capture");
  await expect(paymentOverview(capturedDrawer)).toContainText("Succeeded");
  const succeededNotifications = capturedDrawer
    .getByTestId("payment-notification")
    .filter({ hasText: "payment_intent.succeeded" });
  await expect(succeededNotifications).toHaveCount(1);
  await capturedDrawer
    .getByRole("button", { name: "Resend notification" })
    .click();
  await expect(succeededNotifications).toHaveCount(2);

  const voidedDrawer = await openPaymentDrawer(page, voidedPaymentId);
  await chooseSimulateAction(page, voidedDrawer, "Void authorization");
  await expect(paymentOverview(voidedDrawer)).toContainText("Canceled");
});
