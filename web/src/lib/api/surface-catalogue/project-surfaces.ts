import type { SurfaceCatalogue } from "./surface-definition";

/** Projects: managing the names that keep captured traffic apart. */
export const projectSurfaces: SurfaceCatalogue = {
  "GET /api/v1/projects": {
    phase: "A5",
    cli: "sendmock projects list",
    mcp: "sendmock_project_list",
    ui: "Settings > Projects",
  },
  "POST /api/v1/projects": {
    phase: "A5",
    cli: "sendmock projects create",
    mcp: "sendmock_project_create",
    ui: "Settings > Projects > New project",
  },
  "PATCH /api/v1/projects/{projectKey}": {
    phase: "A5",
    cli: "sendmock projects update <projectKey>",
    mcp: "sendmock_project_update",
    ui: "Settings > Projects > Rename",
  },
  "DELETE /api/v1/projects/{projectKey}": {
    phase: "A5",
    cli: "sendmock projects delete <projectKey>",
    mcp: "sendmock_project_delete",
    ui: "Settings > Projects > Delete",
  },
};
