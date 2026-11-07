import {
  answerError,
  buildProviderFixture,
  type MessageProviderRecord,
  requireParts,
  respondWithJson,
} from "@/mocks/fixtures/message-provider-builder";

/**
 * Infobip's SMS API v2, as its Node SDK calls it (`@infobip-api/sdk`, `/sms/2/text/advanced`;
 * https://www.infobip.com/docs/api/channels/sms/outbound-sms/send-sms-message, checked
 * 2026-11-07). One SMS per request: a request with several destinations stores the first,
 * as every SendMock provider does.
 */
function buildInfobipProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "infobip",
    name: "Infobip",
    area: "sms",
    accent: "#ff5a00",
    host: "api.infobip.com",
    credentials: [
      { name: "api_key", value: "test_infobip_key", is_secret: true },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/sms/2/text/advanced",
        request_format: "json",
      },
    ],
    field_mapping: [
      { part: "from", source: "messages[0].from" },
      { part: "to", source: "messages[0].destinations[*].to" },
      { part: "body", source: "messages[0].text" },
      { part: "status_callback_url", source: "messages[0].notifyUrl" },
    ],
    validation_rules: requireParts(["from", "to", "body"]),
    success_response: respondWithJson(
      200,
      '{"bulkId": "{{ request.body.bulkId | default(message.id) }}", "messages": [{"messageId": "{{ message.provider_id }}", "status": {"description": "Message sent to next instance", "groupId": 1, "groupName": "PENDING", "id": 26, "name": "PENDING_ACCEPTED"}, "to": "{{ message.to }}"}]}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        400,
        `{"requestError": {"serviceException": {"messageId": "BAD_REQUEST", "text": "{% if error.part == "body" %}Message text{% else %}{% if error.part == "to" %}Destination address{% else %}Sender{% endif %}{% endif %} is missing"}}}`,
      ),
      answerError(
        "unauthorized",
        401,
        '{"requestError": {"serviceException": {"messageId": "UNAUTHORIZED", "text": "Invalid login details"}}}',
      ),
    ],
    message_id_template: "{{ uuid() }}",
    callback_template_key: "infobip.dlr",
    // Infobip reports only final outcomes to the notifyUrl. The infobip.dlr template turns
    // SendMock's names into Infobip's (DELIVERED, UNDELIVERABLE, REJECTED), so they stay as is.
    status_names: {
      delivered: "delivered",
      failed: "failed",
      undelivered: "undelivered",
    },
  });
}

/**
 * Telnyx's Messages API v2, as its Node SDK calls it (`telnyx`, `POST /messages` under
 * `https://api.telnyx.com/v2`; https://developers.telnyx.com/api/messaging/send-message,
 * checked 2026-11-07). Status webhooks go to `webhook_url` as `telnyx.message` events.
 */
function buildTelnyxProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "telnyx",
    name: "Telnyx",
    area: "sms",
    accent: "#00c08b",
    host: "api.telnyx.com",
    credentials: [
      { name: "api_key", value: "KEY_test_telnyx", is_secret: true },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/v2/messages",
        request_format: "json",
      },
    ],
    field_mapping: [
      { part: "from", source: "from" },
      { part: "to", source: "to" },
      { part: "body", source: "text" },
      { part: "media_urls", source: "media_urls[*]" },
      { part: "status_callback_url", source: "webhook_url" },
    ],
    validation_rules: requireParts(["from", "to", "body"]),
    success_response: respondWithJson(
      200,
      '{"data": {"record_type": "message", "direction": "outbound", "id": "{{ message.provider_id }}", "type": "SMS", "from": {"phone_number": "{{ message.from }}", "carrier": "TELNYX LLC", "line_type": "VoIP"}, "to": [{"phone_number": "{{ message.to }}", "status": "queued", "carrier": "", "line_type": ""}], "text": "{{ message.body }}", "subject": null, "media": [], "webhook_url": "{{ request.body.webhook_url | default("") }}", "webhook_failover_url": "", "encoding": "GSM-7", "parts": 1, "tags": [], "cost": null, "received_at": "{{ now_iso() }}", "sent_at": null, "completed_at": null, "valid_until": null, "errors": []}}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        422,
        `{"errors": [{"code": "10004", "title": "Missing required parameter", "detail": "The '{% if error.part == "body" %}text{% else %}{{ error.part }}{% endif %}' parameter is required."}]}`,
      ),
      answerError(
        "unauthorized",
        401,
        '{"errors": [{"code": "10009", "title": "Authentication failed", "detail": "The API key looks malformed. Check that you copied it correctly."}]}',
      ),
    ],
    message_id_template: "{{ uuid() }}",
    callback_template_key: "telnyx.message",
    // Telnyx's own status names, which telnyx.message puts on the recipient.
    status_names: {
      sent: "sent",
      delivered: "delivered",
      failed: "sending_failed",
      undelivered: "delivery_failed",
    },
  });
}

