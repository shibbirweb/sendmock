import { describe, expect, test } from "vitest";

import type { PaymentGatewayInput } from "@/lib/api/types";
import {
  validateNewGateway,
  validatePaymentGateway,
} from "@/lib/payments/validate-payment-gateway";

const gatewayInput = {
  key: "nagad_pay",
  name: "Nagad Pay",
  accent: "#f6921e",
  is_enabled: true,
  method_keys: ["nagad"],
  credentials: [
    { name: "merchant_id", value: "683002007104225", is_secret: false },
  ],
  notification_endpoint_id: null,
  redirect_method: "GET",
  redirect_fields: [
    {
      name: "payment_ref_id",
      template: "{{ payment.reference }}",
      send_on: "always",
    },
  ],
  notification_content_type: "json",
  event_names: {} as PaymentGatewayInput["event_names"],
  notification_body: "{}",
  notification_headers: [],
} satisfies PaymentGatewayInput;

describe("validatePaymentGateway", () => {
  test("PY-12.2 accepts a gateway with a method and named rows", () => {
    expect(validatePaymentGateway(gatewayInput)).toEqual({});
  });

  test("PY-12.2 names each problem: name, accent, methods and rows", () => {
    expect(
      validatePaymentGateway({
        ...gatewayInput,
        name: "",
        accent: "orange",
        method_keys: [],
        credentials: [
          { name: "key", value: "1", is_secret: false },
          { name: "KEY", value: "2", is_secret: true },
        ],
        redirect_fields: [{ name: "", template: "x", send_on: "always" }],
        notification_headers: [{ name: "bad header", template: "x" }],
      }),
    ).toEqual({
      name: "Enter a name",
      accent: "Use a colour like #1e5bb8",
      method_keys: "Offer at least one method",
      credentials: "key appears twice",
      redirect_fields: "Every redirect field needs a name",
      notification_headers:
        "bad header is not a valid name: use letters, digits, _, . or -",
    });
  });

  test("PY-12.2 a new gateway needs a free key and a name", () => {
    expect(
      validateNewGateway("stripe", "Stripe 2", [{ key: "stripe" }]),
    ).toEqual({
      key: "A gateway with the key stripe already exists",
    });
    expect(validateNewGateway("Nagad Pay", " ", [])).toEqual({
      key: "Use 2 to 32 lowercase letters, digits or _, starting with a letter",
      name: "Enter a name",
    });
  });
});
