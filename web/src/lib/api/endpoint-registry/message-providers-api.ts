import {
  type ApiEndpoint,
  type AreaEndpoint,
  listOf,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

/** The nine operations of one area's providers (docs/plan/22-configurable-providers.md). */
function buildProviderEndpoints(
  basePath: string,
  areaName: string,
): AreaEndpoint[] {
  return [
    {
      method: "GET",
      path: basePath,
      summary: `${areaName} providers, built in and custom, removed ones included.`,
      response: listOf("MessageProviderDefinition"),
    },
    {
      method: "POST",
      path: basePath,
      summary: `Add ${areaName === "Email" ? "an email" : "an SMS"} provider, blank or copied from another.`,
      requestBody: typeRef("MessageProviderCreateRequest"),
      response: typeRef("MessageProviderDefinition"),
      successStatus: 201,
      errorStatuses: [400, 409],
    },
    {
      method: "GET",
      path: `${basePath}/{providerKey}`,
      summary: "One provider definition; secret credentials masked.",
      response: typeRef("MessageProviderDefinition"),
      errorStatuses: [404],
    },
    {
      method: "PATCH",
      path: `${basePath}/{providerKey}`,
      summary:
        "Change a provider; 400 with the problems for template errors, bad paths or a path clash.",
      requestBody: typeRef("MessageProviderInput"),
      response: typeRef("MessageProviderDefinition"),
      errorStatuses: [400, 404],
    },
    {
      method: "DELETE",
      path: `${basePath}/{providerKey}`,
      summary:
        "Remove a built-in (restorable) or delete a custom provider; its messages stay.",
      response: null,
      successStatus: 204,
      errorStatuses: [404],
    },
    {
      method: "POST",
      path: `${basePath}/{providerKey}/restore`,
      summary: "Bring a removed built-in back as it was.",
      response: typeRef("MessageProviderDefinition"),
      errorStatuses: [404, 409],
    },
    {
      method: "POST",
      path: `${basePath}/{providerKey}/reset`,
      summary: "Put a built-in provider back as shipped.",
      response: typeRef("MessageProviderDefinition"),
      errorStatuses: [404, 409],
    },
    {
      method: "POST",
      path: `${basePath}/{providerKey}/preview`,
      summary:
        "Run a sample request through a definition: the message it would store and the answer it would give.",
      requestBody: typeRef("MessageProviderPreviewRequest"),
      response: typeRef("MessageProviderPreview"),
      errorStatuses: [404],
    },
    {
      method: "GET",
      path: `${basePath}/{providerKey}/credentials/{credentialName}`,
      summary: "Reveal one secret credential (asked for after a confirmation).",
      response: typeRef("ProviderCredentialReveal"),
      errorStatuses: [404],
    },
  ];
}

export const messageProvidersApi: ApiEndpoint[] = [
  ...tagEndpoints(
    "Email providers",
    buildProviderEndpoints("/api/v1/emails/providers", "Email"),
  ),
  ...tagEndpoints(
    "SMS providers",
    buildProviderEndpoints("/api/v1/sms/providers", "SMS"),
  ),
];
