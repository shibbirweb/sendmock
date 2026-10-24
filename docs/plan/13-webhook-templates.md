# 13. Webhook Payload Templates

A **payload template** is a reusable recipe for a webhook request: method, content type, headers, query params, body and signing scheme, all written with the variable and filter system from [12-webhook-variables.md](12-webhook-variables.md).

Users can:

1. **Pick a built-in template** for a popular service (Twilio, Mailgun, SendGrid, Slack, ...) so the webhook looks exactly like what that service sends or accepts.
2. **Create custom templates** from scratch or by cloning a built-in one, save them, and reuse them across endpoints.

## Two families of built-in templates

### A. "Act like the provider" (inbound to your app)

MessageHook sends the webhook your app would receive from a real provider, so your production handler is tested unchanged.

**Email providers (inbound mail and events)**

| Service | Templates | Events |
|---------|-----------|--------|
| Mailgun | Routes (inbound, form/multipart), Event webhook (`delivered`, `opened`, `failed`) | email.received, email.opened, email.delivered, email.bounced, email.complained |
| SendGrid | Inbound Parse (multipart), Event Webhook (`delivered`, `open`) | email.received, email.opened, email.delivered, email.bounced, email.complained |
| Postmark | Inbound (JSON), Open, Delivery | email.received, email.opened, email.delivered, email.bounced, email.complained |
| Amazon SES via SNS | Receipt notification, Bounce, Complaint, Delivery, SNS subscription confirmation | email.received, email.delivered, email.bounced, email.complained |
| Resend | Webhook events (`email.delivered`, `email.opened`) | email.received, email.opened, email.delivered, email.bounced, email.complained |
| Brevo (Sendinblue) | Inbound parsing, transactional events | email.received, email.opened, email.delivered, email.bounced, email.complained |
| Mailchimp Transactional (Mandrill) | Inbound, message events (`mandrill_events` form field) | email.received, email.opened, email.delivered, email.bounced, email.complained |
| SparkPost | Relay webhook, message events | email.received, email.opened, email.delivered, email.bounced, email.complained |

**SMS providers (inbound SMS and status callbacks)**

| Service | Templates | Events |
|---------|-----------|--------|
| Twilio | Inbound SMS (form + `X-Twilio-Signature`), status callback, `read` callback | sms.inbound, sms.status, sms.opened |
| Vonage | Inbound SMS, delivery receipt (DLR) | sms.inbound, sms.status |
| Plivo | Inbound message, message status | sms.inbound, sms.status |
| MessageBird / Bird | Inbound, status report | sms.inbound, sms.status |
| Telnyx | `message.received`, `message.finalized` | sms.inbound, sms.status |
| Sinch | Inbound (MO), delivery report | sms.inbound, sms.status |
| Infobip | Inbound, delivery report | sms.inbound, sms.status |
| Africa's Talking | Incoming message, delivery report | sms.inbound, sms.status |
| AWS SNS (SMS) | Delivery status log shape | sms.status |

**Payment gateways (IPN and webhooks)**, see [17-payments.md](17-payments.md)

| Service | Templates | Events |
|---------|-----------|--------|
| Stripe | Webhook event with `Stripe-Signature` | payment.*, checkout.*, subscription.* |
| PayPal | Webhook (transmission headers), classic IPN form post | payment.*, checkout.* |
| SSLCommerz | IPN POST with `verify_sign`, success/fail/cancel POST | payment.*, checkout.* |
| bKash | Callback redirect parameters | payment.* |
| Razorpay | Webhook with `X-Razorpay-Signature` | payment.* |
| Paddle | Webhook with `Paddle-Signature` | payment.*, subscription.* |

### B. "Notify a tool" (outbound to chat and automation)

Forward captured messages to the tools a team already uses:

| Service | Template |
|---------|----------|
| Slack | Incoming webhook with Block Kit message (subject, from, OTP, "Open in MessageHook" button) |
| Discord | Webhook with embed |
| Microsoft Teams | Workflows / Adaptive Card payload |
| Google Chat | Card message |
| Telegram | Bot `sendMessage` (URL includes `{{ vars.telegram_bot_token }}`) |
| Mattermost / Rocket.Chat | Slack-compatible payload |
| n8n / Zapier / Make / Pipedream | Flat JSON, easy to map in those tools |
| Generic | Native MessageHook JSON signed with Standard Webhooks (the default) |

Each built-in template declares the **variables it needs** (e.g. Twilio needs `twilio_auth_token` for the signature, Telegram needs `telegram_bot_token` and `telegram_chat_id`). The UI asks for them when the template is chosen and stores them as endpoint variables (secrets masked).

Fidelity: provider templates are based on each provider's public docs and checked by fixture tests. Each template shows a "verified against docs as of <date>" note and a link to the provider doc page.

## Template definition

Built-in templates ship inside the binary as TOML files (`crates/messagehook-webhooks/templates/builtin/*.toml`). Custom templates use the same schema, so a built-in one can be cloned and edited.

