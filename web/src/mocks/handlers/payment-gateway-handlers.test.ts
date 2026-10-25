import { getResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import type {
  CheckoutSession,
  PaymentDetail,
  PaymentGatewayDefinition,
  PaymentGatewayPreview,
} from "@/lib/api/types";
import { mockDatabase, replaceMockDatabase } from "@/mocks/db/mock-database";
import { checkoutHandlers } from "@/mocks/handlers/checkout-handlers";
import { paymentGatewayHandlers } from "@/mocks/handlers/payment-gateway-handlers";

async function callApi(
  method: string,
  path: string,
  requestBody?: unknown,
): Promise<Response> {
  const response = await getResponse(
    [...paymentGatewayHandlers, ...checkoutHandlers],
    new Request(`http://localhost/api/v1${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
    }),
  );
  if (response === undefined) {
    throw new Error(`No mock handler for ${method} ${path}`);
  }

  return response;
}

async function readJson<ResponseType>(
  response: Response,
): Promise<ResponseType> {
  return (await response.json()) as ResponseType;
}

beforeEach(() => {
  replaceMockDatabase("standard");
});

describe("payment gateway API", () => {
  test("PY-12.2 lists the five built-ins with secrets masked; a secret is revealed on request", async () => {
    const gateways = await readJson<PaymentGatewayDefinition[]>(
      await callApi("GET", "/payments/gateways"),
    );
    expect(gateways.map((paymentGateway) => paymentGateway.name)).toEqual([
      "Stripe",
      "PayPal",
      "SSLCommerz",
      "bKash",
      "Native",
    ]);
    expect(JSON.stringify(gateways)).not.toContain("sendm0000000001@ssl");

    expect(
      await readJson(
        await callApi(
          "GET",
          "/payments/gateways/sslcommerz/credentials/store_passwd",
        ),
      ),
    ).toEqual({ name: "store_passwd", value: "sendm0000000001@ssl" });
  });

  test("PY-12.3 a custom gateway's checkout, redirect and notification follow its definition", async () => {
    const created = await callApi("POST", "/payments/gateways", {
      name: "Nagad Pay",
      key: "nagad_pay",
      start_from: null,
    });
    expect(created.status).toBe(201);
    const nagadPay = await readJson<PaymentGatewayDefinition>(created);
    const saved = await callApi("PATCH", "/payments/gateways/nagad_pay", {
      ...nagadPay,
      method_keys: ["nagad"],
      redirect_fields: [
        {
          name: "payment_ref_id",
          template: "{{ payment.reference }}",
          send_on: "always",
        },
        {
          name: "status",
          template: "{{ redirect.status }}",
          send_on: "always",
        },
      ],
      event_names: { ...nagadPay.event_names, "payment.succeeded": "Success" },
    });
    expect(saved.status).toBe(200);

    const payment = await readJson<PaymentDetail>(
      await callApi("POST", "/payments/checkout", {
        provider: "nagad_pay",
        amount_minor: 2500,
        currency: "BDT",
      }),
    );
    expect(payment.provider_name).toBe("Nagad Pay");
    const session = await readJson<CheckoutSession>(
      await callApi("GET", `/checkout-sessions/${payment.id}`),
    );
    expect(session.methods.map((paymentMethod) => paymentMethod.key)).toEqual([
      "nagad",
    ]);

    const paid = await readJson<CheckoutSession>(
      await callApi("POST", `/checkout-sessions/${payment.id}/complete`, {
        action: "pay",
        method_key: "nagad",
        entries: { number: "01880000001", otp: "123456", pin: "12121" },
      }),
    );
    expect(paid.redirect?.fields).toEqual({
      payment_ref_id: payment.provider_reference,
      status: "Success",
    });
    const storedPayment = mockDatabase.payments.find(
      (candidate) => candidate.id === payment.id,
    );
    expect(
      storedPayment?.notifications.map(
        (notification) => notification.provider_event_name,
      ),
    ).toContain("Success");
  });

  test("PY-12.4 the preview renders an unsaved gateway; a save with template errors is refused", async () => {
    const stripe = (
      await readJson<PaymentGatewayDefinition[]>(
        await callApi("GET", "/payments/gateways"),
      )
    )[0];
    const brokenStripe = {
      ...stripe,
      notification_body: '{"amount": "{{ payment.amount_major | shout }}"}',
    };
    const preview = await readJson<PaymentGatewayPreview>(
      await callApi("POST", "/payments/gateways/stripe/preview", {
        gateway: brokenStripe,
        event_type: "payment.succeeded",
        redirect_outcome: "success",
      }),
    );
    expect(preview.notification?.event_name).toBe("payment_intent.succeeded");
    expect(preview.problems).toContainEqual({
      part: "Notification body",
      message: "Unknown filter: shout",
      severity: "error",
    });
    expect(preview.reference.fields.map((field) => field.name)).toEqual([
      "payment",
      "event",
      "redirect",
      "merchant",
    ]);

    const refusedSave = await callApi(
      "PATCH",
      "/payments/gateways/stripe",
      brokenStripe,
    );
    expect(refusedSave.status).toBe(400);
    expect(await refusedSave.json()).toMatchObject({
      error: { message: "Notification body: Unknown filter: shout" },
    });
  });

  test("PY-12.2 built-ins reset and cannot be deleted; a custom gateway in use cannot either", async () => {
    const sslcommerz = (
      await readJson<PaymentGatewayDefinition[]>(
        await callApi("GET", "/payments/gateways"),
      )
    )[2];
    const edited = await readJson<PaymentGatewayDefinition>(
      await callApi("PATCH", "/payments/gateways/sslcommerz", {
        ...sslcommerz,
        name: "SSLCommerz sandbox",
      }),
    );
    expect(edited.is_modified).toBe(true);
    const reset = await readJson<PaymentGatewayDefinition>(
      await callApi("POST", "/payments/gateways/sslcommerz/reset"),
    );
    expect(reset).toMatchObject({ name: "SSLCommerz", is_modified: false });
    expect(
      (await callApi("DELETE", "/payments/gateways/sslcommerz")).status,
    ).toBe(409);

    await callApi("POST", "/payments/gateways", {
      name: "Upay",
      key: "upay",
      start_from: null,
    });
    await callApi("POST", "/payments/checkout", {
      provider: "upay",
      amount_minor: 100,
      currency: "USD",
    });
    expect((await callApi("DELETE", "/payments/gateways/upay")).status).toBe(
      409,
    );
  });
});
