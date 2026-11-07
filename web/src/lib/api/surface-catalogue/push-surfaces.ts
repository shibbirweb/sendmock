import type { SurfaceCatalogue } from "./surface-definition";

/** Push notifications: the ones the provider APIs received. */
export const pushSurfaces: SurfaceCatalogue = {
  "GET /api/v1/push": {
    phase: "A7",
    cli: "sendmock push list",
    mcp: "sendmock_push_list",
    ui: "Push",
  },
  "DELETE /api/v1/push": {
    phase: "A7",
    cli: "sendmock push clear",
    mcp: "sendmock_push_delete_all",
    ui: "Push > Delete all",
  },
  "GET /api/v1/push/{pushId}": {
    phase: "A7",
    cli: "sendmock push show <pushId>",
    mcp: "sendmock_push_get",
    ui: "Push > open a notification",
  },
  "DELETE /api/v1/push/{pushId}": {
    phase: "A7",
    cli: "sendmock push delete <pushId>",
    mcp: "sendmock_push_delete",
    ui: "Push > open a notification > Delete",
  },
  "GET /api/v1/wait/push": {
    phase: "A7",
    cli: "sendmock push wait",
    mcp: "sendmock_push_wait",
    ui: "Push (new notifications appear live)",
  },
};
