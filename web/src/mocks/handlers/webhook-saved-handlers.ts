import { http, HttpResponse } from "msw";

import type {
  SaveAsTemplateRequest,
  SavedDelivery,
  SavedDeliveryInput,
  SavedDeliveryRename,
  SavedDeliverySendRequest,
  WebhookTemplateSummary,
} from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { buildCustomTemplateId } from "@/mocks/webhooks/custom-template-id";
import {
  buildSavedSendDelivery,
  signatureHeaderPrefix,
} from "@/mocks/webhooks/send-saved-delivery";

function findSavedDelivery(savedId: unknown) {
  return mockDatabase.savedDeliveries.find(
    (savedDelivery) => savedDelivery.id === savedId,
  );
}

/** Saved deliveries: save, list, rename, delete, send again and save as template (WH-10). */
export const webhookSavedHandlers = [
  http.get("*/api/v1/webhooks/saved", async () => {
    const conditionResponse = await applyMockConditions();

    return conditionResponse ?? HttpResponse.json(mockDatabase.savedDeliveries);
  }),

  http.post("*/api/v1/webhooks/saved", async ({ request }) => {
    await applyMockConditions();
    const savedInput = (await request.json()) as SavedDeliveryInput;
    const webhookDelivery = mockDatabase.webhookDeliveries.find(
      (existingDelivery) => existingDelivery.id === savedInput.delivery_id,
    );
    if (!webhookDelivery) {
      return createNotFoundResponse("Delivery");
    }
    if (savedInput.name.trim() === "") {
      return createErrorResponse(400, "validation_failed", "Enter a name");
    }
    if (webhookDelivery.request === null) {
      return createErrorResponse(
        409,
        "nothing_to_save",
        "This delivery was never sent, so there is no request to save.",
      );
    }

    const endpointRecord = mockDatabase.webhookEndpoints.find(
      (existingEndpoint) => existingEndpoint.id === webhookDelivery.endpoint_id,
    );
    const savedDelivery: SavedDelivery = {
      id: createMockUlid(),
      name: savedInput.name.trim(),
      endpoint_id: webhookDelivery.endpoint_id,
      event_type: webhookDelivery.event_type,
      template_id: endpointRecord?.template_id ?? "native",
      request: webhookDelivery.request,
      saved_at: new Date().toISOString(),
    };
    mockDatabase.savedDeliveries.unshift(savedDelivery);

    return HttpResponse.json(savedDelivery, { status: 201 });
  }),

  http.patch(
    "*/api/v1/webhooks/saved/:savedId",
    async ({ params, request }) => {
      await applyMockConditions();
      const savedDelivery = findSavedDelivery(params.savedId);
      if (!savedDelivery) {
        return createNotFoundResponse("Saved delivery");
      }

      const { name } = (await request.json()) as SavedDeliveryRename;
      if (name.trim() === "") {
        return createErrorResponse(400, "validation_failed", "Enter a name");
      }

      savedDelivery.name = name.trim();

      return HttpResponse.json(savedDelivery);
    },
  ),

  http.delete("*/api/v1/webhooks/saved/:savedId", async ({ params }) => {
    await applyMockConditions();
    if (!findSavedDelivery(params.savedId)) {
      return createNotFoundResponse("Saved delivery");
    }

    mockDatabase.savedDeliveries = mockDatabase.savedDeliveries.filter(
      (savedDelivery) => savedDelivery.id !== params.savedId,
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.post(
    "*/api/v1/webhooks/saved/:savedId/send",
    async ({ params, request }) => {
      await applyMockConditions();
      const savedDelivery = findSavedDelivery(params.savedId);
      if (!savedDelivery) {
        return createNotFoundResponse("Saved delivery");
      }

      const sendRequest = (await request.json()) as SavedDeliverySendRequest;
      const endpointRecord = mockDatabase.webhookEndpoints.find(
        (existingEndpoint) => existingEndpoint.id === sendRequest.endpoint_id,
      );
      if (!endpointRecord) {
        return createErrorResponse(
          400,
          "validation_failed",
          "Pick an endpoint",
        );
      }

      const sentDelivery = buildSavedSendDelivery(
        savedDelivery,
        endpointRecord,
        sendRequest.rerender,
      );
      mockDatabase.webhookDeliveries.unshift(sentDelivery);
      publishMockEvent("webhook.delivered", { id: sentDelivery.id });

      return HttpResponse.json(sentDelivery);
    },
  ),

  http.post(
    "*/api/v1/webhooks/saved/:savedId/template",
    async ({ params, request }) => {
      await applyMockConditions();
      const savedDelivery = findSavedDelivery(params.savedId);
      if (!savedDelivery) {
        return createNotFoundResponse("Saved delivery");
      }

      const { name } = (await request.json()) as SaveAsTemplateRequest;
      if (name.trim() === "") {
        return createErrorResponse(400, "validation_failed", "Enter a name");
      }

      const customTemplate: WebhookTemplateSummary = {
        id: buildCustomTemplateId(mockDatabase, name.trim()),
        name: name.trim(),
        service: "Custom",
        category: "custom",
        source: "custom",
        events:
          savedDelivery.event_type === null ? [] : [savedDelivery.event_type],
        description: `Made from the saved delivery "${savedDelivery.name}".`,
        required_variables: [],
        revision: 1,
        is_modified: false,
      };
      mockDatabase.webhookTemplates.push(customTemplate);
      mockDatabase.customTemplateDefinitions.set(customTemplate.id, {
        method: savedDelivery.request.method,
        content_type:
          savedDelivery.request.headers["content-type"] ?? "application/json",
        header_templates: Object.fromEntries(
          Object.entries(savedDelivery.request.headers).filter(
            ([headerName]) =>
              headerName !== "content-type" &&
              !headerName.startsWith(signatureHeaderPrefix),
          ),
        ),
        body_template: savedDelivery.request.body,
        doc_url: null,
        verified_on: null,
      });

      return HttpResponse.json(customTemplate, { status: 201 });
    },
  ),
];
