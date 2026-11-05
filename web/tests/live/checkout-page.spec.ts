import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

type CreatedCheckout = { id: string; checkout_url: string };

/** Creates a hosted checkout on the binary, as a shop's backend does. */
async function createCheckout(
  request: APIRequestContext,
  provider: string,
  currency = "USD",
): Promise<CreatedCheckout> {
  const createResponse = await request.post("/api/v1/payments/checkout", {
    data: {
      provider,
      amount_minor: 120_000,
      currency,
      customer_email: "live.buyer@example.com",
    },
  });
  expect(createResponse.status()).toBe(201);

  return (await createResponse.json()) as CreatedCheckout;
}

/** Opens the page at the checkout URL the API answered, behind its TEST MODE banner. */
async function openCheckout(page: Page, createdCheckout: CreatedCheckout) {
  await page.goto(new URL(createdCheckout.checkout_url).pathname);
  await expect(page.getByRole("note", { name: "Test mode" })).toBeVisible();
}

async function fillCard(page: Page, cardNumber: string) {
  const cardForm = page.getByRole("form", { name: "Card details" });
  await cardForm.getByLabel("Card number").fill(cardNumber);
  await cardForm.getByLabel("Expiry (MM/YY)").fill("12/34");
  await cardForm.getByLabel("CVC").fill("123");
  await cardForm.getByRole("button", { name: /^Pay / }).click();
}

async function readPaymentStatus(
  request: APIRequestContext,
  paymentId: string,
): Promise<string> {
  const payment = (await (
    await request.get(`/api/v1/payments/${paymentId}`)
  ).json()) as { status: string };

  return payment.status;
}

async function listRecentEventTypes(
  request: APIRequestContext,
  paymentId: string,
): Promise<string[]> {
  const recentEvents = (await (
    await request.get("/api/v1/events/recent")
  ).json()) as { type: string; data: { id?: string } }[];

  return recentEvents
    .filter((appEvent) => appEvent.data.id === paymentId)
    .map((appEvent) => appEvent.type);
}

const checkoutResult = (page: Page) =>
  page.getByRole("region", { name: "Checkout result" });

test("PY-02.2 and PY-03.2 a Stripe checkout is paid live, redirects to the success URL and fires its events", async ({
  page,
  request,
}) => {
  const createdCheckout = await createCheckout(request, "stripe");
  const failedApiCalls = watchFailedApiCalls(page);

  await openCheckout(page, createdCheckout);
  await expect(page.getByText("TEST MODE: no real payment")).toBeVisible();
  await expect(page.locator("[data-checkout-theme]")).toHaveAttribute(
    "data-checkout-theme",
    "stripe",
  );
  await fillCard(page, "4242 4242 4242 4242");

  await expect(checkoutResult(page)).toContainText("Payment successful");
  await expect(page.getByTestId("redirect-url")).toHaveText(
    "http://localhost:8000/checkout/success",
  );
  await expect(
    page.getByRole("link", { name: "Return to Acme Shop" }),
  ).toHaveAttribute("href", /checkout\/success\?session_id=cs_test_/);
  expect(await readPaymentStatus(request, createdCheckout.id)).toBe(
    "succeeded",
  );
  const eventTypes = await listRecentEventTypes(request, createdCheckout.id);
  expect(eventTypes).toContain("payment.succeeded");
  expect(eventTypes).toContain("checkout.completed");
  expect(failedApiCalls).toEqual([]);
});

test("PY-01.1 a real card number is refused on the live page and never sent", async ({
  page,
  request,
}) => {
  const createdCheckout = await createCheckout(request, "stripe");
  await openCheckout(page, createdCheckout);
  const completeRequests: string[] = [];
  page.on("request", (sentRequest) => {
    if (sentRequest.url().includes("/complete")) {
      completeRequests.push(sentRequest.url());
    }
  });

  await fillCard(page, "4111 1111 1111 1111");

  await expect(
    page.getByText("Use a test card: real card numbers are never accepted"),
  ).toBeVisible();
  expect(completeRequests).toEqual([]);
  expect(await readPaymentStatus(request, createdCheckout.id)).toBe(
    "requires_payment",
  );
});

test("PY-03.1 3-D Secure is approved or failed on the live page", async ({
  page,
  request,
}) => {
  const approvedCheckout = await createCheckout(request, "stripe");
  const failedCheckout = await createCheckout(request, "stripe");

  await openCheckout(page, approvedCheckout);
  await fillCard(page, "4000 0025 0000 3155");
  const challenge = page.getByRole("region", { name: "3-D Secure" });
  await challenge.getByRole("button", { name: "Approve" }).click();
  await expect(checkoutResult(page)).toContainText("Payment successful");

  await openCheckout(page, failedCheckout);
  await fillCard(page, "4000 0025 0000 3155");
  await page.getByRole("button", { name: "Fail authentication" }).click();
  await expect(checkoutResult(page)).toContainText("Payment declined");
  await expect(checkoutResult(page)).toContainText("authentication failed");
});