```toml
id = "twilio.inbound_sms"
name = "Twilio: inbound SMS"
category = "sms-provider"          # email-provider | sms-provider | chat | automation | generic | custom
service = "twilio"
description = "Form-encoded POST that Twilio sends when your number receives an SMS."
events = ["sms.inbound"]
docs_url = "https://www.twilio.com/docs/messaging/guides/webhook-request"

[request]
method = "POST"
content_type = "application/x-www-form-urlencoded"
body_mode = "fields"

[request.headers]
"User-Agent" = "TwilioProxy/1.1"
"X-Twilio-Signature" = "{{ twilio_signature(endpoint.url, body_fields, vars.twilio_auth_token) }}"

[[request.fields]]
key = "MessageSid"
value = "{{ data.provider_id }}"

[[request.fields]]
key = "AccountSid"
value = "{{ vars.twilio_account_sid | default('AC' ~ random_hex(32)) }}"

[[request.fields]]
key = "From"
value = "{{ data.from }}"

[[request.fields]]
key = "To"
value = "{{ data.to }}"

[[request.fields]]
key = "Body"
value = "{{ data.body }}"

[[request.fields]]
key = "NumMedia"
value = "{{ data.media | length }}"

[[variables]]
name = "twilio_auth_token"
kind = "secret"
required = true
description = "Used to compute X-Twilio-Signature. Use the same token your app verifies with."

[[variables]]
name = "twilio_account_sid"
kind = "text"
required = false
```

Schema notes:

- `events` restricts which events the template can be used with; the UI only offers matching templates.
- `body_mode` is one of `fields`, `raw`, `none` (see [12-webhook-variables.md](12-webhook-variables.md)); `raw` uses `request.body`.
- Provider signing helpers are exposed as template functions (`standard_webhooks_signature`, `twilio_signature`, `mailgun_signature`, `sendgrid_signature`, `slack_signature`, `stripe_style_signature`) so templates stay declarative.
- `multipart` fields can attach files: `{ key = "attachment1", file = "{{ data.attachments[0].url }}" }`, and MessageHook streams the bytes in.
- Optional `[sample]` block gives a fixture event for previewing without real data.

## Custom templates

### Creating

- **New blank template** with the same editor as the endpoint request editor (URL, params, headers, body Fields/Raw, signing).
- **Clone a built-in** and edit (e.g. "SendGrid Inbound Parse, but with our extra `X-Tenant` header").
- **Save as template** from any endpoint or from the manual composer.
- **Import** a template file (TOML or JSON) or paste JSON.

### Using

- When creating an endpoint, choose "Template: ..." from a searchable gallery (filter by category, service, event).
- Endpoint link modes:
  - **Linked (default for custom templates):** the endpoint follows template updates. Endpoint-level overrides (extra headers, extra fields, variables) are layered on top.
  - **Detached:** copy the template into the endpoint and edit freely; no future updates.
- Built-in templates are always linked and read-only; upgrading MessageHook can improve them. Clone to freeze a version.

### Sharing across a team

- **Export** a template as `<id>.messagehook-template.toml` (secrets never exported, only variable declarations).
- **Templates directory:** `--templates-dir ./messagehook-templates` (or `MESSAGEHOOK_TEMPLATES_DIR`) loads every `*.toml` at startup and watches for changes. Teams commit this folder to their app repo so everyone gets the same templates.
- Directory templates show a "from file" badge and are read-only in the UI (edit the file or clone).

### Versioning and safety

- Custom templates keep a simple revision history (last 20 versions) with diff and restore.
- Saving validates the template by rendering it against its sample (or a built-in fixture for each declared event). Invalid templates cannot be saved, with errors shown inline.
- Deleting a template used by endpoints requires choosing: detach those endpoints (copy) or cancel.

## Storage

`webhook_templates` table:

| Column | Notes |
|--------|-------|
| id | slug, unique (`custom.my_tenant_inbound`) |
| source | `builtin`, `custom`, `file` |
| name, description, category, service | |
| events | JSON list |
| definition | JSON (same schema as TOML) |
| revision | integer, bumps on save |
| created_at, updated_at | |

Built-in and file templates are loaded into memory at startup and not stored as rows (only custom ones are), so upgrades replace them cleanly. `webhook_template_revisions` keeps custom history. `webhook_endpoints` gains `template_id`, `template_mode` (`linked`/`detached`) and `overrides` (JSON).

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/webhooks/templates` | list (filters: `category`, `service`, `event`, `source`) |
| GET | `/webhooks/templates/{templateId}` | full definition |
| POST | `/webhooks/templates` | create custom (or `{"clone_from": "twilio.inbound_sms"}`) |
| PATCH / DELETE | `/webhooks/templates/{templateId}` | edit / delete custom |
| GET | `/webhooks/templates/{templateId}/revisions` | history |
| POST | `/webhooks/templates/{templateId}/render` | preview against `email_id`, `sms_id` or the sample |
| GET | `/webhooks/templates/{templateId}/export` | download TOML |
| POST | `/webhooks/templates/import` | upload TOML/JSON |

## UI

- **Templates gallery** (Webhooks > Templates): cards with service logo (simple monochrome icon, no third-party branding beyond the name), category tabs (Email providers, SMS providers, Chat, Automation, Custom), search, event filter chips.
- **Template detail:** description, supported events, required variables, provider doc link, live preview (choose a message), "Use in new endpoint", "Clone", "Export".
- **Template editor:** same request editor as endpoints, plus a "Variables this template needs" panel and a Sample tab.
- **Endpoint editor:** template picker at the top; when linked, shows "Based on <template> rev N" with an "Overrides" section beneath.

## Roadmap placement

The full gallery and editor UI is built on mock data in Phase U2 (catalogue shipped as fixture data). Backend phases:

- Phase 3: template schema, native/generic template, Twilio and Vonage templates, Slack and Discord, custom templates (create, clone, save from endpoint, linked/detached), gallery UI, render preview.
- Phase 4: remaining email providers (Mailgun, SendGrid, Postmark, SES, Resend, Brevo, Mandrill, SparkPost), remaining SMS providers, Teams, Google Chat, Telegram, automation tools, import/export, templates directory, revision history.
