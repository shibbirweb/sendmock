import { http, HttpResponse } from "msw";

import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { presentPaymentFlow } from "@/mocks/payments/payment-flow-record";
import { presentPaymentGateway } from "@/mocks/payments/payment-gateway-record";
import { presentPaymentMethod } from "@/mocks/payments/payment-method-record";
import { presentWebhookEndpoint } from "@/mocks/webhooks/webhook-endpoint-record";

/** One item by its key or id, for the CLI `show` commands and MCP `get` tools (UI-11.5). */
export const definitionLookupHandlers = [
  http.get("*/api/v1/payments/flows/:flowKey", async ({ params }) => {
    const conditionResponse = await applyMockConditions();
    const flowRecord = mockDatabase.paymentFlows.find(
      (candidate) => candidate.key === params.flowKey,
    );
    if (conditionResponse) {
      return conditionResponse;
    }

    return flowRecord === undefined
      ? createNotFoundResponse("Payment flow")
      : HttpResponse.json(presentPaymentFlow(mockDatabase, flowRecord));
  }),

  http.get("*/api/v1/payments/gateways/:gatewayKey", async ({ params }) => {
    const conditionResponse = await applyMockConditions();
    const gatewayRecord = mockDatabase.paymentGateways.find(
      (candidate) => candidate.key === params.gatewayKey,
    );
    if (conditionResponse) {
      return conditionResponse;
    }

    return gatewayRecord === undefined
      ? createNotFoundResponse("Payment gateway")
      : HttpResponse.json(presentPaymentGateway(mockDatabase, gatewayRecord));
  }),

  http.get("*/api/v1/payments/methods/:methodKey", async ({ params }) => {
    const conditionResponse = await applyMockConditions();
    const methodRecord = mockDatabase.paymentMethods.find(
      (candidate) => candidate.key === params.methodKey,
    );
    if (conditionResponse) {
      return conditionResponse;
    }

    return methodRecord === undefined
      ? createNotFoundResponse("Payment method")
      : HttpResponse.json(presentPaymentMethod(mockDatabase, methodRecord));
  }),

  http.get("*/api/v1/webhooks/endpoints/:endpointId", async ({ params }) => {
    const conditionResponse = await applyMockConditions();
    const endpointRecord = mockDatabase.webhookEndpoints.find(
      (candidate) => candidate.id === params.endpointId,
    );
    if (conditionResponse) {
      return conditionResponse;
    }

    return endpointRecord === undefined
      ? createNotFoundResponse("Endpoint")
      : HttpResponse.json(
          presentWebhookEndpoint(
            endpointRecord,
            mockDatabase.webhookDeliveries,
            Date.now(),
          ),
        );
  }),

  http.get("*/api/v1/webhooks/rules/:ruleId", async ({ params }) => {
    const conditionResponse = await applyMockConditions();
    const webhookRule = mockDatabase.webhookRules.find(
      (candidate) => candidate.id === params.ruleId,
    );
    if (conditionResponse) {
      return conditionResponse;
    }

    return webhookRule === undefined
      ? createNotFoundResponse("Rule")
      : HttpResponse.json(webhookRule);
  }),
];
