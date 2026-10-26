import {
  type ApiEndpoint,
  type AreaEndpoint,
  fileOf,
  listOf,
  pageOf,
  pageQueryParameters,
  partialOf,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

const smsEndpoints = tagEndpoints("SMS", [
  {
    method: "GET",
    path: "/api/v1/sms",
    summary: "SMS and WhatsApp messages, newest first, with filters.",
    queryParameters: [
      ...pageQueryParameters,
      { name: "query", description: "Number or text.", schema: "string" },
      { name: "from", description: "Sender number.", schema: "string" },
      { name: "to", description: "Recipient number.", schema: "string" },
      {
        name: "status",
        description: "Delivery status.",
        schema: typeRef("SmsStatus"),
      },
      {
        name: "direction",
        description: "Outbound from your app or inbound to it.",
        schema: typeRef("SmsDirection"),
      },
      {
        name: "thread_id",
        description: "Only this conversation.",
        schema: "string",
      },
    ],
    response: pageOf("SmsMessage"),
  },
  {
    method: "DELETE",
    path: "/api/v1/sms",
    summary: "Delete every message.",
    response: null,
    successStatus: 204,
  },
  {
    method: "POST",
    path: "/api/v1/sms",
    summary: "Native send, with optional media URLs or inline media.",
    requestBody: typeRef("NativeSmsRequest"),
    response: typeRef("SmsMessageDetail"),
    successStatus: 201,
    errorStatuses: [400],
  },
  {
    method: "GET",
    path: "/api/v1/sms/threads",
    summary: "Conversations, one per contact and your number.",
    response: listOf("SmsThread"),
  },
  {
    method: "GET",
    path: "/api/v1/sms/{smsId}",
    summary: "One message with its status history and callbacks.",
    response: typeRef("SmsMessageDetail"),
    errorStatuses: [404],
  },
  {
    method: "DELETE",
    path: "/api/v1/sms/{smsId}",
    summary: "Delete one message.",
    response: null,
    successStatus: 204,
  },
  {
    method: "GET",
    path: "/api/v1/sms/{smsId}/media/{mediaIndex}",
    summary: "Download one media item of an MMS or WhatsApp message.",
    response: fileOf("*/*"),
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/sms/{smsId}/open",
    summary: "Record a read and fire sms.opened.",
    requestBody: typeRef("OpenEventRequest"),
    response: null,
    successStatus: 204,
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/sms/{smsId}/reply-webhook/resend",
    summary: "Send an inbound message's reply webhook again.",
    response: typeRef("SmsMessageDetail"),
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/sms/{smsId}/status",
    summary: "Set a delivery status by hand and fire its callback.",
    requestBody: typeRef("SmsStatusUpdate"),
    response: typeRef("SmsMessageDetail"),
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/sms/inbound",
    summary: "Simulate a message from a contact to one of your numbers.",
    requestBody: typeRef("InboundSmsRequest"),
    response: typeRef("SmsMessageDetail"),
    successStatus: 201,
    errorStatuses: [400],
  },
]);

/** List, add, change, delete and reorder the outcome rules of one channel. */
function buildOutcomeRuleEndpoints(
  ruleKind: "email" | "sms",
  ruleTypeName: string,
  ruleInputTypeName: string,
): AreaEndpoint[] {
  const rulesPath = `/api/v1/outcome-rules/${ruleKind}`;
  const channelLabel = ruleKind === "email" ? "email" : "SMS";

  return [
    {
      method: "GET",
      path: rulesPath,
      summary: `${channelLabel} outcome rules, checked from top to bottom.`,
      response: listOf(ruleTypeName),
    },
    {
      method: "POST",
      path: rulesPath,
      summary: `Add an ${channelLabel} outcome rule.`,
      requestBody: typeRef(ruleInputTypeName),
      response: typeRef(ruleTypeName),
      successStatus: 201,
      errorStatuses: [400],
    },
    {
      method: "PATCH",
      path: `${rulesPath}/{ruleId}`,
      summary: `Change an ${channelLabel} outcome rule; send only the changed keys.`,
      requestBody: partialOf(ruleInputTypeName),
      response: typeRef(ruleTypeName),
      errorStatuses: [400, 404],
    },
    {
      method: "DELETE",
      path: `${rulesPath}/{ruleId}`,
      summary: `Delete an ${channelLabel} outcome rule.`,
      response: null,
      successStatus: 204,
    },
    {
      method: "POST",
      path: `${rulesPath}/{ruleId}/move`,
      summary: `Move an ${channelLabel} outcome rule up or down.`,
      requestBody: typeRef("OutcomeRuleMove"),
      response: listOf(ruleTypeName),
      errorStatuses: [404],
    },
  ];
}

const outcomeRuleEndpoints = tagEndpoints("Outcome rules", [
  ...buildOutcomeRuleEndpoints(
    "email",
    "EmailOutcomeRule",
    "EmailOutcomeRuleInput",
  ),
  ...buildOutcomeRuleEndpoints("sms", "SmsOutcomeRule", "SmsOutcomeRuleInput"),
  {
    method: "POST",
    path: "/api/v1/outcome-rules/email/test",
    summary:
      "Which custom rule, magic address or profile decides an address's outcome.",
    requestBody: typeRef("EmailOutcomeTestRequest"),
    response: typeRef("OutcomeTestResult"),
  },
  {
    method: "POST",
    path: "/api/v1/outcome-rules/sms/test",
    summary:
      "Which custom rule, magic number or profile decides a number's outcome.",
    requestBody: typeRef("SmsOutcomeTestRequest"),
    response: typeRef("OutcomeTestResult"),
  },
]);

export const smsApi: ApiEndpoint[] = [...smsEndpoints, ...outcomeRuleEndpoints];
