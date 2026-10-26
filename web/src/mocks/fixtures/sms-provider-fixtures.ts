import {
  answerError,
  buildProviderFixture,
  checkPhoneNumbers,
  type MessageProviderRecord,
  requireParts,
  respondWithJson,
} from "@/mocks/fixtures/message-provider-builder";

const twilioMessagesPath = "/2010-04-01/Accounts/{AccountSid}/Messages";

/** Twilio's own message resource, as create, fetch and cancel answer it. */
const twilioMessageBody =
  '{"sid": "{{ message.provider_id }}", "account_sid": "{{ request.path_params.AccountSid }}", "to": "{{ message.to }}", "from": "{{ message.from }}", "body": "{{ message.body }}", "status": "{{ message.status }}", "num_segments": "1", "direction": "outbound-api", "date_created": "{{ now_iso() }}", "error_code": null}';

function twilioError(code: number, message: string, status: number) {
  return `{"code": ${code}, "message": "${message}", "more_info": "https://www.twilio.com/docs/errors/${code}", "status": ${status}}`;
}

function buildTwilioProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "twilio",
    name: "Twilio",
    area: "sms",
    accent: "#f22f46",
    host: "api.twilio.com",
    credentials: [
      {
        name: "account_sid",
        value: "ACtest00000000000000000000000000",
        is_secret: false,
      },
      { name: "auth_token", value: "twilio-test-token", is_secret: true },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: `${twilioMessagesPath}.json`,
        request_format: "form",
      },
      {
        kind: "fetch",
        method: "GET",
        path: `${twilioMessagesPath}/{MessageSid}.json`,
        request_format: "query",
      },
      {
        kind: "list",
        method: "GET",
        path: `${twilioMessagesPath}.json`,
        request_format: "query",
      },
      {
        kind: "cancel",
        method: "POST",
        path: `${twilioMessagesPath}/{MessageSid}.json`,
        request_format: "form",
      },
    ],
    field_mapping: [
      { part: "from", source: "From" },
      { part: "to", source: "To" },
      { part: "body", source: "Body" },
      { part: "media_urls", source: "MediaUrl" },
      { part: "messaging_service", source: "MessagingServiceSid" },
      { part: "status_callback_url", source: "StatusCallback" },
    ],
    validation_rules: [...requireParts(["to"]), ...checkPhoneNumbers(["to"])],
    success_response: respondWithJson(201, twilioMessageBody),
    error_responses: [
      answerError(
        "missing_field",
        400,
        twilioError(21604, "A 'To' phone number is required.", 400),
      ),
      answerError(
        "invalid_value",
        400,
        twilioError(21211, "The 'To' number is not a valid phone number.", 400),
      ),
      answerError("unauthorized", 401, twilioError(20003, "Authenticate", 401)),
      answerError(
        "not_found",
        404,
        twilioError(20404, "The requested resource was not found", 404),
      ),
    ],
    message_id_template: "SM{{ random_hex(32) }}",
    callback_template_key: "twilio.status_callback",
    status_names: {
      queued: "queued",
      sent: "sent",
      delivered: "delivered",
      undelivered: "undelivered",
      failed: "failed",
      read: "read",
    },
    // The codes of Twilio's test numbers (src/lib/outcomes/magic-reference-data.ts), exactly.
    outcome_error_codes: {
      invalid_number: "21211",
      cannot_route: "21612",
      no_international_permission: "21408",
      blocked: "21610",
      cannot_receive_sms: "21614",
      invalid_from: "21212",
      not_sms_capable: "21606",
      queue_full: "21611",
      unreachable_handset: "30003",
      landline: "30006",
      carrier_filtered: "30007",
      unknown_error: "30008",
    },
  });
}

function buildTwilioVerifyProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "twilio_verify",
    name: "Twilio Verify",
    area: "sms",
    accent: "#f22f46",
    host: "verify.twilio.com",
    credentials: [
      {
        name: "account_sid",
        value: "ACtest00000000000000000000000000",
        is_secret: false,
      },
      { name: "auth_token", value: "twilio-test-token", is_secret: true },
    ],
    operations: [
      {
        kind: "start_verification",
        method: "POST",
        path: "/v2/Services/{ServiceSid}/Verifications",
        request_format: "form",
      },
      {
        kind: "check_verification",
        method: "POST",
        path: "/v2/Services/{ServiceSid}/VerificationCheck",
        request_format: "form",
      },
    ],
    field_mapping: [
      { part: "to", source: "To" },
      { part: "body", source: "Code" },
    ],
    validation_rules: [...requireParts(["to"]), ...checkPhoneNumbers(["to"])],
    success_response: respondWithJson(
      201,
      '{"sid": "{{ message.provider_id }}", "service_sid": "{{ request.path_params.ServiceSid }}", "to": "{{ message.to }}", "channel": "sms", "status": "pending", "valid": false}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        400,
        twilioError(60200, "Invalid parameter", 400),
      ),
      answerError(
        "not_found",
        404,
        twilioError(20404, "The requested resource was not found", 404),
      ),
      answerError(
        "rate_limited",
        429,
        twilioError(60203, "Max send attempts reached", 429),
      ),
    ],
    message_id_template: "VE{{ random_hex(32) }}",
    callback_template_key: null,
    status_names: {
      pending: "pending",
      approved: "approved",
      canceled: "canceled",
      expired: "expired",
    },
  });
}

function buildVonageProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "vonage",
    name: "Vonage",
    area: "sms",
    accent: "#871fff",
    host: "rest.nexmo.com",
    credentials: [
      { name: "api_key", value: "vonage-key", is_secret: false },
      { name: "api_secret", value: "vonage-secret", is_secret: true },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/sms/json",
        request_format: "form",
      },
    ],
    field_mapping: [
      { part: "from", source: "from" },
      { part: "to", source: "to" },
      { part: "body", source: "text" },
      { part: "status_callback_url", source: "callback" },
    ],
    validation_rules: requireParts(["from", "to"]),
    success_response: respondWithJson(
      200,
      '{"message-count": "1", "messages": [{"to": "{{ message.to }}", "message-id": "{{ message.provider_id }}", "status": "0", "remaining-balance": "10.00", "message-price": "0.0333", "network": "23410"}]}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        200,
        '{"message-count": "1", "messages": [{"status": "2", "error-text": "Missing {{ error.part }}"}]}',
      ),
      answerError(
        "unauthorized",
        200,
        '{"message-count": "1", "messages": [{"status": "4", "error-text": "Bad Credentials"}]}',
      ),
    ],
    message_id_template: "{{ random_hex(16) }}",
    callback_template_key: "vonage.dlr",
    status_names: {
      delivered: "delivered",
      failed: "failed",
      undelivered: "rejected",
      sent: "accepted",
    },
  });
}

function buildPlivoProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "plivo",
    name: "Plivo",
    area: "sms",
    accent: "#2fd477",
    host: "api.plivo.com",
    credentials: [
      { name: "auth_id", value: "MATEST000000000000", is_secret: false },
      { name: "auth_token", value: "plivo-test-token", is_secret: true },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/v1/Account/{auth_id}/Message/",
        request_format: "json",
      },
    ],
    field_mapping: [
      { part: "from", source: "src" },
      { part: "to", source: "dst" },
      { part: "body", source: "text" },
      { part: "status_callback_url", source: "url" },
    ],
    validation_rules: requireParts(["from", "to", "body"]),
    success_response: respondWithJson(
      202,
      '{"message": "message(s) queued", "message_uuid": ["{{ message.provider_id }}"], "api_id": "{{ uuid() }}"}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        400,
        '{"api_id": "{{ uuid() }}", "error": "{{ error.part }} parameter is missing"}',
      ),
      answerError(
        "unauthorized",
        401,
        '{"api_id": "{{ uuid() }}", "error": "Unauthorized"}',
      ),
    ],
    message_id_template: "{{ uuid() }}",
    callback_template_key: null,
    status_names: {
      queued: "queued",
      sent: "sent",
      delivered: "delivered",
      undelivered: "undelivered",
      failed: "failed",
    },
  });
}

function buildMessagebirdProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "messagebird",
    name: "MessageBird",
    area: "sms",
    accent: "#2481d7",
    host: "rest.messagebird.com",
    credentials: [
      { name: "access_key", value: "test_mb_key", is_secret: true },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/messages",
        request_format: "json",
      },
    ],
    field_mapping: [
      { part: "from", source: "originator" },
      { part: "to", source: "recipients" },
      { part: "body", source: "body" },
      { part: "status_callback_url", source: "reportUrl" },
    ],
    validation_rules: requireParts(["from", "to", "body"]),
    success_response: respondWithJson(
      201,
      '{"id": "{{ message.provider_id }}", "direction": "mt", "type": "sms", "originator": "{{ message.from }}", "body": "{{ message.body }}", "recipients": {"totalCount": 1, "totalSentCount": 1, "items": [{"recipient": "{{ message.to }}", "status": "sent"}]}}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        422,
        '{"errors": [{"code": 9, "description": "no ({{ error.part }}) given", "parameter": "{{ error.part }}"}]}',
      ),
      answerError(
        "unauthorized",
        401,
        '{"errors": [{"code": 2, "description": "Request not allowed (incorrect access_key)", "parameter": null}]}',
      ),
    ],
    message_id_template: "{{ random_hex(32) }}",
    callback_template_key: null,
    status_names: {
      sent: "sent",
      delivered: "delivered",
      failed: "delivery_failed",
      undelivered: "expired",
    },
  });
}

/** The SMS providers SendMock ships (docs/plan/22-configurable-providers.md, 04-sms.md). */
export function buildBuiltinSmsProviders(): MessageProviderRecord[] {
  return [
    buildTwilioProvider(),
    buildTwilioVerifyProvider(),
    buildVonageProvider(),
    buildPlivoProvider(),
    buildMessagebirdProvider(),
  ];
}

/**
 * The demo's custom provider: a regional vendor added from blank, shown as
 * an example of a provider SendMock does not ship (not a supported built-in).
 */
export function buildExampleCustomSmsProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "sslwireless",
    name: "SSL Wireless",
    area: "sms",
    accent: "#00a651",
    host: "smsplus.sslwireless.com",
    is_builtin: false,
    credentials: [
      { name: "api_token", value: "ssl-demo-token", is_secret: true },
      { name: "sid", value: "ACMEBRAND", is_secret: false },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/api/v3/send-sms",
        request_format: "json",
      },
    ],
    field_mapping: [
      { part: "from", source: "sid" },
      { part: "to", source: "msisdn" },
      { part: "body", source: "sms" },
    ],
    validation_rules: requireParts(["to", "body"]),
    success_response: respondWithJson(
      200,
      '{"status": "SUCCESS", "status_code": 200, "error_message": "", "smsinfo": [{"sms_status": "SUCCESS", "status_message": "Success", "msisdn": "{{ message.to }}", "reference_id": "{{ message.provider_id }}"}]}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        200,
        '{"status": "FAILED", "status_code": 4001, "error_message": "{{ error.part }} is required"}',
      ),
      answerError(
        "unauthorized",
        200,
        '{"status": "FAILED", "status_code": 4003, "error_message": "Unauthorized"}',
      ),
    ],
    message_id_template: "{{ random_hex(20) }}",
    callback_template_key: null,
    status_names: { delivered: "DELIVERED", failed: "FAILED" },
  });
}
