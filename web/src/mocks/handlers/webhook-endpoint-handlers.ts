import { http, HttpResponse } from "msw";

import type {
  EndpointPreviewRequest,
  ManualSendRequest,
  RevealedEndpointSecret,
  RotateSecretRequest,
  WebhookEndpointInput,
} from "@/lib/api/types";
import { validateWebhookEndpointInput } from "@/lib/webhooks/validate-webhook-endpoint";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { recordNativeApiRequest } from "@/mocks/handlers/record-api-request";
import { routeDeliveryToCatcher } from "@/mocks/http/route-delivery-to-catcher";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { buildManualDelivery } from "@/mocks/webhooks/build-manual-delivery";
import { buildTestDelivery } from "@/mocks/webhooks/build-test-delivery";
import { renderEndpointRequest } from "@/mocks/webhooks/render-endpoint-request";
import {
  generateEndpointSecret,
  maskEndpointSecret,
  presentWebhookEndpoint,
  type WebhookEndpointRecord,
} from "@/mocks/webhooks/webhook-endpoint-record";

const hourInMs = 60 * 60 * 1000;
const allowedOverlapHours = [1, 24, 168];

function findEndpointRecord(endpointId: unknown) {
  return mockDatabase.webhookEndpoints.find(
    (endpointRecord) => endpointRecord.id === endpointId,
  );
}

function presentEndpoint(endpointRecord: WebhookEndpointRecord) {
  return presentWebhookEndpoint(
    endpointRecord,
    mockDatabase.webhookDeliveries,
    Date.now(),
  );
}

function readValidationError(endpointInput: WebhookEndpointInput) {
  return Object.values(validateWebhookEndpointInput(endpointInput)).find(
    (fieldError) => fieldError !== undefined,
  );
}

