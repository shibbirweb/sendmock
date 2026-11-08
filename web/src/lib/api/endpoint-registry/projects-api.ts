import {
  type ApiEndpoint,
  listOf,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

/** Projects keep captured traffic apart inside one instance (docs/plan/32-after-1-0.md, A5). */
export const projectsApi: ApiEndpoint[] = tagEndpoints("Projects", [
  {
    method: "GET",
    path: "/api/v1/projects",
    summary: "Every project, default first, with the traffic each holds.",
    response: listOf("Project"),
  },
  {
    method: "POST",
    path: "/api/v1/projects",
    summary: "Add a project that apps can send traffic to by its key.",
    requestBody: typeRef("ProjectInput"),
    response: typeRef("Project"),
    successStatus: 201,
    errorStatuses: [400, 409],
  },
  {
    method: "PATCH",
    path: "/api/v1/projects/{projectKey}",
    summary: "Rename a project; its key stays the same.",
    requestBody: typeRef("ProjectUpdate"),
    response: typeRef("Project"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/projects/{projectKey}",
    summary: "Delete a project with its emails, SMS and verifications.",
    response: null,
    successStatus: 204,
    errorStatuses: [404, 409],
  },
]);
