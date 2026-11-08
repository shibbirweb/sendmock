import type { TemplateDefinition } from "@/mocks/fixtures/template-definitions";

/**
 * Meta's WhatsApp Cloud API webhook: one envelope for a reply (`messages`) or a status
 * (`statuses`), signed with `X-Hub-Signature-256` from the app secret; read from Meta's Node
 * SDK's webhook types and handler, checked 2026-11-08 (docs/plan/32-after-1-0.md, A8). A
 * failed status carries `131026`, the Cloud API's code for an undeliverable message.
 */
export const whatsappTemplateDefinitions: Record<string, TemplateDefinition> = {
  "whatsapp.cloud": {
    method: "POST",
    content_type: "application/json",
    header_templates: {
      "X-Hub-Signature-256":
        "{{ whatsapp_signature(vars.whatsapp_cloud_app_secret) }}",
    },
    body_template: `{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "{{ vars.whatsapp_cloud_business_account_id }}",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "{% if event.type == "sms.inbound" %}{{ data.to_number | replace("+", "") }}{% else %}{{ data.from_number | replace("+", "") }}{% endif %}",
          "phone_number_id": "{{ vars.whatsapp_cloud_phone_number_id }}"
        },
{% if event.type == "sms.inbound" %}        "contacts": [{ "profile": { "name": "{{ data.from_number }}" }, "wa_id": "{{ data.from_number | replace("+", "") }}" }],
        "messages": [{
          "from": "{{ data.from_number | replace("+", "") }}",
          "id": "{{ data.provider_id }}",
          "timestamp": "{{ event.created_at | unix }}",
          "type": "text",
          "text": { "body": "{{ data.body }}" }
        }]
{% else %}        "statuses": [{
          "id": "{{ data.provider_id }}",
          "status": "{{ data.status }}",
          "timestamp": "{{ event.created_at | unix }}",
          "recipient_id": "{{ data.to_number | replace("+", "") }}"{% if data.status == "failed" %},
          "errors": [{ "code": 131026, "title": "Message undeliverable", "message": "Message undeliverable", "error_data": { "details": "Message failed to send because the recipient could not be reached (SendMock outcome {{ data.error_code }})." } }]{% endif %}
        }]
{% endif %}      }
    }]
  }]
}`,
    doc_url:
      "https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components",
    verified_on: "2026-11-08",
  },
};
