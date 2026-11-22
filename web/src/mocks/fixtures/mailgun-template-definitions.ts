import type { TemplateDefinition } from "@/mocks/fixtures/template-definitions";

const jsonType = "application/json";
const verifiedOn = "2026-09-30";
const forwardVerifiedOn = "2026-11-22";
const forwardBoundary = "MailgunForward";

/** One multipart form field of Mailgun's forward, as lines joined with CRLF. */
function forwardField(fieldName: string, valueTemplate: string): string[] {
  return [
    `--${forwardBoundary}`,
    `Content-Disposition: form-data; name="${fieldName}"`,
    "",
    valueTemplate,
  ];
}

/**
 * Mailgun's inbound route forward and event webhooks. Both the binary's template engine and
 * the demo's Jinja subset render them, so conditions are single comparisons in nested ifs.
 */
export const mailgunTemplateDefinitions: Record<string, TemplateDefinition> = {
  "mailgun.routes": {
    method: "POST",
    content_type: `multipart/form-data; boundary=${forwardBoundary}`,
    header_templates: {},
    // Mailgun's store-and-notify forward: the parsed message, every header, the stripped
    // reply and signature, and each file as attachment-N, fetched from its URL when sent.
    body_template: [
      "{% set mailgun_timestamp = event.created_at | unix %}{% set mailgun_token = random_hex(50) %}",
      ...forwardField("recipient", "{{ data.to[0].address }}"),
      ...forwardField("sender", "{{ data.from.address }}"),
      ...forwardField("from", "{{ data.from.address }}"),
      ...forwardField("To", "{{ data.to[0].address }}"),
      ...forwardField("subject", "{{ data.subject }}"),
      ...forwardField(
        "Message-Id",
        "{% if data.message_id %}{{ data.message_id }}{% endif %}",
      ),
      ...forwardField("In-Reply-To", '{{ data.in_reply_to | default("") }}'),
      ...forwardField("References", '{{ data.references | default("") }}'),
      ...forwardField(
        "body-plain",
        "{% if data.text_body %}{{ data.text_body }}{% endif %}",
      ),
      ...forwardField(
        "stripped-text",
        '{{ data.stripped_text | default("") }}',
      ),
      ...forwardField(
        "stripped-signature",
        '{{ data.stripped_signature | default("") }}',
      ),
      ...forwardField(
        "body-html",
        "{% if data.html_body %}{{ data.html_body }}{% endif %}",
      ),
      ...forwardField(
        "stripped-html",
        "{% if data.html_body %}{{ data.html_body }}{% endif %}",
      ),
      ...forwardField(
        "message-headers",
        "{% if data.header_pairs %}{{ data.header_pairs | tojson }}{% else %}[]{% endif %}",
      ),
      ...forwardField(
        "content-id-map",
        "{% if data.content_id_map %}{{ data.content_id_map | tojson }}{% else %}{}{% endif %}",
      ),
      ...forwardField("message-url", '{{ data.message_url | default("") }}'),
      ...forwardField("attachment-count", "{{ data.attachments | length }}"),
      ...forwardField("timestamp", "{{ mailgun_timestamp }}"),
      ...forwardField("token", "{{ mailgun_token }}"),
      ...forwardField(
        "signature",
        "{{ mailgun_signature(vars.mailgun_signing_key, mailgun_timestamp, mailgun_token) }}",
      ),
      `{% for attachment in data.attachments %}--${forwardBoundary}`,
      'Content-Disposition: form-data; name="attachment-{{ loop.index }}"; filename="{{ attachment.filename }}"',
      "X-Sendmock-File-Url: {{ attachment.url }}",
      "",
      `{% endfor %}--${forwardBoundary}--`,
      "",
    ].join("\r\n"),
    doc_url:
      "https://documentation.mailgun.com/docs/mailgun/user-manual/receive-forward-store/",
    verified_on: forwardVerifiedOn,
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
    "event": "{{ event.type | mailgun_event }}",{% if event.type == "email.bounced" %}{% if data.bounce %}{% if data.bounce.severity == "temporary" %}
    "log-level": "warn",
    "severity": "temporary",
    "reason": "generic",{% else %}
    "log-level": "error",
    "severity": "permanent",
    "reason": "bounce",{% endif %}
    "delivery-status": {
      "code": {{ data.bounce.code | default(550) }},
      "enhanced-code": "{{ data.bounce.enhanced_code | default("") }}",
      "message": "{{ data.bounce.message | default("") }}",
      "description": "{{ data.bounce.message | default("") }}",
      "attempt-no": 1
    },{% else %}
    "log-level": "error",
    "severity": "permanent",
    "reason": "bounce",
    "delivery-status": {
      "code": 550,
      "enhanced-code": "5.1.1",
      "message": "user unknown",
      "description": "user unknown",
      "attempt-no": 1
    },{% endif %}{% endif %}{% if event.type == "email.deferred" %}
    "log-level": "warn",
    "severity": "temporary",
    "reason": "generic",
    "delivery-status": {
      "code": 421,
      "enhanced-code": "4.4.1",
      "message": "deferred",
      "description": "deferred",
      "attempt-no": 1
    },{% endif %}{% if event.type == "email.delivered" %}
    "log-level": "info",
    "delivery-status": {
      "code": 250,
      "enhanced-code": "",
      "message": "OK",
      "description": "",
      "attempt-no": 1
    },{% endif %}{% if event.type == "email.complained" %}
    "log-level": "warn",{% endif %}{% if event.type == "email.opened" %}
    "log-level": "info",{% endif %}{% if event.type == "email.clicked" %}
    "log-level": "info",
    "url": "{{ data.url }}",{% endif %}{% if event.type == "email.unsubscribed" %}
    "log-level": "info",{% endif %}
    "recipient": "{{ data.recipient | default(data.to[0].address) }}",
    "recipient-domain": "{{ data.recipient | default(data.to[0].address) | regex_replace("^.*@", "") }}",
    "tags": {% if data.tags %}{{ data.tags | tojson }}{% else %}[]{% endif %},
    "user-variables": {% if data.user_variables %}{{ data.user_variables | tojson }}{% else %}{}{% endif %},
    "message": {
      "headers": {
        "message-id": "{% if data.provider_message_id %}{{ data.provider_message_id | regex_replace("^<|>$", "") }}{% else %}{{ data.message_id | default(data.id) | regex_replace("^<|>$", "") }}{% endif %}",
        "from": "{{ data.from.address }}",
        "to": "{{ data.to[0].address }}",
        "subject": "{{ data.subject }}"
      },
      "size": {{ data.size_bytes | default(0) }}
    }
  }
}`,
    doc_url:
      "https://documentation.mailgun.com/docs/mailgun/user-manual/events/webhooks/",
    verified_on: verifiedOn,
  },
};
