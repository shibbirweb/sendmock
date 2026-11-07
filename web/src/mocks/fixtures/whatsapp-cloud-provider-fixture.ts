import {
  answerError,
  buildProviderFixture,
  type MessageProviderRecord,
  requireParts,
  respondWithJson,
} from "@/mocks/fixtures/message-provider-builder";

/**
 * Meta's WhatsApp Business Cloud API (`POST /{version}/{phone_number_id}/messages` on
 * `graph.facebook.com`), read from Meta's Node SDK and the Cloud API reference, checked
 * 2026-11-08 (docs/plan/32-after-1-0.md, A8). Served in code, like Twilio's API: this
 * definition lists it, its credentials and the business number its messages come from.
 */
export function buildWhatsappCloudProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "whatsapp_cloud",
    name: "WhatsApp Cloud",
    area: "sms",
    accent: "#25d366",
    host: "graph.facebook.com",
    credentials: [
      { name: "access_token", value: "whatsapp-access-token", is_secret: true },
      { name: "app_secret", value: "whatsapp-app-secret", is_secret: true },
      { name: "phone_number", value: "+15550783881", is_secret: false },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/v21.0/{phone_number_id}/messages",
        request_format: "json",
      },
    ],
    field_mapping: [
      { part: "to", source: "to" },
      { part: "body", source: "text.body" },
    ],
    validation_rules: requireParts(["to"]),
    success_response: respondWithJson(
      200,
      '{"messaging_product": "whatsapp", "contacts": [{"input": "{{ message.to }}", "wa_id": "{{ message.to }}"}], "messages": [{"id": "{{ message.provider_id }}"}]}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        400,
        '{"error": {"message": "(#100) The parameter {{ error.part }} is required.", "type": "OAuthException", "code": 100, "error_data": {"messaging_product": "whatsapp", "details": "The parameter {{ error.part }} is required."}, "fbtrace_id": "A{{ random_hex(16) }}"}}',
      ),
    ],
    message_id_template: "wamid.HBgL{{ random_hex(48) }}",
    callback_template_key: null,
    status_names: {
      sent: "sent",
      delivered: "delivered",
      read: "read",
      failed: "failed",
      undelivered: "failed",
    },
  });
}
