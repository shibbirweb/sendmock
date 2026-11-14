import { http, HttpResponse } from "msw";

import { mockDatabase } from "@/mocks/db/mock-database";
import { applyMockConditions } from "@/mocks/handlers/handler-utils";
import { presentPaymentMethod } from "@/mocks/payments/payment-method-record";

/** The test values of every enabled method (`GET /payments/test-cards`), before `/payments/:paymentId`. */
export const paymentTestValueHandlers = [
  http.get("*/api/v1/payments/test-cards", async () => {
    await applyMockConditions();

    return HttpResponse.json(
      mockDatabase.paymentMethods
        .filter((methodRecord) => methodRecord.is_enabled)
        .map((methodRecord) =>
          presentPaymentMethod(mockDatabase, methodRecord),
        ),
    );
  }),
];
