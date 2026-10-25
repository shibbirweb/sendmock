import {
  type ApiEndpoint,
  fileOf,
  pageOf,
  pageQueryParameters,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

const systemEndpoints = tagEndpoints("System", [
  {
    method: "GET",
    path: "/api/v1/health",
    summary: "Liveness check; answers while the server runs.",
    response: typeRef("HealthStatus"),
  },
  {
    method: "GET",
    path: "/api/v1/info",
    summary: "Version, listen addresses and enabled features.",
    response: typeRef("AppInfo"),
  },
  {
    method: "GET",
    path: "/api/v1/stats",
    summary: "Counts and rates shown on the Overview.",
    response: typeRef("AppStats"),
  },
  {
    method: "GET",
    path: "/api/v1/updates",
    summary: "Whether a newer release exists.",
    response: typeRef("UpdateCheckResult"),
    errorStatuses: [409],
  },
  {
    method: "GET",
    path: "/api/v1/settings",
    summary: "Every runtime setting.",
    response: typeRef("AppSettings"),
  },
  {
    method: "PATCH",
    path: "/api/v1/settings",
    summary: "Change settings; send only the changed keys.",
    requestBody: typeRef("AppSettingsUpdate"),
    response: typeRef("AppSettings"),
    errorStatuses: [400],
  },
  {
    method: "POST",
    path: "/api/v1/reset",
    summary: "Delete all traffic and restore the seed configuration.",
    response: null,
    successStatus: 204,
  },
  {
    method: "POST",
    path: "/api/v1/samples/{kind}",
    summary: "Create a sample email, SMS or verification for the demo.",
    response: typeRef("CreatedSample"),
    successStatus: 201,
    errorStatuses: [404],
  },
]);

const seedEndpoints = tagEndpoints("Seed", [
  {
    method: "GET",
    path: "/api/v1/seed/status",
    summary: "Whether a seed file is loaded and when it was applied.",
    response: typeRef("SeedStatus"),
  },
  {
    method: "GET",
    path: "/api/v1/seed/export",
    summary: "The current configuration as sendmock.seed.toml.",
    response: fileOf("application/toml"),
  },
  {
    method: "POST",
    path: "/api/v1/seed/validate",
    summary: "Check a seed file without applying it.",
    requestBody: typeRef("SeedFileRequest"),
    response: typeRef("SeedValidation"),
  },
  {
    method: "POST",
    path: "/api/v1/seed/apply",
    summary: "Apply a seed file; 422 with the errors when it is invalid.",
    requestBody: typeRef("SeedFileRequest"),
    response: typeRef("SeedValidation"),
    errorStatuses: [422],
  },
]);

const logEndpoints = tagEndpoints("Logs", [
  {
    method: "GET",
    path: "/api/v1/logs/smtp",
    summary: "SMTP sessions, newest first, including rejected ones.",
    queryParameters: [
      ...pageQueryParameters,
      {
        name: "result",
        description: "delivered or failed.",
        schema: "string",
      },
      {
        name: "query",
        description: "Client, EHLO name or user.",
        schema: "string",
      },
    ],
    response: pageOf("SmtpSession"),
  },
  {
    method: "GET",
    path: "/api/v1/logs/smtp/{sessionId}",
    summary: "One SMTP session with its transcript.",
    response: typeRef("SmtpSession"),
    errorStatuses: [404],
  },
  {
    method: "GET",
    path: "/api/v1/logs/http",
    summary: "Requests to the native and provider APIs, newest first.",
    queryParameters: [
      ...pageQueryParameters,
      { name: "api", description: "Which API, e.g. twilio.", schema: "string" },
      {
        name: "status_class",
        description: "2xx, 4xx or 5xx.",
        schema: typeRef("ApiStatusClass"),
      },
      { name: "path", description: "Part of the path.", schema: "string" },
    ],
    response: pageOf("ApiRequestLogEntry"),
  },
  {
    method: "GET",
    path: "/api/v1/logs/http/{requestId}",
    summary: "One API request with its request and response.",
    response: typeRef("ApiRequestLogEntry"),
    errorStatuses: [404],
  },
]);

export const systemApi: ApiEndpoint[] = [
  ...systemEndpoints,
  ...seedEndpoints,
  ...logEndpoints,
];
