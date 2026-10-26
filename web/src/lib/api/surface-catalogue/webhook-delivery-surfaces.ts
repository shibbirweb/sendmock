import { type SurfaceCatalogue } from "./surface-definition";

/** Deliveries, their health and saved deliveries. */
export const webhookDeliverySurfaces: SurfaceCatalogue = {
  "GET /api/v1/webhooks/deliveries": {
    cli: "sendmock webhook deliveries list",
    mcp: "sendmock_webhook_delivery_list",
    ui: "Webhooks > Deliveries",
  },
  "GET /api/v1/webhooks/deliveries/{deliveryId}": {
    cli: "sendmock webhook deliveries show <deliveryId>",
    mcp: "sendmock_webhook_delivery_get",
    ui: "Webhooks > Deliveries > open a delivery",
  },
  "POST /api/v1/webhooks/deliveries/{deliveryId}/cancel": {
    cli: "sendmock webhook deliveries cancel <deliveryId>",
    mcp: "sendmock_webhook_delivery_cancel",
    ui: "Webhooks > Deliveries > delivery > Cancel retries",
  },
  "POST /api/v1/webhooks/deliveries/{deliveryId}/replay": {
    cli: "sendmock webhook deliveries replay <deliveryId>",
    mcp: "sendmock_webhook_delivery_replay",
    ui: "Webhooks > Deliveries > delivery > Replay, Edit and replay",
  },
  "GET /api/v1/webhooks/metrics": {
    cli: "sendmock webhook metrics",
    mcp: "sendmock_webhook_metrics",
    ui: "Webhooks > Overview",
  },
  "GET /api/v1/webhooks/saved": {
    cli: "sendmock webhook saved list",
    mcp: "sendmock_webhook_saved_list",
    ui: "Webhooks > Saved",
  },
  "POST /api/v1/webhooks/saved": {
    cli: "sendmock webhook saved create --delivery <deliveryId>",
    mcp: "sendmock_webhook_saved_create",
    ui: "Webhooks > Deliveries > delivery > Save",
  },
  "PATCH /api/v1/webhooks/saved/{savedId}": {
    cli: "sendmock webhook saved rename <savedId>",
    mcp: "sendmock_webhook_saved_update",
    ui: "Webhooks > Saved > Rename",
  },
  "DELETE /api/v1/webhooks/saved/{savedId}": {
    cli: "sendmock webhook saved delete <savedId>",
    mcp: "sendmock_webhook_saved_delete",
    ui: "Webhooks > Saved > Delete",
  },
  "POST /api/v1/webhooks/saved/{savedId}/send": {
    cli: "sendmock webhook saved send <savedId>",
    mcp: "sendmock_webhook_saved_send",
    ui: "Webhooks > Saved > Send",
  },
  "POST /api/v1/webhooks/saved/{savedId}/template": {
    cli: "sendmock webhook saved save-as-template <savedId>",
    mcp: "sendmock_webhook_saved_save_as_template",
    ui: "Webhooks > Saved > Save as template",
  },
};
