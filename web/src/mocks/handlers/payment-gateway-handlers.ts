import { http, HttpResponse } from "msw";

import type {
  PaymentCheckoutCreateRequest,
  PaymentGatewayCreateRequest,
  PaymentGatewayInput,
  PaymentGatewayPreviewRequest,
} from "@/lib/api/types";
import {
  validateNewGateway,
  validatePaymentGateway,
} from "@/lib/payments/validate-payment-gateway";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { createTestCheckout } from "@/mocks/payments/create-test-checkout";
import {
  applyGatewayInput,
  buildCustomGateway,
  findShippedGateway,
  presentPaymentGateway,
} from "@/mocks/payments/payment-gateway-record";
import {
  findGatewayTemplateErrors,
  previewPaymentGateway,
} from "@/mocks/payments/preview-payment-gateway";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

function findGatewayIndex(gatewayKey: unknown): number {
  return mockDatabase.paymentGateways.findIndex(
    (gatewayRecord) => gatewayRecord.key === gatewayKey,
  );
}

function presentGatewayAt(gatewayIndex: number) {
  const gatewayRecord = mockDatabase.paymentGateways[gatewayIndex];

  return gatewayRecord === undefined
    ? createNotFoundResponse("Payment gateway")
    : HttpResponse.json(presentPaymentGateway(mockDatabase, gatewayRecord));
}

/** The first field or template problem that refuses a save, or undefined. */
function findSaveProblem(
  gatewayInput: PaymentGatewayInput,
): string | undefined {
  const fieldError = Object.values(validatePaymentGateway(gatewayInput))[0];
  if (fieldError !== undefined) {
    return fieldError;
  }
  const unknownMethodKey = gatewayInput.method_keys.find(
    (methodKey) =>
      !mockDatabase.paymentMethods.some(
        (methodRecord) => methodRecord.key === methodKey,
      ),
  );
  if (unknownMethodKey !== undefined) {
    return `There is no method with the key ${unknownMethodKey}`;
  }
  const templateError = findGatewayTemplateErrors(gatewayInput)[0];

  return templateError === undefined
    ? undefined
    : `${templateError.part}: ${templateError.message}`;
}

/** Payments > Gateways (PY-12.2, PY-12.4); registered before `/payments/:paymentId`. */
export const paymentGatewayHandlers = [
  http.get("*/api/v1/payments/gateways", async () => {
    await applyMockConditions();

    return HttpResponse.json(
      mockDatabase.paymentGateways.map((gatewayRecord) =>
        presentPaymentGateway(mockDatabase, gatewayRecord),
      ),
    );
  }),

  http.post("*/api/v1/payments/gateways", async ({ request }) => {
    await applyMockConditions();
    const createRequest = (await request.json()) as PaymentGatewayCreateRequest;
    const firstError = Object.values(
      validateNewGateway(
        createRequest.key,
        createRequest.name,
        mockDatabase.paymentGateways,
      ),
    )[0];
    if (firstError !== undefined) {
      return createErrorResponse(400, "validation_failed", firstError);
    }
    const gatewayRecord = buildCustomGateway(
      mockDatabase,
      createRequest.key,
      createRequest.name.trim(),
      createRequest.start_from,
    );
    mockDatabase.paymentGateways.push(gatewayRecord);

    return HttpResponse.json(
      presentPaymentGateway(mockDatabase, gatewayRecord),
      { status: 201 },
    );
  }),

  http.patch(
    "*/api/v1/payments/gateways/:gatewayKey",
    async ({ params, request }) => {
      await applyMockConditions();
      const gatewayIndex = findGatewayIndex(params.gatewayKey);
      const gatewayRecord = mockDatabase.paymentGateways[gatewayIndex];
      if (gatewayRecord === undefined) {
        return createNotFoundResponse("Payment gateway");
      }
      const gatewayInput = {
        ...((await request.json()) as PaymentGatewayInput),
        key: gatewayRecord.key,
      };
      const saveProblem = findSaveProblem(gatewayInput);
      if (saveProblem !== undefined) {
        return createErrorResponse(400, "validation_failed", saveProblem);
      }
      mockDatabase.paymentGateways[gatewayIndex] = applyGatewayInput(
        gatewayRecord,
        gatewayInput,
      );

      return presentGatewayAt(gatewayIndex);
    },
  ),

  http.post(
    "*/api/v1/payments/gateways/:gatewayKey/reset",
    async ({ params }) => {
      await applyMockConditions();
      const gatewayIndex = findGatewayIndex(params.gatewayKey);
      const shippedGateway = findShippedGateway(
        mockDatabase,
        String(params.gatewayKey),
      );
      if (gatewayIndex === -1) {
        return createNotFoundResponse("Payment gateway");
      }
      if (shippedGateway === undefined) {
        return createErrorResponse(
          409,
          "not_builtin",
          "Only built-in gateways have a default to go back to",
        );
      }
      mockDatabase.paymentGateways[gatewayIndex] = shippedGateway;

      return presentGatewayAt(gatewayIndex);
    },
  ),

  http.delete("*/api/v1/payments/gateways/:gatewayKey", async ({ params }) => {
    await applyMockConditions();
    const gatewayIndex = findGatewayIndex(params.gatewayKey);
    const gatewayRecord = mockDatabase.paymentGateways[gatewayIndex];
    if (gatewayRecord === undefined) {
      return createNotFoundResponse("Payment gateway");
    }
    const { payment_count: paymentCount } = presentPaymentGateway(
      mockDatabase,
      gatewayRecord,
    );
    if (gatewayRecord.is_builtin) {
      return createErrorResponse(
        409,
        "builtin_gateway",
        "Built-in gateways cannot be deleted; disable it instead",
      );
    }
    if (paymentCount > 0) {
      return createErrorResponse(
        409,
        "gateway_in_use",
        `${paymentCount} payments used ${gatewayRecord.name}; disable it instead`,
      );
    }
    mockDatabase.paymentGateways.splice(gatewayIndex, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  http.post(
    "*/api/v1/payments/gateways/:gatewayKey/preview",
    async ({ request }) => {
      await applyMockConditions();
      const previewRequest =
        (await request.json()) as PaymentGatewayPreviewRequest;

      return HttpResponse.json(
        previewPaymentGateway(mockDatabase, previewRequest.gateway, {
          payment_id: previewRequest.payment_id,
          event_type: previewRequest.event_type,
          redirect_outcome: previewRequest.redirect_outcome,
        }),
      );
    },
  ),

  http.get(
    "*/api/v1/payments/gateways/:gatewayKey/credentials/:credentialName",
    async ({ params }) => {
      await applyMockConditions();
      const credential = mockDatabase.paymentGateways[
        findGatewayIndex(params.gatewayKey)
      ]?.credentials.find(
        (candidate) => candidate.name === params.credentialName,
      );

      return credential === undefined
        ? createNotFoundResponse("Credential")
        : HttpResponse.json({ name: credential.name, value: credential.value });
    },
  ),

  http.post("*/api/v1/payments/checkout", async ({ request }) => {
    await applyMockConditions();
    const checkoutRequest =
      (await request.json()) as PaymentCheckoutCreateRequest;
    if (findGatewayIndex(checkoutRequest.provider) === -1) {
      return createErrorResponse(
        400,
        "validation_failed",
        `There is no gateway with the key ${checkoutRequest.provider}`,
      );
    }
    const paymentDetail = createTestCheckout(mockDatabase, checkoutRequest);
    publishMockEvent("payment.created", { id: paymentDetail.id });

    return HttpResponse.json(paymentDetail, { status: 201 });
  }),
];
