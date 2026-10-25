import type { HttpMethod } from "@/lib/api/types";

/** The request a template renders: what the gallery detail and previews show. */
export type TemplateDefinition = {
  method: HttpMethod;
  content_type: string;
  header_templates: Record<string, string>;
  body_template: string;
  doc_url: string | null;
  verified_on: string | null;
};

const jsonType = "application/json";
const formType = "application/x-www-form-urlencoded";
const verifiedOn = "2026-09-30";

const nativeDefinition: TemplateDefinition = {
  method: "POST",
  content_type: jsonType,
  header_templates: {},
  body_template: `{
  "type": "{{ event.type }}",
  "timestamp": "{{ event.created_at }}",
  "data": {{ data | json }}
}`,
  doc_url: null,
  verified_on: null,
};

const twilioMessageFields = `MessageSid={{ data.provider_id }}&AccountSid={{ vars.twilio_account_sid | default("AC00000000000000000000000000000000") }}&From={{ data.from_number | urlencode }}&To={{ data.to_number | urlencode }}`;

/** Request shapes by template id; unknown ids fall back to native JSON. */
export const templateDefinitions: Record<string, TemplateDefinition> = {
  native: nativeDefinition,
  "twilio.inbound_sms": {
    method: "POST",
    content_type: formType,
    header_templates: {
      "X-Twilio-Signature":
        "{{ twilio_signature(endpoint.url, body_fields, vars.twilio_auth_token) }}",
    },
    body_template: `${twilioMessageFields}&Body={{ data.body | urlencode }}&NumMedia=0`,
    doc_url: "https://www.twilio.com/docs/messaging/guides/webhook-request",
    verified_on: verifiedOn,
  },
  "twilio.status_callback": {
    method: "POST",
    content_type: formType,
    header_templates: {
      "X-Twilio-Signature":
        "{{ twilio_signature(endpoint.url, body_fields, vars.twilio_auth_token) }}",
    },
    body_template: `${twilioMessageFields}&MessageStatus={{ data.status }}&ErrorCode={{ data.error_code | default("") }}`,
    doc_url:
      "https://www.twilio.com/docs/messaging/guides/track-outbound-message-status",
    verified_on: verifiedOn,
  },
  "vonage.inbound": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "msisdn": "{{ data.from_number }}",
  "to": "{{ data.to_number }}",
  "messageId": "{{ data.provider_id }}",
  "text": "{{ data.body }}",
  "type": "text"
}`,
    doc_url: "https://developer.vonage.com/en/messaging/sms/guides/inbound-sms",
    verified_on: verifiedOn,
  },
  "vonage.dlr": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "msisdn": "{{ data.to_number }}",
  "messageId": "{{ data.provider_id }}",
  "status": "{{ data.status }}",
  "err-code": "{{ data.error_code | default("0") }}"
}`,
    doc_url:
      "https://developer.vonage.com/en/messaging/sms/guides/delivery-receipts",
    verified_on: verifiedOn,
  },
  "plivo.inbound": {
    method: "POST",
    content_type: formType,
    header_templates: {},
    body_template:
      "From={{ data.from_number | urlencode }}&To={{ data.to_number | urlencode }}&Text={{ data.body | urlencode }}&MessageUUID={{ data.provider_id }}",
    doc_url: "https://www.plivo.com/docs/messaging/concepts/receive-sms",
    verified_on: verifiedOn,
  },
  "telnyx.message": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "data": {
    "event_type": "message.received",
    "payload": {
      "id": "{{ data.provider_id }}",
      "from": { "phone_number": "{{ data.from_number }}" },
      "to": [{ "phone_number": "{{ data.to_number }}" }],
      "text": "{{ data.body }}"
    }
  }
}`,
    doc_url:
      "https://developers.telnyx.com/docs/messaging/messages/receiving-webhooks",
    verified_on: verifiedOn,
  },
  "mailgun.routes": {
    method: "POST",
    content_type: formType,
    header_templates: {},
    body_template:
      "sender={{ data.from.address | urlencode }}&recipient={{ data.to[0].address | urlencode }}&subject={{ data.subject | urlencode }}&body-plain={{ data.text_body | urlencode }}&timestamp={{ now_unix() }}&token={{ random_string(50) }}&signature={{ mailgun_signature(vars.mailgun_signing_key) }}",
    doc_url:
      "https://documentation.mailgun.com/docs/mailgun/user-manual/receive-forward-store/",
    verified_on: verifiedOn,
  },
  "sendgrid.inbound_parse": {
    method: "POST",
    content_type: formType,
    header_templates: {},
    body_template:
      "from={{ data.from.address | urlencode }}&to={{ data.to[0].address | urlencode }}&subject={{ data.subject | urlencode }}&text={{ data.text_body | urlencode }}",
    doc_url:
      "https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook",
    verified_on: verifiedOn,
  },
  "sendgrid.events": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `[
  {
    "email": "{{ data.to[0].address }}",
    "event": "{{ event.type | sendgrid_event }}",
    "sg_message_id": "{{ data.message_id }}",
    "timestamp": {{ now_unix() }}
  }
]`,
    doc_url:
      "https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event",
    verified_on: verifiedOn,
  },
  "postmark.inbound": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "From": "{{ data.from.address }}",
  "FromName": "{{ data.from.name }}",
  "To": "{{ data.to[0].address }}",
  "Subject": "{{ data.subject }}",
  "TextBody": "{{ data.text_body }}",
  "MessageID": "{{ data.message_id }}"
}`,
    doc_url: "https://postmarkapp.com/developer/webhooks/inbound-webhook",
    verified_on: verifiedOn,
  },
  "ses.sns": {
    method: "POST",
    content_type: "text/plain; charset=UTF-8",
    header_templates: { "x-amz-sns-message-type": "Notification" },
    body_template: `{
  "Type": "Notification",
  "Message": "{\\"notificationType\\":\\"{{ event.type | ses_type }}\\",\\"mail\\":{\\"destination\\":[\\"{{ data.to[0].address }}\\"]}}"
}`,
    doc_url:
      "https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html",
    verified_on: verifiedOn,
  },
  "resend.events": {
    method: "POST",
    content_type: jsonType,
    header_templates: {
      "svix-id": "{{ event.id }}",
      "svix-signature": "{{ svix_signature(vars.resend_signing_secret) }}",
    },
    body_template: `{
  "type": "{{ event.type | resend_type }}",
  "created_at": "{{ event.created_at }}",
  "data": { "to": ["{{ data.to[0].address }}"], "subject": "{{ data.subject }}" }
}`,
    doc_url: "https://resend.com/docs/dashboard/webhooks/event-types",
    verified_on: verifiedOn,
  },
  "slack.incoming_webhook": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "text": "New {{ event.type }}: {{ data.subject | default(data.body) }}",
  "blocks": [
    { "type": "section", "text": { "type": "mrkdwn", "text": "*{{ data.subject | default("SMS") }}*\\nFrom {{ data.from.address | default(data.from_number) }}" } }
  ]
}`,
    doc_url: "https://api.slack.com/messaging/webhooks",
    verified_on: verifiedOn,
  },
  "discord.webhook": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "embeds": [
    { "title": "{{ data.subject | default("New message") }}", "description": "{{ data.text_body | default(data.body) }}" }
  ]
}`,
    doc_url: "https://discord.com/developers/docs/resources/webhook",
    verified_on: verifiedOn,
  },
  "teams.adaptive_card": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "type": "message",
  "attachments": [
    { "contentType": "application/vnd.microsoft.card.adaptive", "content": { "type": "AdaptiveCard", "body": [{ "type": "TextBlock", "text": "{{ data.subject }}" }] } }
  ]
}`,
    doc_url:
      "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
    verified_on: verifiedOn,
  },
  "telegram.send_message": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "chat_id": "{{ vars.telegram_chat_id }}",
  "text": "{{ data.subject | default(data.body) }}"
}`,
    doc_url: "https://core.telegram.org/bots/api#sendmessage",
    verified_on: verifiedOn,
  },
  "n8n.flat_json": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "event": "{{ event.type }}",
  "from": "{{ data.from.address | default(data.from_number) }}",
  "to": "{{ data.to[0].address | default(data.to_number) }}",
  "subject": "{{ data.subject | default("") }}",
  "text": "{{ data.text_body | default(data.body) }}"
}`,
    doc_url: null,
    verified_on: null,
  },
  "custom.tenant_inbound": {
    method: "POST",
    content_type: jsonType,
    header_templates: { "X-Tenant": "{{ vars.tenant_id }}" },
    body_template: `{
  "From": "{{ data.from.address }}",
  "To": "{{ data.to[0].address }}",
  "Subject": "{{ data.subject }}",
  "TextBody": "{{ data.text_body }}"
}`,
    doc_url: null,
    verified_on: null,
  },
  "custom.ops_alert": {
    method: "POST",
    content_type: "text/plain",
    header_templates: {},
    body_template:
      "Delivery to {{ data.endpoint_name }} failed: {{ data.error_message }}",
    doc_url: null,
    verified_on: null,
  },
};

/** The definition for a template, native JSON when it has none of its own. */
export function readTemplateDefinition(templateId: string): TemplateDefinition {
  return templateDefinitions[templateId] ?? nativeDefinition;
}
