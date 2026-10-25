import { describe, expect, test } from "vitest";

import type { PaymentDetail } from "@/lib/api/types";
import { createMockDatabase } from "@/mocks/db/mock-database";
import { findGatewayRecord } from "@/mocks/payments/payment-gateway-record";
import {
  type GatewayRenderOptions,
  renderGatewayNotification,
  renderGatewayRedirect,
} from "@/mocks/payments/render-gateway-templates";

function setUp(gatewayKey: string) {
  const mockDatabase = createMockDatabase("standard");
  const paymentGateway = findGatewayRecord(mockDatabase, gatewayKey);
  const paymentDetail = mockDatabase.payments.find(
    (payment) => payment.provider === gatewayKey,
  );
  if (paymentGateway === undefined || paymentDetail === undefined) {
    throw new Error(`The fixtures need a ${gatewayKey} gateway and payment.`);
  }

  return { paymentGateway, paymentDetail: paymentDetail as PaymentDetail };
}

const renderOptions: GatewayRenderOptions = {
  eventType: "payment.succeeded",
  redirectOutcome: "success",
  eventId: "evt_test",
  timestampSeconds: 1792914927,
  shouldMaskSecrets: false,
};

describe("gateway templates", () => {
  test("PY-12.3 Stripe's notification is its event JSON with a signature header", () => {
    const { paymentGateway, paymentDetail } = setUp("stripe");
    const notification = renderGatewayNotification(
      paymentGateway,
      paymentDetail,
      renderOptions,
    );

    expect(notification?.eventName).toBe("payment_intent.succeeded");
    expect(notification?.headers["stripe-signature"]).toMatch(
      /^t=\d+,v1=[0-9a-f]{64}$/,
    );
    expect(JSON.parse(notification?.body ?? "")).toMatchObject({
      object: "event",
      type: "payment_intent.succeeded",
      created: 1792914927,
      data: {
        object: {
          id: paymentDetail.provider_reference,
          amount: paymentDetail.amount_minor,
          currency: paymentDetail.currency.toLowerCase(),
        },
      },
    });
    expect(notification?.problems).toEqual([]);
  });

  test("PY-12.3 SSLCommerz posts a form and redirects by POST with its status word", () => {
    const { paymentGateway, paymentDetail } = setUp("sslcommerz");
    const notification = renderGatewayNotification(
      paymentGateway,
      paymentDetail,
      renderOptions,
    );
    expect(notification?.headers["content-type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(new URLSearchParams(notification?.body).get("status")).toBe("VALID");

    const failRedirect = renderGatewayRedirect(paymentGateway, paymentDetail, {
      ...renderOptions,
      redirectOutcome: "fail",
    });
    expect(failRedirect).toMatchObject({
      method: "POST",
      fields: { status: "FAILED", tran_id: paymentDetail.provider_reference },
    });
  });

  test("PY-12.3 a success-only field is sent on success only; an unnamed event sends nothing", () => {
    const { paymentGateway, paymentDetail } = setUp("paypal");

    expect(
      renderGatewayRedirect(paymentGateway, paymentDetail, renderOptions)
        .fields,
    ).toEqual({
      token: paymentDetail.provider_reference,
      PayerID: "TESTPAYER01",
    });
    expect(
      renderGatewayRedirect(paymentGateway, paymentDetail, {
        ...renderOptions,
        redirectOutcome: "cancel",
      }).fields,
    ).toEqual({ token: paymentDetail.provider_reference });
    expect(
      renderGatewayNotification(paymentGateway, paymentDetail, {
        ...renderOptions,
        eventType: "payment.created",
      }),
    ).toBeNull();
  });

  test("PY-12.4 secrets render masked in previews and problems name their part", () => {
    const { paymentGateway, paymentDetail } = setUp("sslcommerz");
    const notification = renderGatewayNotification(
      {
        ...paymentGateway,
        notification_body:
          "pass={{ merchant.store_passwd }}&x={{ payment.nope | shout }}",
      },
      paymentDetail,
      { ...renderOptions, shouldMaskSecrets: true },
    );

    expect(notification?.body).toContain("pass=••••@ssl");
    expect(notification?.body).not.toContain("sendm0000000001@ssl");
    expect(notification?.problems).toContainEqual({
      part: "Notification body",
      message: "Unknown filter: shout",
      severity: "error",
    });
  });
});
