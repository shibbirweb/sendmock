import {
  type ApiEndpoint,
  fileOf,
  listOf,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

const templateEndpoints = tagEndpoints("Webhook templates", [
  {
    method: "GET",
    path: "/api/v1/webhooks/templates",
    summary: "Built-in and custom payload templates.",
    response: listOf("WebhookTemplateSummary"),
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/templates",
    summary: "Add a custom template, starting as native JSON.",
    requestBody: typeRef("TemplateCreateRequest"),
    response: typeRef("WebhookTemplateSummary"),
    successStatus: 201,
    errorStatuses: [400],
  },
  {
    method: "GET",
    path: "/api/v1/webhooks/templates/{templateId}",
    summary: "One template with its method, headers and body template.",
    response: typeRef("WebhookTemplateDetail"),
    errorStatuses: [404],
  },
  {
    method: "PATCH",
    path: "/api/v1/webhooks/templates/{templateId}",
    summary:
      "Edit a template; each save keeps a revision, 422 when it does not render.",
    requestBody: typeRef("TemplateUpdate"),
    response: typeRef("WebhookTemplateDetail"),
    errorStatuses: [400, 404, 409, 422],
  },
  {
    method: "DELETE",
    path: "/api/v1/webhooks/templates/{templateId}",
    summary: "Delete a custom template; 409 while endpoints use it.",
    queryParameters: [
      {
        name: "endpoints",
        description:
          "detach: move endpoints that use it to native JSON instead of failing.",
        schema: "string",
      },
    ],
    response: null,
    successStatus: 204,
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/templates/import",
    summary: "Import a template file; 409 when the id is taken.",
    requestBody: typeRef("TemplateImportRequest"),
    response: typeRef("WebhookTemplateSummary"),
    successStatus: 201,
    errorStatuses: [409, 422],
  },
  {
    method: "GET",
    path: "/api/v1/webhooks/templates/{templateId}/export",
    summary: "The template as TOML (variable names, never values).",
    response: fileOf("application/toml"),
    errorStatuses: [404],
  },
  {
    method: "GET",
    path: "/api/v1/webhooks/templates/{templateId}/revisions",
    summary: "Saved revisions, newest first.",
    response: listOf("TemplateRevision"),
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/templates/{templateId}/revisions/{revision}/restore",
    summary: "Restore a revision as a new save.",
    response: typeRef("WebhookTemplateDetail"),
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/templates/{templateId}/render",
    summary:
      "Render against an email, an SMS or the sample, optionally a draft.",
    requestBody: typeRef("TemplateRenderRequest"),
    response: typeRef("TemplateRenderResult"),
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/templates/{templateId}/reset",
    summary: "Put an edited built-in template back as shipped.",
    response: typeRef("WebhookTemplateDetail"),
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/templates/{templateId}/clone",
    summary: "Copy a template into a new custom one.",
    requestBody: typeRef("TemplateCloneRequest"),
    response: typeRef("WebhookTemplateSummary"),
    successStatus: 201,
    errorStatuses: [400, 404],
  },
  {
    method: "GET",
    path: "/api/v1/webhooks/template-reference",
    summary: "Every value a template can read for the chosen events.",
    queryParameters: [
      {
        name: "events",
        description: "Comma-separated event types.",
        schema: "string",
      },
    ],
    response: typeRef("TemplateReference"),
  },
]);

const variableEndpoints = tagEndpoints("Webhook variables", [
  {
    method: "GET",
    path: "/api/v1/webhooks/variables",
    summary: "Global and endpoint variables; secret values are masked.",
    queryParameters: [
      {
        name: "endpoint_id",
        description: "Only this endpoint's variables.",
        schema: "string",
      },
    ],
    response: listOf("WebhookVariable"),
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/variables",
    summary: "Add a variable.",
    requestBody: typeRef("WebhookVariableInput"),
    response: typeRef("WebhookVariable"),
    successStatus: 201,
    errorStatuses: [400],
  },
  {
    method: "PATCH",
    path: "/api/v1/webhooks/variables/{variableId}",
    summary: "Change a variable.",
    requestBody: typeRef("WebhookVariableInput"),
    response: typeRef("WebhookVariable"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/webhooks/variables/{variableId}",
    summary: "Delete a variable.",
    response: null,
    successStatus: 204,
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/variables/{variableId}/regenerate",
    summary: "Make a new fixed value for a generated-once random variable.",
    response: typeRef("WebhookVariable"),
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/variables/preview",
    summary: "What a variable definition resolves to against the sample.",
    requestBody: typeRef("VariablePreviewRequest"),
    response: typeRef("VariablePreviewResult"),
  },
]);

export const webhookTemplatesApi: ApiEndpoint[] = [
  ...templateEndpoints,
  ...variableEndpoints,
];
