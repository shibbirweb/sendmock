import {
  type ApiEndpoint,
  listOf,
  pageOf,
  pageQueryParameters,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

const verifyEndpoints = tagEndpoints("Verify", [
  {
    method: "GET",
    path: "/api/v1/verify",
    summary: "Verifications your app started, newest first.",
    queryParameters: [
      ...pageQueryParameters,
      {
        name: "status",
        description: "pending, approved or failed.",
        schema: "string",
      },
      { name: "to", description: "Number or email.", schema: "string" },
      {
        name: "channel",
        description: "How the code was sent.",
        schema: typeRef("VerifyChannel"),
      },
    ],
    response: pageOf("Verification"),
  },
  {
    method: "GET",
    path: "/api/v1/verify/{verificationSid}",
    summary: "One verification with its code, attempts and timeline.",
    response: typeRef("VerificationDetail"),
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/verify/{verificationSid}/force",
    summary: "Force an outcome: approved, expired, canceled or max attempts.",
    requestBody: typeRef("VerificationForceRequest"),
    response: typeRef("VerificationDetail"),
    errorStatuses: [404],
  },
  {
    method: "GET",
    path: "/api/v1/verify/services",
    summary: "Verify services (code length, fixed code, lifetime).",
    response: listOf("VerifyService"),
  },
  {
    method: "POST",
    path: "/api/v1/verify/services",
    summary: "Add a Verify service.",
    requestBody: typeRef("VerifyServiceInput"),
    response: typeRef("VerifyService"),
    successStatus: 201,
    errorStatuses: [400],
  },
  {
    method: "PATCH",
    path: "/api/v1/verify/services/{serviceSid}",
    summary: "Change a Verify service.",
    requestBody: typeRef("VerifyServiceInput"),
    response: typeRef("VerifyService"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/verify/services/{serviceSid}",
    summary: "Delete a Verify service.",
    response: null,
    successStatus: 204,
  },
]);

const numberEndpoints = tagEndpoints("Numbers", [
  {
    method: "GET",
    path: "/api/v1/numbers",
    summary: "Fake numbers your app sends from, with their webhooks.",
    response: listOf("VirtualNumber"),
  },
  {
    method: "POST",
    path: "/api/v1/numbers",
    summary: "Add a number.",
    requestBody: typeRef("VirtualNumberInput"),
    response: typeRef("VirtualNumber"),
    successStatus: 201,
    errorStatuses: [400],
  },
  {
    method: "PATCH",
    path: "/api/v1/numbers/{numberId}",
    summary: "Change a number.",
    requestBody: typeRef("VirtualNumberInput"),
    response: typeRef("VirtualNumber"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/numbers/{numberId}",
    summary: "Delete a number.",
    response: null,
    successStatus: 204,
  },
  {
    method: "GET",
    path: "/api/v1/messaging-services",
    summary: "Messaging Services that pool numbers.",
    response: listOf("MessagingService"),
  },
  {
    method: "POST",
    path: "/api/v1/messaging-services",
    summary: "Add a Messaging Service.",
    requestBody: typeRef("MessagingServiceInput"),
    response: typeRef("MessagingService"),
    successStatus: 201,
    errorStatuses: [400],
  },
  {
    method: "PATCH",
    path: "/api/v1/messaging-services/{serviceSid}",
    summary: "Change a Messaging Service.",
    requestBody: typeRef("MessagingServiceInput"),
    response: typeRef("MessagingService"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/messaging-services/{serviceSid}",
    summary: "Delete a Messaging Service.",
    response: null,
    successStatus: 204,
  },
]);

export const numbersApi: ApiEndpoint[] = [
  ...verifyEndpoints,
  ...numberEndpoints,
];