/** Webhook endpoints: CRUD, Send test, secret reveal and rotation (WH-01). */
export const webhookEndpointHandlers = [
  http.get("*/api/v1/webhooks/endpoints", async () => {
    const conditionResponse = await applyMockConditions();

    return (
      conditionResponse ??
      HttpResponse.json(mockDatabase.webhookEndpoints.map(presentEndpoint))
    );
  }),

  http.post("*/api/v1/webhooks/endpoints/preview", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const previewRequest = (await request.json()) as EndpointPreviewRequest;
    const previewResult = renderEndpointRequest(mockDatabase, previewRequest);

    return previewResult === null
      ? createNotFoundResponse("Message")
      : HttpResponse.json(previewResult);
  }),

  http.post("*/api/v1/webhooks/endpoints", async ({ request }) => {
    await applyMockConditions();
    const endpointInput = (await request.json()) as WebhookEndpointInput;
    const validationError = readValidationError(endpointInput);
    if (validationError !== undefined) {
      return createErrorResponse(400, "validation_failed", validationError);
    }

    const endpointRecord: WebhookEndpointRecord = {
      ...endpointInput,
      name: endpointInput.name.trim(),
      id: createMockUlid(),
      secret: generateEndpointSecret(),
      previous_secret: null,
      previous_secret_expires_at: null,
      created_by: "ui",
      created_at: new Date().toISOString(),
    };
    mockDatabase.webhookEndpoints.push(endpointRecord);

    return HttpResponse.json(presentEndpoint(endpointRecord), { status: 201 });
  }),

  http.patch(
    "*/api/v1/webhooks/endpoints/:endpointId",
    async ({ params, request }) => {
      await applyMockConditions();
      const endpointRecord = findEndpointRecord(params.endpointId);
      if (!endpointRecord) {
        return createNotFoundResponse("Endpoint");
      }

      const endpointUpdate =
        (await request.json()) as Partial<WebhookEndpointInput>;
      const updatedRecord = { ...endpointRecord, ...endpointUpdate };
      const validationError = readValidationError(updatedRecord);
      if (validationError !== undefined) {
        return createErrorResponse(400, "validation_failed", validationError);
      }

      Object.assign(endpointRecord, updatedRecord, {
        name: updatedRecord.name.trim(),
      });

      return HttpResponse.json(presentEndpoint(endpointRecord));
    },
  ),

  http.delete("*/api/v1/webhooks/endpoints/:endpointId", async ({ params }) => {
    await applyMockConditions();
    if (!findEndpointRecord(params.endpointId)) {
      return createNotFoundResponse("Endpoint");
    }

    mockDatabase.webhookEndpoints = mockDatabase.webhookEndpoints.filter(
      (endpointRecord) => endpointRecord.id !== params.endpointId,
    );
    mockDatabase.webhookRules = mockDatabase.webhookRules.filter(
      (webhookRule) => webhookRule.endpoint_id !== params.endpointId,
    );
    mockDatabase.webhookVariables = mockDatabase.webhookVariables.filter(
      (webhookVariable) => webhookVariable.endpoint_id !== params.endpointId,
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.post(
    "*/api/v1/webhooks/endpoints/:endpointId/test",
    async ({ params }) => {
      await applyMockConditions();
      const endpointRecord = findEndpointRecord(params.endpointId);
      if (!endpointRecord) {
        return createNotFoundResponse("Endpoint");
      }

      const testDelivery = routeDeliveryToCatcher(
        mockDatabase,
        buildTestDelivery(endpointRecord),
      );
      mockDatabase.webhookDeliveries.unshift(testDelivery);
      publishMockEvent("webhook.delivered", { id: testDelivery.id });

      return HttpResponse.json(testDelivery);
    },
  ),

  http.post(
    "*/api/v1/webhooks/endpoints/:endpointId/send",
    async ({ params, request }) => {
      await applyMockConditions();
      const endpointRecord = findEndpointRecord(params.endpointId);
      if (!endpointRecord) {
        return createNotFoundResponse("Endpoint");
      }

      const sendRequest = (await request.json()) as ManualSendRequest;
      const builtDelivery = buildManualDelivery(
        mockDatabase,
        endpointRecord,
        sendRequest,
      );
      if (builtDelivery === null) {
        return createNotFoundResponse("Message");
      }
      const manualDelivery = routeDeliveryToCatcher(
        mockDatabase,
        builtDelivery,
      );
      mockDatabase.webhookDeliveries.unshift(manualDelivery);
      publishMockEvent(
        manualDelivery.status === "render_failed"
          ? "webhook.failed"
          : "webhook.delivered",
        { id: manualDelivery.id },
      );

      return HttpResponse.json(manualDelivery, { status: 201 });
    },
  ),

  http.get(
    "*/api/v1/webhooks/endpoints/:endpointId/secret",
    async ({ params }) => {
      await applyMockConditions();
      const endpointRecord = findEndpointRecord(params.endpointId);
      if (!endpointRecord) {
        return createNotFoundResponse("Endpoint");
      }

      // The reveal is logged, with the secret masked like everywhere else.
      recordNativeApiRequest({
        method: "GET",
        path: `/api/v1/webhooks/endpoints/${endpointRecord.id}/secret`,
        responseStatus: 200,
        responseBody: { secret: maskEndpointSecret(endpointRecord.secret) },
      });
      const revealedSecret: RevealedEndpointSecret = {
        secret: endpointRecord.secret,
      };

      return HttpResponse.json(revealedSecret);
    },
  ),

  http.post(
    "*/api/v1/webhooks/endpoints/:endpointId/rotate-secret",
    async ({ params, request }) => {
      await applyMockConditions();
      const endpointRecord = findEndpointRecord(params.endpointId);
      if (!endpointRecord) {
        return createNotFoundResponse("Endpoint");
      }

      const { overlap_hours: overlapHours } =
        (await request.json()) as RotateSecretRequest;
      if (!allowedOverlapHours.includes(overlapHours)) {
        return createErrorResponse(
          400,
          "validation_failed",
          "Overlap must be 1, 24 or 168 hours",
        );
      }

      endpointRecord.previous_secret = endpointRecord.secret;
      endpointRecord.previous_secret_expires_at = new Date(
        Date.now() + overlapHours * hourInMs,
      ).toISOString();
      endpointRecord.secret = generateEndpointSecret();

      return HttpResponse.json(presentEndpoint(endpointRecord));
    },
  ),
];