/**
 * Sinch's SMS REST API, as its Node SDK calls it with a service plan ID and API token
 * (`@sinch/sdk-core`, `POST /xms/v1/{service_plan_id}/batches` with a Bearer token;
 * https://developers.sinch.com/docs/sms/api-reference/sms/tag/Batches/, checked 2026-11-07).
 * Delivery reports go to `callback_url` as `sinch.sms`, which turns SendMock's status names
 * into Sinch's itself.
 */
function buildSinchProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "sinch",
    name: "Sinch",
    area: "sms",
    accent: "#ffbe3c",
    host: "us.sms.api.sinch.com",
    credentials: [
      { name: "api_token", value: "test_sinch_token", is_secret: true },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/xms/v1/{service_plan_id}/batches",
        request_format: "json",
      },
    ],
    field_mapping: [
      { part: "from", source: "from" },
      { part: "to", source: "to[*]" },
      { part: "body", source: "body" },
      { part: "status_callback_url", source: "callback_url" },
    ],
    validation_rules: requireParts(["from", "to", "body"]),
    success_response: respondWithJson(
      201,
      '{"id": "{{ message.provider_id }}", "to": ["{{ message.to }}"], "from": "{{ message.from }}", "canceled": false, "body": "{{ message.body }}", "type": "mt_text", "created_at": "{{ now_iso() }}", "modified_at": "{{ now_iso() }}", "delivery_report": "{{ request.body.delivery_report | default("none") }}", "feedback_enabled": false, "flash_message": false}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        400,
        `{"code": "syntax_constraint_violation", "text": "Field '{{ error.part }}' is required"}`,
      ),
      answerError(
        "unauthorized",
        401,
        '{"code": "unauthorized", "text": "Invalid credentials"}',
      ),
    ],
    message_id_template: "01{{ random_hex(24) | upper }}",
    callback_template_key: "sinch.sms",
    status_names: {
      sent: "sent",
      delivered: "delivered",
      failed: "failed",
      undelivered: "undelivered",
    },
  });
}

/**
 * Africa's Talking's bulk SMS API, as its Node SDK calls it (`africastalking`, a form to
 * `POST /version1/messaging` with the `apikey` header, answered 201;
 * https://developers.africastalking.com/docs/sms/sending/bulk, checked 2026-11-07). Delivery
 * reports go to a callback set on the account, not per message, so the provider has no
 * callback; a webhook rule with the `africastalking.sms` template sends them instead.
 */
function buildAfricasTalkingProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "africastalking",
    name: "Africa's Talking",
    area: "sms",
    accent: "#f39200",
    host: "api.africastalking.com",
    credentials: [
      { name: "api_key", value: "test_at_key", is_secret: true },
      { name: "username", value: "sandbox", is_secret: false },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/version1/messaging",
        request_format: "form",
      },
    ],
    field_mapping: [
      { part: "from", source: "from" },
      { part: "to", source: "to" },
      { part: "body", source: "message" },
    ],
    validation_rules: requireParts(["from", "to", "body"]),
    success_response: respondWithJson(
      201,
      '{"SMSMessageData": {"Message": "Sent to 1/1 Total Cost: KES 0.8000", "Recipients": [{"statusCode": 101, "number": "{{ message.to }}", "status": "Success", "cost": "KES 0.8000", "messageId": "{{ message.provider_id }}"}]}}',
    ),
    error_responses: [
      {
        kind: "missing_field",
        status: 400,
        headers: [{ name: "Content-Type", template: "text/plain" }],
        body: `Request is missing required form field '{% if error.part == "body" %}message{% else %}{{ error.part }}{% endif %}'`,
      },
      {
        kind: "unauthorized",
        status: 401,
        headers: [{ name: "Content-Type", template: "text/plain" }],
        body: "The supplied authentication is invalid",
      },
    ],
    message_id_template: "ATXid_{{ random_hex(32) }}",
    callback_template_key: null,
    status_names: {
      sent: "Sent",
      delivered: "Success",
      failed: "Failed",
      undelivered: "Rejected",
    },
  });
}

const snsNamespace = "http://sns.amazonaws.com/doc/2010-03-31/";

/** An SNS error answer in the Query API's XML. */
function snsError(
  kind: "missing_field" | "unauthorized",
  status: number,
  errorType: string,
  errorCode: string,
  errorMessage: string,
) {
  return {
    kind,
    status,
    headers: [{ name: "Content-Type", template: "text/xml" }],
    body: `<ErrorResponse xmlns="${snsNamespace}"><Error><Type>${errorType}</Type><Code>${errorCode}</Code><Message>${errorMessage}</Message></Error><RequestId>{{ uuid() }}</RequestId></ErrorResponse>`,
  };
}

