import {
  type ApiEndpoint,
  fileOf,
  pageOf,
  pageQueryParameters,
  tagEndpoints,
  listOf,
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
    path: "/api/v1/tls/ca",
    summary: "The local CA to trust for the HTTPS provider port.",
    response: typeRef("TlsCertificateAuthority"),
    errorStatuses: [404],
  },
  {
    method: "GET",
    path: "/api/v1/tls/trust",
    summary:
      "What trusts the local CA on this machine: the system store and each runtime.",
    response: typeRef("TlsTrustReport"),
    errorStatuses: [404],
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
    summary:
      "Whether a newer release exists for this channel, with its notes and upgrade command.",
    response: typeRef("UpdateCheckResult"),
    errorStatuses: [409, 502],
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
    summary:
      "Delete all traffic and apply the seed applied last again, keeping the rest of the configuration; with config, also remove every configured item and restore the built-in providers. Answers what it cleared, removed and kept.",
    requestBody: typeRef("ResetRequest"),
    response: typeRef("ResetSummary"),
    errorStatuses: [422],
  },
  {
    method: "DELETE",
    path: "/api/v1/traffic",
    summary:
      "Delete every captured item in every project and keep every setting and configuration list.",
    response: null,
    successStatus: 204,
  },
  {
    method: "POST",
    path: "/api/v1/samples/{kind}",
    summary:
      "Create a sample email, SMS, verification or HTTP request through the normal path.",
    requestBody: typeRef("SampleOptions"),
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

/** The versioned setup file (docs/plan/32-after-1-0.md, A18); the seed endpoints stay as its aliases. */
const setupEndpoints = tagEndpoints("Setup", [
  {
    method: "POST",
    path: "/api/v1/setup/export",
    summary:
      "The configuration as a versioned setup file in TOML, JSON or YAML.",
    requestBody: typeRef("SetupExportRequest"),
    response: fileOf("text/plain"),
    errorStatuses: [400],
  },
  {
    method: "POST",
    path: "/api/v1/setup/validate",
    summary:
      "Check a setup without applying it, with what an import would add, change and remove.",
    requestBody: typeRef("SetupImportRequest"),
    response: typeRef("SetupValidation"),
    errorStatuses: [400, 422],
  },
  {
    method: "GET",
    path: "/api/v1/presets",
    summary: "The stack presets: what each sets up and its options.",
    response: listOf("StackPreset"),
  },
  {
    method: "POST",
    path: "/api/v1/presets/{presetName}/apply",
    summary:
      "Set SendMock up for a stack in one step; a second run changes nothing.",
    requestBody: typeRef("PresetApplyInput"),
    response: typeRef("PresetApplyResult"),
    errorStatuses: [400, 404],
  },
  {
    method: "POST",
    path: "/api/v1/setup/import",
    summary:
      "Apply a setup from its text or a URL, merging or replacing; 422 with the errors and nothing applied when it is invalid.",
    requestBody: typeRef("SetupImportRequest"),
    response: typeRef("SetupValidation"),
    errorStatuses: [400, 422],
  },
  {
    method: "POST",
    path: "/api/v1/setup/migrate",
    summary:
      "A setup file upgraded to this build's format version, without applying it.",
    requestBody: typeRef("SetupMigrateRequest"),
    response: fileOf("text/plain"),
    errorStatuses: [400, 422],
  },
]);

const smtpSessionFilterParameters = [
  {
    name: "result",
    description: "delivered or failed.",
    schema: "string" as const,
    example: "delivered",
  },
  {
    name: "query",
    description: "Client, EHLO name or user.",
    schema: "string" as const,
    example: "laravel.test",
  },
];

const apiRequestFilterParameters = [
  {
    name: "api",
    description: "Which API, e.g. twilio.",
    schema: "string" as const,
    example: "twilio",
  },
  {
    name: "status_class",
    description: "2xx, 4xx or 5xx.",
    schema: typeRef("ApiStatusClass"),
    example: "4xx",
  },
  {
    name: "path",
    description: "Part of the path.",
    schema: "string" as const,
    example: "/Messages.json",
  },
];

const logEndpoints = tagEndpoints("Logs", [
  {
    method: "GET",
    path: "/api/v1/logs/smtp",
    summary: "SMTP sessions, newest first, including rejected ones.",
    queryParameters: [...pageQueryParameters, ...smtpSessionFilterParameters],
    response: pageOf("SmtpSession"),
  },
  {
    method: "DELETE",
    path: "/api/v1/logs/smtp",
    summary: "Delete every SMTP session, or those the filters match.",
    queryParameters: smtpSessionFilterParameters,
    response: null,
    successStatus: 204,
  },
  {
    method: "GET",
    path: "/api/v1/logs/smtp/{sessionId}",
    summary: "One SMTP session with its transcript.",
    response: typeRef("SmtpSession"),
    errorStatuses: [404],
  },
  {
    method: "DELETE",
    path: "/api/v1/logs/smtp/{sessionId}",
    summary: "Delete one SMTP session.",
    response: null,
    successStatus: 204,
  },
  {
    method: "GET",
    path: "/api/v1/logs/http",
    summary: "Requests to the native and provider APIs, newest first.",
    queryParameters: [...pageQueryParameters, ...apiRequestFilterParameters],
    response: pageOf("ApiRequestLogEntry"),
  },
  {
    method: "DELETE",
    path: "/api/v1/logs/http",
    summary: "Delete every API request log entry, or those the filters match.",
    queryParameters: apiRequestFilterParameters,
    response: null,
    successStatus: 204,
  },
  {
    method: "GET",
    path: "/api/v1/logs/http/{requestId}",
    summary: "One API request with its request and response.",
    response: typeRef("ApiRequestLogEntry"),
    errorStatuses: [404],
  },
  {
    method: "DELETE",
    path: "/api/v1/logs/http/{requestId}",
    summary: "Delete one API request log entry.",
    response: null,
    successStatus: 204,
  },
]);

export const systemApi: ApiEndpoint[] = [
  ...systemEndpoints,
  ...seedEndpoints,
  ...setupEndpoints,
  ...logEndpoints,
];
