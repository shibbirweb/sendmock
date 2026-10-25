import { describe, expect, test } from "vitest";

import {
  buildExampleVariableValues,
  fillStepLabel,
  fillStepLabels,
  findUnknownVariables,
  flowLabelVariables,
  readPaymentReference,
} from "@/lib/payments/flow-label-variables";
import { buildDefaultStep } from "@/lib/payments/payment-step-catalogue";

const checkoutValues = {
  method: "Nagad",
  amount: "BDT 3,400.00",
  currency: "BDT",
  merchant: "Acme Shop",
  gateway: "SSLCommerz",
  reference: "SM-8F2KD9XL",
  customer_email: "",
};

describe("step label variables", () => {
  test("PY-12.7 every variable has what it becomes and an example", () => {
    expect(
      flowLabelVariables.map((flowVariable) => flowVariable.token),
    ).toEqual([
      "{method}",
      "{amount}",
      "{currency}",
      "{merchant}",
      "{gateway}",
      "{reference}",
      "{customer_email}",
    ]);
    flowLabelVariables.forEach((flowVariable) => {
      expect(flowVariable.description).not.toBe("");
      expect(flowVariable.example).not.toBe("");
    });
  });

  test("PY-12.7 labels are filled in; unknown variables stay as written", () => {
    expect(
      fillStepLabel("Pay {amount} to {merchant} with {method}", checkoutValues),
    ).toBe("Pay BDT 3,400.00 to Acme Shop with Nagad");
    expect(fillStepLabel("Receipt to {customer_email}", checkoutValues)).toBe(
      "Receipt to ",
    );
    expect(fillStepLabel("Hi {methd}", checkoutValues)).toBe("Hi {methd}");
    expect(
      fillStepLabels(buildDefaultStep("account_number"), checkoutValues)
        .field_label,
    ).toBe("Your Nagad account number");
  });

  test("PY-12.7 unknown variables are found; the examples preview a label", () => {
    expect(findUnknownVariables("{methd} and {amount} and {Total}")).toEqual([
      "{methd}",
    ]);
    expect(
      fillStepLabel("{method} {amount}", buildExampleVariableValues()),
    ).toBe("bKash BDT 1,200.00");
    expect(buildExampleVariableValues("Rocket").method).toBe("Rocket");
    expect(readPaymentReference("01hzx4f2abcd1234")).toBe("SM-ABCD1234");
  });
});
