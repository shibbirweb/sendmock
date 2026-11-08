import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";

/** Nothing listens on port 9, so notifications fail fast without leaving the machine. */
const unreachableUrl = "http://127.0.0.1:9/payments";
const notificationEndpointName = "Live payment notifications";

type CheckoutOptions = {
  provider?: string;
  currency?: string;
  amountMinor?: number;
  captureMethod?: "automatic" | "manual";
  lineItems?: { name: string; quantity: number; unit_amount_minor: number }[];
};

/**
 * A customer email no other test or retry uses: the live binary keeps one database for the
 * whole run, so each test finds its own payments by it.
 */
export function buildCustomerEmail(caseName: string): string {
  return `live.${caseName}.r${test.info().retry}@example.com`;
}

/** Creates a hosted checkout, as a shop's backend does, and answers the payment's id. */
export async function createCheckout(
  request: APIRequestContext,
  customerEmail: string,
  checkoutOptions: CheckoutOptions = {},
): Promise<string> {
  const createResponse = await request.post("/api/v1/payments/checkout", {
    data: {
      provider: checkoutOptions.provider ?? "stripe",
      amount_minor: checkoutOptions.amountMinor ?? 4_900,
      currency: checkoutOptions.currency ?? "USD",
      customer_email: customerEmail,
      capture_method: checkoutOptions.captureMethod ?? "automatic",
      line_items: checkoutOptions.lineItems,
    },
  });
  expect(createResponse.status()).toBe(201);
  const { id: paymentId } = (await createResponse.json()) as { id: string };

  return paymentId;
}

/** Pays the checkout with Stripe's success test card, as the checkout page does. */
export async function payWithTestCard(
  request: APIRequestContext,
  paymentId: string,
) {
  const completeResponse = await request.post(
    `/api/v1/checkout-sessions/${paymentId}/complete`,
    {
      data: {
        action: "pay",
        method_key: "card",
        card: {
          number: "4242424242424242",
          exp_month: 12,
          exp_year: 2034,
          cvc: "123",
        },
      },
    },
  );
  expect(completeResponse.ok()).toBe(true);
}

export async function simulatePayment(
  request: APIRequestContext,
  paymentId: string,
  simulateRequest: Record<string, unknown>,
) {
  const simulateResponse = await request.post(
    `/api/v1/payments/${paymentId}/simulate`,
    { data: simulateRequest },
  );
  expect(simulateResponse.ok()).toBe(true);
}

async function findOrCreateNotificationEndpoint(
  request: APIRequestContext,
): Promise<string> {
  const endpoints = (await (
    await request.get("/api/v1/webhooks/endpoints")
  ).json()) as { id: string; name: string }[];
  const existingEndpoint = endpoints.find(
    (endpoint) => endpoint.name === notificationEndpointName,
  );
  if (existingEndpoint !== undefined) {
    return existingEndpoint.id;
  }
  const createResponse = await request.post("/api/v1/webhooks/endpoints", {
    data: {
      name: notificationEndpointName,
      url: unreachableUrl,
      is_enabled: true,
      method: "POST",
      headers: {},
      extra_fields: {},
      template_id: "native",
      template_mode: "linked",
      timeout_ms: 2_000,
      retry_policy: {
        max_attempts: 1,
        backoff_seconds: [],
        retry_on_client_errors: false,
      },
      query_params: [],
      body_mode: "template",
      body_fields: [],
      fields_encoding: "json",
      raw_content_type: "application/json",
      raw_body: "",
      render_mode: "strict",
    },
  });
  expect(createResponse.status()).toBe(201);
  const { id: endpointId } = (await createResponse.json()) as { id: string };

  return endpointId;
}

/** Points the gateway's notifications at an endpoint, so payments list their deliveries. */
export async function sendGatewayNotifications(
  request: APIRequestContext,
  gatewayKey: string,
) {
  const endpointId = await findOrCreateNotificationEndpoint(request);
  const gatewayPath = `/api/v1/payments/gateways/${gatewayKey}`;
  const paymentGateway = (await (await request.get(gatewayPath)).json()) as {
    notification_endpoint_id: string | null;
  };
  if (paymentGateway.notification_endpoint_id === endpointId) {
    return;
  }
  const updateResponse = await request.patch(gatewayPath, {
    data: { ...paymentGateway, notification_endpoint_id: endpointId },
  });
  expect(updateResponse.ok()).toBe(true);
}

