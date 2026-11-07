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
        '{"requestError": {"serviceException": {"messageId": "BAD_REQUEST", "text": "{{ error.reason }}"}}}',
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
        '{"errors": [{"code": "10004", "title": "Missing required parameter", "detail": "{{ error.reason }}"}]}',
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
        '{"code": "syntax_constraint_violation", "text": "{{ error.reason }}"}',
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

/** The SMS providers added after 1.0 (docs/plan/32-after-1-0.md, A3). */
export function buildMoreSmsProviders(): MessageProviderRecord[] {
  return [buildInfobipProvider(), buildTelnyxProvider(), buildSinchProvider()];
}
