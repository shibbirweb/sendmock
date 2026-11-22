import type { TemplateDefinition } from "@/mocks/fixtures/template-definitions";

/**
 * Twilio's Debugger event webhook: a form POST signed with `X-Twilio-Signature`, read from
 * Twilio's "Debugging Events Webhook" docs, checked 2026-11-22 (docs/plan/32-after-1-0.md, A23).
 */
export const twilioDebuggerTemplateDefinitions: Record<
  string,
  TemplateDefinition
> = {
  "twilio.debugger": {
    method: "POST",
    content_type: "application/x-www-form-urlencoded",
    header_templates: {
      "X-Twilio-Signature":
        "{{ twilio_signature(endpoint.url, body_fields, vars.twilio_auth_token) }}",
      "User-Agent": "TwilioProxy/1.1",
    },
    // SendMock's Debugger sender fills the debugger fields; on a webhook endpoint they come from
    // the SMS event, with a new NO SID each time.
    body_template: `Sid={{ data.debugger_sid | default("NO" ~ random_hex(32)) }}&AccountSid={{ data.account | default(vars.twilio_account_sid) | default("AC00000000000000000000000000000000") }}{% if data.parent_account_sid %}&ParentAccountSid={{ data.parent_account_sid }}{% endif %}&Timestamp={{ event.created_at | urlencode }}&Level=ERROR&PayloadType=application%2Fjson&Payload={{ data.debugger_payload | default({"resource_sid": data.provider_id, "service_sid": data.messaging_service_sid, "error_code": data.error_code, "more_info": {"Msg": "Message delivery failed", "ErrorCode": data.error_code, "LogLevel": "ERROR"}} | tojson) | urlencode }}`,
    doc_url:
      "https://www.twilio.com/docs/usage/troubleshooting/debugging-event-webhooks",
    verified_on: "2026-11-22",
  },
};