/**
 * Amazon SNS's `Publish` to a phone number, as the AWS SDK's SNS client calls it: the Query
 * protocol, a form posted to `/` with `Action=Publish`, answered in XML
 * (https://docs.aws.amazon.com/sns/latest/api/API_Publish.html, checked 2026-11-07). SNS has
 * no sender field, so the provider maps none and its messages are stored from its name. SNS
 * logs delivery status to CloudWatch rather than calling back, so there is no callback.
 */
function buildAmazonSnsProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "sns",
    name: "Amazon SNS",
    area: "sms",
    accent: "#e7157b",
    host: "sns.us-east-1.amazonaws.com",
    credentials: [
      { name: "access_key_id", value: "AKIATESTSENDMOCK", is_secret: false },
      { name: "secret_access_key", value: "test_sns_secret", is_secret: true },
    ],
    operations: [
      { kind: "send", method: "POST", path: "/", request_format: "form" },
    ],
    field_mapping: [
      { part: "to", source: "PhoneNumber" },
      { part: "body", source: "Message" },
    ],
    validation_rules: requireParts(["to", "body"]),
    success_response: {
      status: 200,
      headers: [{ name: "Content-Type", template: "text/xml" }],
      body: `<PublishResponse xmlns="${snsNamespace}"><PublishResult><MessageId>{{ message.provider_id }}</MessageId></PublishResult><ResponseMetadata><RequestId>{{ uuid() }}</RequestId></ResponseMetadata></PublishResponse>`,
    },
    error_responses: [
      snsError(
        "missing_field",
        400,
        "Sender",
        "InvalidParameter",
        '{% if error.part == "body" %}Invalid parameter: Empty message{% else %}Invalid parameter: TopicArn or TargetArn Reason: no value for required parameter{% endif %}',
      ),
      snsError(
        "unauthorized",
        403,
        "Sender",
        "InvalidClientTokenId",
        "The security token included in the request is invalid.",
      ),
    ],
    message_id_template: "{{ uuid() }}",
    callback_template_key: null,
    status_names: {},
  });
}

/**
 * Vonage Verify v2 (`POST /v2/verify`, `POST` and `DELETE /v2/verify/{request_id}`), as the
 * Vonage Node SDK's `Verify2` calls it; read from its source and test data, checked
 * 2026-11-07. Served in code over the verify domain, like Twilio Verify; this definition lists
 * it and its credentials (Basic auth with the API key and secret, which Verify v2 accepts beside
 * the SDK's JWT). Each brand gets a verify service of its own.
 */
function buildVonageVerifyProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "vonage_verify",
    name: "Vonage Verify",
    area: "sms",
    accent: "#871fff",
    host: "api.nexmo.com",
    credentials: [
      { name: "api_key", value: "vonage-key", is_secret: false },
      { name: "api_secret", value: "vonage-secret", is_secret: true },
    ],
    operations: [
      {
        kind: "start_verification",
        method: "POST",
        path: "/v2/verify",
        request_format: "json",
      },
      {
        kind: "check_verification",
        method: "POST",
        path: "/v2/verify/{request_id}",
        request_format: "json",
      },
    ],
    field_mapping: [
      { part: "to", source: "workflow[0].to" },
      { part: "body", source: "code" },
    ],
    validation_rules: requireParts(["to"]),
    success_response: respondWithJson(
      202,
      '{"request_id": "{{ message.provider_id }}"}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        422,
        '{"title": "Invalid params", "type": "https://developer.vonage.com/api-errors#invalid-params", "detail": "The value of one or more parameters is invalid", "instance": "{{ random_hex(32) }}"}',
      ),
      answerError(
        "not_found",
        404,
        '{"title": "Not Found", "type": "https://developer.vonage.com/api-errors#not-found", "detail": "Request was not found or it has been verified already.", "instance": "{{ random_hex(32) }}"}',
      ),
    ],
    message_id_template: "{{ uuid() }}",
    callback_template_key: null,
    status_names: {
      pending: "pending",
      approved: "completed",
      canceled: "cancelled",
    },
  });
}

/** The SMS providers added after 1.0 (docs/plan/32-after-1-0.md, A3). */
export function buildMoreSmsProviders(): MessageProviderRecord[] {
  return [
    buildInfobipProvider(),
    buildTelnyxProvider(),
    buildSinchProvider(),
    buildAfricasTalkingProvider(),
    buildAmazonSnsProvider(),
    buildVonageVerifyProvider(),
  ];
}
