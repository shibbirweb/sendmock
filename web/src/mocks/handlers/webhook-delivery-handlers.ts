import { http, HttpResponse } from "msw";

import type { DeliveryReplayRequest, WebhookDelivery } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
  paginateItems,
} from "@/mocks/handlers/handler-utils";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { buildDeliveryDetail } from "@/mocks/webhooks/delivery-detail";
import { buildReplayDelivery } from "@/mocks/webhooks/replay-delivery";

const retryingStatuses: WebhookDelivery["status"][] = [
  "pending",
  "in_flight",
  "failed",
];

function findDelivery(deliveryId: unknown) {
  return mockDatabase.webhookDeliveries.find(
    (webhookDelivery) => webhookDelivery.id === deliveryId,
  );
}

function matchesDeliveryFilters(
  webhookDelivery: WebhookDelivery,
  requestUrl: URL,
) {
  const statusFilter = requestUrl.searchParams.get("status");
  const endpointFilter = requestUrl.searchParams.get("endpoint_id");
  const eventFilter = requestUrl.searchParams.get("event_type");

  return (
    (statusFilter === null ||
      statusFilter.split(",").includes(webhookDelivery.status)) &&
    (endpointFilter === null ||
      webhookDelivery.endpoint_id === endpointFilter) &&
    (eventFilter === null || webhookDelivery.event_type === eventFilter)
  );
}

/** A failed delivery still retries while it has a next attempt time. */
function isRetrying(webhookDelivery: WebhookDelivery): boolean {
  return (
    retryingStatuses.includes(webhookDelivery.status) &&
    (webhookDelivery.status !== "failed" ||
      webhookDelivery.next_attempt_at !== null)
  );
}

/** Delivery log, detail, replay and cancel (WH-03, WH-05). */
export const webhookDeliveryHandlers = [
  http.get("*/api/v1/webhooks/deliveries", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    const requestUrl = new URL(request.url);
    const matchingDeliveries = mockDatabase.webhookDeliveries.filter(
      (webhookDelivery) => matchesDeliveryFilters(webhookDelivery, requestUrl),
    );

    return (
      conditionResponse ??
      HttpResponse.json(paginateItems(matchingDeliveries, requestUrl))
    );
  }),

  http.get("*/api/v1/webhooks/deliveries/:deliveryId", async ({ params }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const webhookDelivery = findDelivery(params.deliveryId);

    return webhookDelivery
      ? HttpResponse.json(buildDeliveryDetail(mockDatabase, webhookDelivery))
      : createNotFoundResponse("Delivery");
  }),

  http.post(
    "*/api/v1/webhooks/deliveries/:deliveryId/replay",
    async ({ params, request }) => {
      await applyMockConditions();
      const originalDelivery = findDelivery(params.deliveryId);
      if (!originalDelivery) {
        return createNotFoundResponse("Delivery");
      }

      const replayRequest = (await request.json()) as DeliveryReplayRequest;
      const replayedDelivery = buildReplayDelivery(
        originalDelivery,
        replayRequest,
      );
      if (replayedDelivery === null) {
        return createErrorResponse(
          409,
          "nothing_to_replay",
          "This delivery was never sent: its template failed to render.",
        );
      }

      mockDatabase.webhookDeliveries.unshift(replayedDelivery);
      publishMockEvent("webhook.delivered", { id: replayedDelivery.id });

      return HttpResponse.json(replayedDelivery);
    },
  ),

  http.post(
    "*/api/v1/webhooks/deliveries/:deliveryId/cancel",
    async ({ params }) => {
      await applyMockConditions();
      const webhookDelivery = findDelivery(params.deliveryId);
      if (!webhookDelivery) {
        return createNotFoundResponse("Delivery");
      }
      if (!isRetrying(webhookDelivery)) {
        return createErrorResponse(
          409,
          "not_retrying",
          "Only a delivery that will retry can be cancelled.",
        );
      }

      webhookDelivery.status = "cancelled";
      webhookDelivery.next_attempt_at = null;
      publishMockEvent("webhook.delivered", { id: webhookDelivery.id });

      return HttpResponse.json(
        buildDeliveryDetail(mockDatabase, webhookDelivery),
      );
    },
  ),
];
