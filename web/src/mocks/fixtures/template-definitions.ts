import type { HttpMethod } from "@/lib/api/types";
import { inboundEmailTemplateDefinitions } from "@/mocks/fixtures/inbound-email-template-definitions";
import { paymentTemplateDefinitions } from "@/mocks/fixtures/payment-template-definitions";

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
/** The Twilio and Vonage SMS formats, checked again against the docs and Vonage's SDK types. */
const smsFormatsVerifiedOn = "2026-11-05";

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

const twilioAccountSid = `{{ vars.twilio_account_sid | default("AC00000000000000000000000000000000") }}`;
const twilioMessagingService = `{% if data.messaging_service_sid %}&MessagingServiceSid={{ data.messaging_service_sid }}{% endif %}`;
/** Twilio writes WhatsApp numbers as `whatsapp:+1...`, URL-encoded in a form body. */
const twilioWhatsAppPrefix = `{% if data.channel == "whatsapp" %}whatsapp%3A{% endif %}`;
/** WhatsApp messages add the sender's profile name, unknown here, and WhatsApp ID. */
const twilioWhatsAppProfile = `{% if data.channel == "whatsapp" %}ProfileName=WhatsApp%20user&WaId={{ data.from_number | replace("+", "") }}&{% endif %}`;
/** Each file's type and a link to SendMock's copy, numbered from 0. */
const twilioMediaFields = `{% for media_item in data.media %}&MediaContentType{{ loop.index0 }}={{ media_item.content_type | urlencode }}&MediaUrl{{ loop.index0 }}={{ sendmock.http_url | urlencode }}{{ media_item.url | urlencode }}{% endfor %}`;
const vonageApiKey = `{{ vars.vonage_api_key | default("vonage-key") }}`;
const vonageTimestamp = `{{ event.created_at | date("%Y-%m-%d %H:%M:%S") }}`;