test("PY-03.1 the live test controls decline with a reason, delay and cancel", async ({
  page,
  request,
}) => {
  const declinedCheckout = await createCheckout(request, "stripe");
  const delayedCheckout = await createCheckout(request, "native");
  const canceledCheckout = await createCheckout(request, "native");

  await openCheckout(page, declinedCheckout);
  const testControls = page.getByRole("complementary", {
    name: "Test controls",
  });
  await testControls.getByRole("combobox", { name: "Decline reason" }).click();
  await page.getByRole("option", { name: "Expired card" }).click();
  await testControls.getByRole("button", { name: "Decline" }).click();
  await expect(checkoutResult(page)).toContainText("expired card");
  await expect(page.getByTestId("redirect-url")).toHaveText(
    "http://localhost:8000/checkout/fail",
  );

  await openCheckout(page, delayedCheckout);
  await page.getByRole("button", { name: "Delay" }).click();
  await expect(checkoutResult(page)).toContainText("Payment pending");

  await openCheckout(page, canceledCheckout);
  await page.getByRole("button", { name: "Cancel payment" }).click();
  await expect(checkoutResult(page)).toContainText("Payment canceled");
  expect(await readPaymentStatus(request, canceledCheckout.id)).toBe(
    "canceled",
  );
});

test("PY-03.2 PayPal shows its approve button and no 3-D Secure control", async ({
  page,
  request,
}) => {
  await openCheckout(page, await createCheckout(request, "paypal"));

  await expect(page.locator("[data-checkout-theme]")).toHaveAttribute(
    "data-checkout-theme",
    "paypal",
  );
  await expect(
    page.getByRole("button", { name: /Approve and pay/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Require 3-D Secure" }),
  ).toBeHidden();
});

test("PY-12.3 SSLCommerz groups its methods live; bKash runs its wallet flow and returns by POST", async ({
  page,
  request,
}) => {
  const createdCheckout = await createCheckout(request, "sslcommerz", "BDT");
  const failedApiCalls = watchFailedApiCalls(page);

  await openCheckout(page, createdCheckout);
  await expect(page.getByRole("tab", { name: "Net banking" })).toBeVisible();
  await page.getByRole("tab", { name: "Mobile banking" }).click();
  await page.getByText("bKash", { exact: true }).click();
  const walletForm = page.getByRole("form", { name: "bKash payment" });
  await walletForm.getByLabel("Your bKash account number").fill("01770000001");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await walletForm.getByLabel("Verification code").fill("123456");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await walletForm.getByLabel("PIN").fill("12121");
  await walletForm.getByRole("button", { name: "Confirm and pay" }).click();

  await expect(checkoutResult(page)).toContainText("by POST");
  await expect(
    page.getByRole("button", { name: "Return to Acme Shop" }),
  ).toBeVisible();
  expect(await readPaymentStatus(request, createdCheckout.id)).toBe(
    "succeeded",
  );
  expect(failedApiCalls).toEqual([]);
});

test("PY-03.3 a paid checkout reopened says it is closed and cannot be paid twice", async ({
  page,
  request,
}) => {
  const createdCheckout = await createCheckout(request, "stripe");
  await openCheckout(page, createdCheckout);
  await fillCard(page, "4242 4242 4242 4242");
  await expect(checkoutResult(page)).toContainText("Payment successful");

  await openCheckout(page, createdCheckout);

  await expect(checkoutResult(page)).toContainText(
    "This checkout is closed and cannot be paid again",
  );
  await expect(page.getByRole("button", { name: /^Pay / })).toHaveCount(0);
  const secondPayment = await request.post(
    `/api/v1/checkout-sessions/${createdCheckout.id}/complete`,
    { data: { action: "pay", method_key: "card" } },
  );
  expect(secondPayment.status()).toBe(409);
});

test("PY-03.4 the live card form works from the keyboard", async ({
  page,
  request,
}) => {
  await openCheckout(page, await createCheckout(request, "stripe"));
  await expect(page.getByLabel("Card number")).toBeVisible();
  // Start from the top of the page, as a visitor arriving from the shop does.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Card number")).toBeFocused();
  await page.keyboard.type("4242424242424242");
  await page.keyboard.press("Tab");
  await page.keyboard.type("12/34");
  await page.keyboard.press("Tab");
  await page.keyboard.type("123");
  await page.keyboard.press("Enter");

  await expect(checkoutResult(page)).toContainText("Payment successful");
});
