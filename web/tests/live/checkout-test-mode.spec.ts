import { expect, test } from "@playwright/test";

import { buildCustomerEmail, createCheckout } from "./live-payments";

const builtinGatewayKeys = [
  "stripe",
  "paypal",
  "sslcommerz",
  "bkash",
  "native",
];

/** A blank custom gateway, made once per try so a retry does not collide with the last one. */
async function createCustomGateway(
  request: Parameters<typeof createCheckout>[0],
): Promise<string> {
  const gatewayKey = `live_test_mode_${test.info().retry + 1}`;
  const createResponse = await request.post("/api/v1/payments/gateways", {
    data: {
      name: `Live test mode ${test.info().retry + 1}`,
      key: gatewayKey,
      start_from: null,
    },
  });
  expect(createResponse.status()).toBe(201);

  return gatewayKey;
}

test("PY-01.4 every built-in and custom gateway's checkout page shows the TEST MODE banner", async ({
  page,
  request,
}) => {
  const gatewayKeys = [
    ...builtinGatewayKeys,
    await createCustomGateway(request),
  ];

  for (const gatewayKey of gatewayKeys) {
    const paymentId = await createCheckout(
      request,
      buildCustomerEmail(`test-mode-${gatewayKey}`),
      {
        provider: gatewayKey,
        currency:
          gatewayKey === "sslcommerz" || gatewayKey === "bkash" ? "BDT" : "USD",
      },
    );

    await page.goto(`/pay/${paymentId}`);

    const testModeNote = page.getByRole("note", { name: "Test mode" });
    await expect(testModeNote, `${gatewayKey} checkout`).toBeVisible();
    await expect(testModeNote).toContainText("TEST MODE: no real payment");
  }
});
