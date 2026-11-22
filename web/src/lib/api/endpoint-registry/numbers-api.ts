import {
  type ApiEndpoint,
  listOf,
  pageOf,
  pageQueryParameters,
  projectQueryParameter,
  tagEndpoints,
  typeRef,
  partialOf,
} from "./endpoint-definition";

const verificationFilterParameters = [
  {
    name: "status",
    description: "pending, approved or failed.",
    schema: "string" as const,
    example: "pending",
  },
  {
    name: "to",
    description: "Number or email.",
    schema: "string" as const,
    example: "+8801700000000",
  },
  {
    name: "channel",
    description: "How the code was sent.",
    schema: typeRef("VerifyChannel"),
    example: "sms",
  },
  projectQueryParameter("verifications"),
];

const verifyEndpoints = tagEndpoints("Verify", [
  {
    method: "GET",
    path: "/api/v1/verify",
    summary: "Verifications your app started, newest first.",
    queryParameters: [...pageQueryParameters, ...verificationFilterParameters],
    response: pageOf("Verification"),
  },
  {
    method: "DELETE",
    path: "/api/v1/verify",
    summary: "Delete every verification, or those the filters match.",
    queryParameters: verificationFilterParameters,
    response: null,
    successStatus: 204,
  },
  {
    method: "GET",
    path: "/api/v1/verify/{verificationSid}",
    summary: "One verification with its code, attempts and timeline.",
    response: typeRef("VerificationDetail"),
    errorStatuses: [404],
  },
  {
    method: "DELETE",
    path: "/api/v1/verify/{verificationSid}",
    summary: "Delete one verification with its check attempts.",
    response: null,
    successStatus: 204,
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
    requestBody: partialOf("VerifyServiceInput"),
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
    requestBody: partialOf("VirtualNumberInput"),
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
    requestBody: typeRef("MessagingServiceCreateInput"),
    response: typeRef("MessagingService"),
    successStatus: 201,
    errorStatuses: [400, 409],
  },
  {
    method: "PATCH",
    path: "/api/v1/messaging-services/{serviceSid}",
    summary: "Change a Messaging Service.",
    requestBody: partialOf("MessagingServiceInput"),
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

/** Subaccounts of the Twilio provider's main account (SM-19, A23). */
const twilioAccountEndpoints = tagEndpoints("SMS", [
  {
    method: "GET",
    path: "/api/v1/twilio/subaccounts",
    summary:
      "Subaccounts of the Twilio provider's main account, tokens masked.",
    response: listOf("TwilioSubaccount"),
  },
  {
    method: "POST",
    path: "/api/v1/twilio/subaccounts",
    summary: "Add a Twilio subaccount with its own auth token.",
    requestBody: typeRef("TwilioSubaccountInput"),
    response: typeRef("TwilioSubaccount"),
    successStatus: 201,
    errorStatuses: [400, 409],
  },
  {
    method: "PATCH",
    path: "/api/v1/twilio/subaccounts/{accountSid}",
    summary:
      "Change a Twilio subaccount's name, status, token or Debugger URL.",
    requestBody: partialOf("TwilioSubaccountChanges"),
    response: typeRef("TwilioSubaccount"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/twilio/subaccounts/{accountSid}",
    summary: "Remove a Twilio subaccount; its messages stay.",
    response: null,
    successStatus: 204,
  },
  {
    method: "GET",
    path: "/api/v1/twilio/subaccounts/{accountSid}/auth-token",
    summary:
      "Reveal a subaccount's auth token (asked for after a confirmation).",
    response: typeRef("TwilioSubaccountTokenReveal"),
    errorStatuses: [404],
  },
]);

/** Addresses on Mailgun domains' complaints tables (EM-23, A23). */
const mailgunComplaintEndpoints = tagEndpoints("Email", [
  {
    method: "GET",
    path: "/api/v1/mailgun/complaints",
    summary: "Addresses on each Mailgun domain's complaints table.",
    queryParameters: [
      {
        name: "domain",
        description: "Only this sending domain's complaints.",
        schema: "string",
        example: "mg.shop.test",
      },
    ],
    response: listOf("MailgunComplaint"),
  },
  {
    method: "DELETE",
    path: "/api/v1/mailgun/complaints/{domain}",
    summary:
      "Clear a Mailgun domain's complaints, so its addresses get mail again.",
    response: null,
    successStatus: 204,
  },
]);

export const numbersApi: ApiEndpoint[] = [
  ...verifyEndpoints,
  ...numberEndpoints,
  ...twilioAccountEndpoints,
  ...mailgunComplaintEndpoints,
];