/** Request shapes by template id; unknown ids fall back to native JSON. */
export const templateDefinitions: Record<string, TemplateDefinition> = {
  native: nativeDefinition,
  "twilio.inbound_sms": {
    method: "POST",
    content_type: formType,
    header_templates: {
      "X-Twilio-Signature":
        "{{ twilio_signature(endpoint.url, body_fields, vars.twilio_auth_token) }}",
      "I-Twilio-Idempotency-Token": "{{ uuid() }}",
      "User-Agent": "TwilioProxy/1.1",
    },
    body_template: `${twilioWhatsAppProfile}SmsMessageSid={{ data.provider_id }}&NumMedia={{ data.media | length }}${twilioMediaFields}&SmsSid={{ data.provider_id }}&SmsStatus=received&Body={{ data.body | urlencode }}&To=${twilioWhatsAppPrefix}{{ data.to_number | urlencode }}${twilioMessagingService}&NumSegments={{ data.segments | default("1") }}&MessageSid={{ data.provider_id }}&AccountSid=${twilioAccountSid}&From=${twilioWhatsAppPrefix}{{ data.from_number | urlencode }}&ApiVersion=2010-04-01`,
    doc_url: "https://www.twilio.com/docs/messaging/guides/webhook-request",
    verified_on: smsFormatsVerifiedOn,
  },
  "twilio.status_callback": {
    method: "POST",
    content_type: formType,
    header_templates: {
      "X-Twilio-Signature":
        "{{ twilio_signature(endpoint.url, body_fields, vars.twilio_auth_token) }}",
    },
    body_template: `SmsSid={{ data.provider_id }}&SmsStatus={% if event.type == "sms.opened" %}read{% else %}{{ data.status }}{% endif %}&MessageStatus={% if event.type == "sms.opened" %}read{% else %}{{ data.status }}{% endif %}&To={{ data.to_number | urlencode }}${twilioMessagingService}&MessageSid={{ data.provider_id }}&AccountSid=${twilioAccountSid}&From={{ data.from_number | urlencode }}&ApiVersion=2010-04-01{% if data.error_code %}&ErrorCode={{ data.error_code }}{% endif %}`,
    doc_url:
      "https://www.twilio.com/docs/messaging/guides/track-outbound-message-status",
    verified_on: smsFormatsVerifiedOn,
  },
  "vonage.inbound": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "msisdn": "{{ data.from_number | replace("+", "") }}",
  "to": "{{ data.to_number | replace("+", "") }}",
  "messageId": "{{ data.provider_id }}",
  "text": "{{ data.body }}",
  "type": "{% if data.encoding == "UCS-2" %}unicode{% else %}text{% endif %}",
  "keyword": "{{ data.body | regex_extract("^[^ ]+") | upper }}",
  "api-key": "${vonageApiKey}",
  "message-timestamp": "${vonageTimestamp}"
}`,
    doc_url: "https://developer.vonage.com/en/messaging/sms/guides/inbound-sms",
    verified_on: smsFormatsVerifiedOn,
  },
  "vonage.dlr": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "msisdn": "{{ data.to_number | replace("+", "") }}",
  "to": "{{ data.from_number | replace("+", "") }}",
  "network-code": "23410",
  "messageId": "{{ data.provider_id }}",
  "price": "0.03330000",
  "status": "{{ data.status }}",
  "scts": "{{ event.created_at | date("%y%m%d%H%M") }}",
  "err-code": "{{ data.error_code | default("0") }}",
  "api-key": "${vonageApiKey}",
  "message-timestamp": "${vonageTimestamp}"
}`,
    doc_url:
      "https://developer.vonage.com/en/messaging/sms/guides/delivery-receipts",
    verified_on: smsFormatsVerifiedOn,
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
  "africastalking.sms": {
    method: "POST",
    content_type: formType,
    header_templates: {},
    body_template:
      '{% if event.type == "sms.inbound" %}from={{ data.from_number | urlencode }}&to={{ data.to_number | urlencode }}&text={{ data.body | urlencode }}&date={{ event.created_at | urlencode }}&id={{ data.provider_id }}&linkId={{ event.id }}{% else %}id={{ data.provider_id }}&status={% if data.status == "delivered" %}Success{% else %}{% if data.status == "failed" %}Failed{% else %}{% if data.status == "undelivered" %}Rejected{% else %}Sent{% endif %}{% endif %}{% endif %}&phoneNumber={{ data.to_number | urlencode }}&networkCode=62120&retryCount=0{% endif %}',
    doc_url: "https://developers.africastalking.com/docs/sms/notifications",
    verified_on: verifiedOn,
  },
  "sinch.sms": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{% if event.type == "sms.inbound" %}{
  "type": "mo_text",
  "id": "{{ data.provider_id }}",
  "from": "{{ data.from_number }}",
  "to": "{{ data.to_number }}",
  "body": "{{ data.body }}",
  "received_at": "{{ event.created_at }}"
}{% else %}{
  "type": "recipient_delivery_report_sms",
  "batch_id": "{{ data.provider_id }}",
  "recipient": "{{ data.to_number }}",
  "code": 0,
  "status": "{% if data.status == "delivered" %}Delivered{% else %}{% if data.status == "failed" %}Failed{% else %}{% if data.status == "undelivered" %}Rejected{% else %}Dispatched{% endif %}{% endif %}{% endif %}",
  "at": "{{ event.created_at }}"
}{% endif %}`,
    doc_url:
      "https://developers.sinch.com/docs/sms/api-reference/sms/tag/Webhooks/",
    verified_on: verifiedOn,
  },
  "infobip.dlr": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "results": [
    {
      "messageId": "{{ data.provider_id }}",
      "to": "{{ data.to_number }}",
      "sentAt": "{{ event.created_at }}",
      "doneAt": "{{ event.created_at }}",
      "smsCount": 1,
      "status": { "groupId": 3, "groupName": "{% if data.status == "delivered" %}DELIVERED{% else %}{% if data.status == "failed" %}UNDELIVERABLE{% else %}{% if data.status == "undelivered" %}REJECTED{% else %}PENDING{% endif %}{% endif %}{% endif %}", "id": 5, "name": "{% if data.status == "delivered" %}DELIVERED{% else %}{% if data.status == "failed" %}UNDELIVERABLE{% else %}{% if data.status == "undelivered" %}REJECTED{% else %}PENDING{% endif %}{% endif %}{% endif %}", "description": "Message status from SendMock" },
      "error": { "groupId": 0, "groupName": "OK", "id": 0, "name": "NO_ERROR", "description": "No Error", "permanent": false }
    }
  ]
}`,
    doc_url:
      "https://www.infobip.com/docs/api/channels/sms/sms-messaging/logs-and-status-reports/receive-outbound-sms-message-report",
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
      "{% set mailgun_timestamp = event.created_at | unix %}{% set mailgun_token = random_hex(50) %}sender={{ data.from.address | urlencode }}&recipient={{ data.to[0].address | urlencode }}&subject={{ data.subject | urlencode }}&body-plain={{ data.text_body | urlencode }}&timestamp={{ mailgun_timestamp }}&token={{ mailgun_token }}&signature={{ mailgun_signature(vars.mailgun_signing_key, mailgun_timestamp, mailgun_token) }}",
    doc_url:
      "https://documentation.mailgun.com/docs/mailgun/user-manual/receive-forward-store/",
    verified_on: verifiedOn,
  },
  "mailgun.events": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{% set mailgun_timestamp = event.created_at | unix %}{% set mailgun_token = random_hex(50) %}{
  "signature": {
    "timestamp": "{{ mailgun_timestamp }}",
    "token": "{{ mailgun_token }}",
    "signature": "{{ mailgun_signature(vars.mailgun_signing_key, mailgun_timestamp, mailgun_token) }}"
  },
  "event-data": {
    "id": "{{ event.id }}",
    "timestamp": {{ mailgun_timestamp }},
    "event": "{{ event.type | mailgun_event }}",
    "recipient": "{{ data.to[0].address }}",
    "message": {
      "headers": {
        "message-id": "{{ data.message_id | default(data.id) }}",
        "from": "{{ data.from.address }}",
        "to": "{{ data.to[0].address }}",
        "subject": "{{ data.subject }}"
      }
    }
  }
}`,
    doc_url:
      "https://documentation.mailgun.com/docs/mailgun/user-manual/events/webhooks/",
    verified_on: verifiedOn,
  },
  "postmark.webhooks": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "RecordType": "{{ event.type | postmark_record_type }}",
  "MessageStream": "outbound",
  "MessageID": "{{ data.message_id | default(data.id) }}",
  "Recipient": "{{ data.to[0].address }}",
  "Email": "{{ data.to[0].address }}",
  "Tag": "",
  "DeliveredAt": "{{ event.created_at }}",
  "BouncedAt": "{{ event.created_at }}",
  "ReceivedAt": "{{ event.created_at }}",
  "Details": "",
  "Metadata": {},
  "ServerID": 23
}`,
    doc_url: "https://postmarkapp.com/developer/webhooks/webhooks-overview",
    verified_on: verifiedOn,
  },
  "brevo.events": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "event": "{{ event.type | brevo_event }}",
  "email": "{{ data.to[0].address }}",
  "id": 26224,
  "date": "{{ event.created_at }}",
  "ts": {{ event.created_at | unix }},
  "message-id": "{{ data.message_id | default(data.id) }}",
  "ts_event": {{ event.created_at | unix }},
  "subject": "{{ data.subject }}",
  "tag": ""
}`,
    doc_url: "https://developers.brevo.com/docs/transactional-webhooks",
    verified_on: verifiedOn,
  },
  "sparkpost.events": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `[
  {
    "msys": {
      "message_event": {
        "type": "{{ event.type | sendgrid_event }}",
        "event_id": "{{ event.id }}",
        "message_id": "{{ data.message_id | default(data.id) }}",
        "rcpt_to": "{{ data.to[0].address }}",
        "friendly_from": "{{ data.from.address }}",
        "subject": "{{ data.subject }}",
        "timestamp": "{{ event.created_at | unix }}"
      }
    }
  }
]`,
    doc_url: "https://developers.sparkpost.com/api/webhooks/",
    verified_on: verifiedOn,
  },
  "sendgrid.events": {
    method: "POST",
    content_type: jsonType,
    header_templates: {
      "X-Twilio-Email-Event-Webhook-Timestamp": "{{ event.created_at | unix }}",
      "X-Twilio-Email-Event-Webhook-Signature":
        "{{ sendgrid_signature(event.created_at | unix) }}",
    },
    body_template: `[
  {
    "email": "{{ data.to[0].address }}",
    "timestamp": {{ event.created_at | unix }},
    "smtp-id": "<{{ data.message_id | default(data.id) }}>",
    "event": "{{ event.type | sendgrid_event }}",
    "category": [],
    "sg_event_id": "{{ event.id }}",
    "sg_message_id": "{{ data.message_id | default(data.id) }}.filter0001.1-1"
  }
]`,
    doc_url:
      "https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event",
    verified_on: verifiedOn,
  },
  "ses.sns": {
    method: "POST",
    content_type: "text/plain; charset=UTF-8",
    header_templates: {
      "x-amz-sns-message-type": "Notification",
      "x-amz-sns-message-id": "{{ event.id }}",
      "x-amz-sns-topic-arn": "arn:aws:sns:us-east-1:123456789012:sendmock-ses",
    },
    body_template: `{
  "Type": "Notification",
  "MessageId": "{{ event.id }}",
  "TopicArn": "arn:aws:sns:us-east-1:123456789012:sendmock-ses",
  "Message": "{\\"notificationType\\":\\"{{ event.type | ses_type }}\\",\\"mail\\":{\\"timestamp\\":\\"{{ event.created_at }}\\",\\"messageId\\":\\"{{ data.message_id | default(data.id) }}\\",\\"source\\":\\"{{ data.from.address }}\\",\\"destination\\":[\\"{{ data.to[0].address }}\\"]}}",
  "Timestamp": "{{ event.created_at }}",
  "SignatureVersion": "1",
  "Signature": "{{ random_string(344) }}",
  "SigningCertURL": "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-sendmock.pem",
  "UnsubscribeURL": "https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:123456789012:sendmock-ses"
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
      "svix-timestamp": "{{ event.created_at | unix }}",
      "svix-signature":
        "{{ svix_signature(vars.resend_signing_secret, event.id, event.created_at | unix) }}",
    },
    body_template: `{
  "type": "{{ event.type | resend_type }}",
  "created_at": "{{ event.created_at }}",
  "data": {
    "created_at": "{{ event.created_at }}",
    "email_id": "{{ data.message_id | default(data.id) }}",
    "from": "{{ data.from.address }}",
    "to": ["{{ data.to[0].address }}"],
    "subject": "{{ data.subject }}"
  }
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
  "google_chat.message": {
    method: "POST",
    content_type: jsonType,
    header_templates: {},
    body_template: `{
  "text": "New {{ event.type }}: {{ data.subject | default(data.body) }}"
}`,
    doc_url: "https://developers.google.com/workspace/chat/quickstart/webhooks",
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
  ...inboundEmailTemplateDefinitions,
  ...paymentTemplateDefinitions,
};

/** The definition for a template, native JSON when it has none of its own. */
export function readTemplateDefinition(templateId: string): TemplateDefinition {
  return templateDefinitions[templateId] ?? nativeDefinition;
}
