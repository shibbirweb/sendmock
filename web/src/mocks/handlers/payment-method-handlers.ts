import { http, HttpResponse } from "msw";

import type { PaymentMethodInput } from "@/lib/api/types";
import { validatePaymentMethod } from "@/lib/payments/validate-payment-method";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import {
  applyMethodInput,
  findShippedMethod,
  presentPaymentMethod,
} from "@/mocks/payments/payment-method-record";

function findMethodIndex(methodKey: unknown): number {
  return mockDatabase.paymentMethods.findIndex(
    (methodRecord) => methodRecord.key === methodKey,
  );
}

function presentMethodAt(methodIndex: number) {
  const methodRecord = mockDatabase.paymentMethods[methodIndex];

  return methodRecord === undefined
    ? createNotFoundResponse("Payment method")
    : HttpResponse.json(presentPaymentMethod(mockDatabase, methodRecord));
}

/** Payments > Methods (PY-12.1); registered before `/payments/:paymentId`. */
export const paymentMethodHandlers = [
  http.get("*/api/v1/payments/methods", async () => {
    await applyMockConditions();

    return HttpResponse.json(
      mockDatabase.paymentMethods.map((methodRecord) =>
        presentPaymentMethod(mockDatabase, methodRecord),
      ),
    );
  }),

  http.post("*/api/v1/payments/methods", async ({ request }) => {
    await applyMockConditions();
    const methodInput = (await request.json()) as PaymentMethodInput;
    const fieldErrors = validatePaymentMethod(
      methodInput,
      mockDatabase.paymentMethods,
      true,
    );
    const firstError = Object.values(fieldErrors)[0];
    if (firstError !== undefined) {
      return createErrorResponse(400, "validation_failed", firstError);
    }

    mockDatabase.paymentMethods.push({ ...methodInput, is_builtin: false });

    return HttpResponse.json(
      presentPaymentMethod(mockDatabase, { ...methodInput, is_builtin: false }),
      { status: 201 },
    );
  }),

  http.patch(
    "*/api/v1/payments/methods/:methodKey",
    async ({ params, request }) => {
      await applyMockConditions();
      const methodIndex = findMethodIndex(params.methodKey);
      const methodRecord = mockDatabase.paymentMethods[methodIndex];
      if (methodRecord === undefined) {
        return createNotFoundResponse("Payment method");
      }

      const methodInput = {
        ...((await request.json()) as PaymentMethodInput),
        key: methodRecord.key,
        flow: methodRecord.flow,
      };
      const firstError = Object.values(
        validatePaymentMethod(methodInput, mockDatabase.paymentMethods, false),
      )[0];
      if (firstError !== undefined) {
        return createErrorResponse(400, "validation_failed", firstError);
      }
      mockDatabase.paymentMethods[methodIndex] = applyMethodInput(
        methodRecord,
        methodInput,
      );

      return presentMethodAt(methodIndex);
    },
  ),

  http.post(
    "*/api/v1/payments/methods/:methodKey/reset",
    async ({ params }) => {
      await applyMockConditions();
      const methodIndex = findMethodIndex(params.methodKey);
      const shippedMethod = findShippedMethod(String(params.methodKey));
      if (methodIndex === -1) {
        return createNotFoundResponse("Payment method");
      }
      if (shippedMethod === undefined) {
        return createErrorResponse(
          409,
          "not_builtin",
          "Only built-in methods have a default to go back to",
        );
      }
      mockDatabase.paymentMethods[methodIndex] = shippedMethod;

      return presentMethodAt(methodIndex);
    },
  ),

  http.delete("*/api/v1/payments/methods/:methodKey", async ({ params }) => {
    await applyMockConditions();
    const methodIndex = findMethodIndex(params.methodKey);
    const methodRecord = mockDatabase.paymentMethods[methodIndex];
    if (methodRecord === undefined) {
      return createNotFoundResponse("Payment method");
    }
    const presentedMethod = presentPaymentMethod(mockDatabase, methodRecord);
    if (methodRecord.is_builtin) {
      return createErrorResponse(
        409,
        "builtin_method",
        "Built-in methods cannot be deleted; disable it instead",
      );
    }
    if (presentedMethod.payment_count > 0) {
      return createErrorResponse(
        409,
        "method_in_use",
        `${presentedMethod.payment_count} payments used ${methodRecord.name}; disable it instead`,
      );
    }
    mockDatabase.paymentMethods.splice(methodIndex, 1);

    return new HttpResponse(null, { status: 204 });
  }),
];
