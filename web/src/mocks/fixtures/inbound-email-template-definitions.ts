import type { TemplateDefinition } from "@/mocks/fixtures/template-definitions";

const jsonType = "application/json";
const verifiedOn = "2026-09-30";

/** The providers' inbound email formats, with attachments as each sends them (WH-06.3). */
export const inboundEmailTemplateDefinitions: Record<
  string,
  TemplateDefinition
> = {
  "sendgrid.inbound_parse": {
    method: "POST",
    content_type: "multipart/form-data; boundary=xYzZY",
    header_templates: {},
    // SendGrid posts the parsed message as multipart, with each file as attachmentN; the
    // sender fetches each file from its URL when the request goes out (WH-06.3).
    body_template: [
      "--xYzZY",
      'Content-Disposition: form-data; name="from"',
      "",
      "{{ data.from.address }}",
      "--xYzZY",
      'Content-Disposition: form-data; name="to"',
      "",
      "{{ data.to[0].address }}",
      "--xYzZY",
      'Content-Disposition: form-data; name="subject"',
      "",
      "{{ data.subject }}",
      "--xYzZY",
      'Content-Disposition: form-data; name="text"',
      "",
      "{{ data.text_body | default('') }}",
      "--xYzZY",
      'Content-Disposition: form-data; name="html"',
      "",
      "{{ data.html_body | default('') }}",
      "--xYzZY",
      'Content-Disposition: form-data; name="envelope"',
      "",
      '{"to":["{{ data.to[0].address }}"],"from":"{{ data.from.address }}"}',
      "--xYzZY",
      'Content-Disposition: form-data; name="attachments"',
      "",
      "{{ data.attachments | length }}",
      "{% for attachment in data.attachments %}--xYzZY",
      'Content-Disposition: form-data; name="attachment{{ loop.index }}"; filename="{{ attachment.filename }}"',
      "X-Sendmock-File-Url: {{ attachment.url }}",
      "",
      "{% endfor %}--xYzZY--",
      "",
    ].join("\r\n"),
    doc_url:
      "https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook",
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
  "MessageID": "{{ data.message_id | default(data.id) }}",
  "Attachments": [{% for attachment in data.attachments %}{"Name": "{{ attachment.filename }}", "Content": "{{ attachment.content_base64 | default('') }}", "ContentType": "{{ attachment.content_type }}", "ContentLength": {{ attachment.size_bytes }}, "ContentID": "{{ attachment.content_id | default('') }}"}{% if not loop.last %}, {% endif %}{% endfor %}]
}`,
    doc_url: "https://postmarkapp.com/developer/webhooks/inbound-webhook",
    verified_on: verifiedOn,
  },
};