export function paymentRow(page: Page, customerEmail: string): Locator {
  return page.getByTestId("payment-row").filter({ hasText: customerEmail });
}

/** Opens the payment's drawer straight from its URL, as a shared link does. */
export async function openPaymentDrawer(
  page: Page,
  paymentId: string,
): Promise<Locator> {
  await page.goto(`/payments?payment=${paymentId}`);
  const paymentDrawer = page.getByRole("dialog", { name: "Payment" });
  await expect(
    paymentDrawer.getByRole("region", { name: "Payment overview" }),
  ).toBeVisible();

  return paymentDrawer;
}

function findMenuItem(page: Page, menuLabel: string): Locator {
  return page.getByRole("menuitem", { name: menuLabel, exact: true });
}

/** Opens the Simulate menu and its submenus until the last item shows. */
async function openSimulateMenuPath(
  page: Page,
  paymentDrawer: Locator,
  menuPath: string[],
) {
  // A click inside the drawer dismisses a menu left open by the last try. Escape would close
  // the drawer itself when pressed once more while the menu is still animating closed.
  if ((await page.getByRole("menu").count()) > 0) {
    await paymentDrawer
      .getByRole("heading")
      .first()
      .click({ force: true, timeout: 2_000 });
    await expect(page.getByRole("menu")).toHaveCount(0, { timeout: 2_000 });
  }
  await paymentDrawer.getByRole("button", { name: "Simulate" }).click();
  for (const [menuIndex, menuLabel] of menuPath.slice(0, -1).entries()) {
    const submenuTrigger = findMenuItem(page, menuLabel);
    const nextMenuItem = findMenuItem(page, menuPath[menuIndex + 1] ?? "");
    await submenuTrigger.focus({ timeout: 2_000 });
    await submenuTrigger.press("ArrowRight", { timeout: 2_000 });
    if (!(await nextMenuItem.isVisible())) {
      // The pointer opens a submenu too, when the keyboard did not.
      await submenuTrigger.hover({ force: true, timeout: 2_000 });
    }
    await expect(nextMenuItem).toBeVisible({ timeout: 2_000 });
  }
  await expect(findMenuItem(page, menuPath.at(-1) ?? "")).toBeVisible({
    timeout: 2_000,
  });
}

export async function chooseSimulateAction(
  page: Page,
  paymentDrawer: Locator,
  ...menuPath: string[]
) {
  // A live update can re-render the drawer and close the menu, so the path is opened again
  // until it stays open. The keyboard reaches each item even while a toast covers it.
  await expect(async () => {
    await openSimulateMenuPath(page, paymentDrawer, menuPath);
  }).toPass({ timeout: 15_000 });
  const lastMenuItem = findMenuItem(page, menuPath.at(-1) ?? "");
  await lastMenuItem.focus();
  await lastMenuItem.press("Enter");
}

/** A name no other retry uses, since a retry finds the custom items the last try added. */
export function buildLiveName(baseName: string): string {
  return `${baseName} ${test.info().retry + 1}`;
}

/**
 * Puts a built-in flow, method or gateway back to its default through the API, so a test
 * that failed half way leaves nothing edited for the next one. Resetting an unedited
 * built-in is harmless, so the answer is not checked.
 */
export async function resetPaymentDefinition(
  request: APIRequestContext,
  definitionKind: "flows" | "methods" | "gateways",
  definitionKey: string,
) {
  await request.post(
    `/api/v1/payments/${definitionKind}/${definitionKey}/reset`,
  );
}

/** Opens a new checkout's page, as the shop's customer does. */
export async function openCheckoutPage(page: Page, paymentId: string) {
  await page.goto(`/pay/${paymentId}`);
  await expect(page.getByRole("note", { name: "Test mode" })).toBeVisible();
}

export const checkoutResult = (page: Page) =>
  page.getByRole("region", { name: "Checkout result" });
