import { getResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import type { PaymentFlowDefinition } from "@/lib/api/types";
import { replaceMockDatabase } from "@/mocks/db/mock-database";
import { paymentFlowHandlers } from "@/mocks/handlers/payment-flow-handlers";

async function callFlowApi(
  method: string,
  path: string,
  requestBody?: unknown,
): Promise<Response> {
  const response = await getResponse(
    paymentFlowHandlers,
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

async function readFlow(response: Response): Promise<PaymentFlowDefinition> {
  return (await response.json()) as PaymentFlowDefinition;
}

beforeEach(() => {
  replaceMockDatabase("standard");
});

describe("payment flow API", () => {
  test("PY-12.6 lists the seven built-in flows and the step catalogue", async () => {
    const flows = (await (
      await callFlowApi("GET", "/payments/flows")
    ).json()) as PaymentFlowDefinition[];
    expect(flows.map((paymentFlow) => paymentFlow.name)).toEqual([
      "Card",
      "Wallet",
      "Bank",
      "Account",
      "QR",
      "Bank transfer",
      "Voucher",
    ]);
    expect(
      flows.find((paymentFlow) => paymentFlow.key === "wallet"),
    ).toMatchObject({
      is_builtin: true,
      is_modified: false,
      method_count: 3,
    });

    const stepTypes = (await (
      await callFlowApi("GET", "/payments/step-types")
    ).json()) as { type: string }[];
    expect(stepTypes).toHaveLength(9);
  });

  test("PY-12.7 the label variables are served for the CLI and MCP tools", async () => {
    const flowVariables = (await (
      await callFlowApi("GET", "/payments/flow-variables")
    ).json()) as { token: string; description: string; example: string }[];

    expect(flowVariables).toHaveLength(7);
    expect(flowVariables[0]).toEqual({
      token: "{method}",
      description: "The payment method's name",
      example: "bKash",
    });
  });

  test("PY-12.6 a flow is composed one step at a time, then reset to default", async () => {
    const withQr = await readFlow(
      await callFlowApi("POST", "/payments/flows/bank/steps", {
        step: { type: "qr_code" },
        position: 0,
      }),
    );
    expect(withQr.steps.map((flowStep) => flowStep.type)).toEqual([
      "qr_code",
      "confirm",
    ]);
    expect(withQr.steps[0]?.button_label).toBe("I have paid");
    expect(withQr.is_modified).toBe(true);

    const relabelled = await readFlow(
      await callFlowApi("PATCH", "/payments/flows/bank/steps/0", {
        button_label: "Done",
        position: 1,
      }),
    );
    expect(
      relabelled.steps.map((flowStep) => [
        flowStep.type,
        flowStep.button_label,
      ]),
    ).toEqual([
      ["confirm", "Pay with {method}"],
      ["qr_code", "Done"],
    ]);

    const removed = await readFlow(
      await callFlowApi("DELETE", "/payments/flows/bank/steps/0"),
    );
    expect(removed.steps.map((flowStep) => flowStep.type)).toEqual(["qr_code"]);

    const reset = await readFlow(
      await callFlowApi("POST", "/payments/flows/bank/reset"),
    );
    expect(reset.steps.map((flowStep) => flowStep.type)).toEqual(["confirm"]);
    expect(reset.is_modified).toBe(false);
  });

  test("PY-12.6 a step change that breaks the flow is refused with the UI's message", async () => {
    const secondDecider = await callFlowApi(
      "POST",
      "/payments/flows/wallet/steps",
      { step: { type: "card_form" } },
    );
    expect(secondDecider.status).toBe(400);
    expect(await secondDecider.json()).toMatchObject({
      error: {
        message:
          "Use one deciding step at most (card form, account number or voucher code)",
      },
    });

    const lastStep = await callFlowApi(
      "DELETE",
      "/payments/flows/card/steps/0",
    );
    expect(lastStep.status).toBe(400);

    const missingStep = await callFlowApi(
      "DELETE",
      "/payments/flows/card/steps/4",
    );
    expect(missingStep.status).toBe(404);
  });

  test("PY-12.6 a custom flow is added and deleted; built-ins and flows in use are kept", async () => {
    const created = await callFlowApi("POST", "/payments/flows", {
      key: "upay_qr",
      name: "Upay QR",
      picker_tab: "Scan to pay",
      steps: [
        {
          type: "qr_code",
          title: "",
          field_label: "",
          hint: "",
          button_label: "Paid",
        },
      ],
    });
    expect(created.status).toBe(201);
    expect(await readFlow(created)).toMatchObject({
      is_builtin: false,
      method_count: 0,
    });

    expect(
      (await callFlowApi("DELETE", "/payments/flows/upay_qr")).status,
    ).toBe(204);
    expect((await callFlowApi("DELETE", "/payments/flows/wallet")).status).toBe(
      409,
    );
  });
});
