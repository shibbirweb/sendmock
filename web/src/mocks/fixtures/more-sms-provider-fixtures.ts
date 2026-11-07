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

/** The SMS providers added after 1.0 (docs/plan/32-after-1-0.md, A3). */
export function buildMoreSmsProviders(): MessageProviderRecord[] {
  return [buildInfobipProvider()];
}
