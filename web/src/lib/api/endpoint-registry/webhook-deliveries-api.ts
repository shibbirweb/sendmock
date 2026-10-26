import {
  type ApiEndpoint,
  listOf,
  pageOf,
  pageQueryParameters,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

const deliveryEndpoints = tagEndpoints("Webhook deliveries", [
  {
    method: "GET",
    path: "/api/v1/webhooks/deliveries",
    summary: "Every webhook request sent, newest first.",
    queryParameters: [
      ...pageQueryParameters,
      {
        name: "status",
        description: "succeeded, failed or pending.",
        schema: "string",
        example: "failed",
      },
      {
        name: "endpoint_id",
        description: "Only this endpoint.",
        schema: "string",
        example: "01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
      },
      {
        name: "event_type",
        description: "Only this event.",
        schema: typeRef("AppEventType"),
        example: "email.received",
      },
    ],
    response: pageOf("WebhookDelivery"),
  },
  {
    method: "GET",
    path: "/api/v1/webhooks/deliveries/{deliveryId}",
    summary: "One delivery: request, response and every attempt.",
    response: typeRef("WebhookDeliveryDetail"),
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/deliveries/{deliveryId}/cancel",
    summary: "Stop the remaining retries.",
    response: typeRef("WebhookDeliveryDetail"),
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/deliveries/{deliveryId}/replay",
    summary: "Send the delivery again, as it was or edited.",
    requestBody: typeRef("DeliveryReplayRequest"),
    response: typeRef("WebhookDelivery"),
    errorStatuses: [404, 409],
  },
  {
    method: "GET",
    path: "/api/v1/webhooks/metrics",
    summary: "Volume, success rate, latency and failures over a range.",
    queryParameters: [
      {
        name: "range",
        description: "24h or 7d.",
        schema: typeRef("WebhookMetricsRange"),
        isRequired: true,
        example: "24h",
      },
      {
        name: "endpoint_id",
        description: "Only this endpoint.",
        schema: "string",
        example: "01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
      },
    ],
    response: typeRef("WebhookMetrics"),
  },
]);

const savedDeliveryEndpoints = tagEndpoints("Saved deliveries", [
  {
    method: "GET",
    path: "/api/v1/webhooks/saved",
    summary: "Bookmarked requests, kept through pruning and reset.",
    response: listOf("SavedDelivery"),
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/saved",
    summary: "Save a delivery's request under a name.",
    requestBody: typeRef("SavedDeliveryInput"),
    response: typeRef("SavedDelivery"),
    successStatus: 201,
    errorStatuses: [400, 404, 409],
  },
  {
    method: "PATCH",
    path: "/api/v1/webhooks/saved/{savedId}",
    summary: "Rename a saved delivery.",
    requestBody: typeRef("SavedDeliveryRename"),
    response: typeRef("SavedDelivery"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/webhooks/saved/{savedId}",
    summary: "Delete a saved delivery.",
    response: null,
    successStatus: 204,
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/saved/{savedId}/send",
    summary: "Send a saved request to its endpoint or another one.",
    requestBody: typeRef("SavedDeliverySendRequest"),
    response: typeRef("WebhookDelivery"),
    errorStatuses: [400, 404],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/saved/{savedId}/template",
    summary: "Turn a saved request into a custom template.",
    requestBody: typeRef("SaveAsTemplateRequest"),
    response: typeRef("WebhookTemplateSummary"),
    successStatus: 201,
    errorStatuses: [400, 404],
  },
]);

export const webhookDeliveriesApi: ApiEndpoint[] = [
  ...deliveryEndpoints,
  ...savedDeliveryEndpoints,
];
