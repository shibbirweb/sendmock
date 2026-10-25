# 05. Webhooks

Webhooks are how SendMock talks back to your app. Two trigger modes:

- **Automatic:** rules fire when matching events happen.
- **Manual:** you pick a message (or write a payload) and send it on demand from the UI, API or CLI.

Every attempt is logged with full request and response, and can be replayed.

## Events

| Event | Fires when |
|-------|-----------|
| `email.received` | message stored (via SMTP or an email HTTP send API) |
| `email.inbound` | an incoming email for your app was created: a simulated reply, `POST /api/v1/emails/inbound`, or SMTP mail to an inbound domain (see [Email replies and inbound routes](#email-replies-and-inbound-routes-mailgun-style)) |
| `email.opened` | an email was opened in the UI, or an open was simulated via API (see [Opened events](#opened-events)) |
| `email.delivered`, `email.deferred`, `email.bounced`, `email.complained`, `email.unsubscribed` | simulated delivery outcomes (magic addresses, delivery profile, manual buttons; see [03-email.md](03-email.md#delivery-outcome-simulation)) |
| `email.released` | an email was released or auto-forwarded to a real SMTP server |
| `email.deleted` | message deleted (off by default for rules) |
| `sms.sent` | your app sent an SMS (or WhatsApp message) to SendMock |
| `sms.status` | simulated delivery status changed |
| `sms.opened` | an SMS was viewed in the UI, or a read was simulated via API (see [Opened events](#opened-events)) |
| `sms.inbound` | a simulated incoming SMS was created (also sent to the number's reply webhook, see [04-sms.md](04-sms.md#reply-webhook-twilio-style)) |
| `verify.started`, `verify.checked`, `verify.expired` | Twilio Verify emulation (see [04-sms.md](04-sms.md#twilio-verify)) |
| `http.captured` | the HTTP catcher captured a request from your app (see [15-http-catcher.md](15-http-catcher.md)) |
| `payment.*`, `checkout.*`, `subscription.*` | payment gateway emulation: created, authorized, succeeded, failed, canceled, refunded, disputes, checkout completed/expired, subscriptions (see [17-payments.md](17-payments.md#events)) |
| `webhook.failed` | a delivery exhausted retries (useful to chain alerts) |
| `webhook.delivered` | a delivery attempt finished, whatever the outcome; drives the live deliveries log and cannot be picked in rules, so a delivery never triggers another |
| `test.ping` | "Send test" button on an endpoint |

## Opened events

`email.opened` and `sms.opened` stand in for "the recipient opened / read the message", so apps can test open tracking, read receipts and engagement logic (e.g. "mark notification as seen", "stop the reminder once the OTP SMS was read").

### When they fire

| Source | `source` value | Behaviour |
|--------|----------------|-----------|
| Viewing an email detail in the UI | `ui` | fires when the detail view is shown |
| SMS bubble scrolled into view in a conversation | `ui` | fires per message when it becomes visible (IntersectionObserver, debounced) |
| "Simulate open" button in the UI | `manual` | always fires, even if already opened |
| `POST /api/v1/emails/{emailId}/open`, `POST /api/v1/sms/{smsId}/open` | `api` | always fires, for CI tests |

Rules:

- **First open vs every open:** by default UI views fire only on the first open (`first_open: true`). A setting switches to "every open" (re-opens send `first_open: false` with an incremented `open_count`). Manual and API opens always fire.
- **Auto-fire toggle:** Settings has "Fire opened events when I view messages" (default on). Turn it off to browse messages without triggering webhooks; manual and API opens still work.
- **Only for the right direction:** `sms.opened` applies to outbound SMS (sent by your app to a user). Viewing a simulated inbound SMS does not fire it.
- **Mark unread** does not reset `open_count` or `opened_at`; it only changes the read flag in the UI.
- **Tracking pixels:** SendMock blocks remote images by default. When you click "Load images", the browser requests your app's own tracking pixel directly, so your existing pixel-based tracking also works. `email.opened` is independent of that and fires either way.

### Native payload

```json
{
  "id": "evt_01JB...",
  "type": "email.opened",
  "created_at": "2026-10-24T16:05:00Z",
  "data": {
    "id": "01JB...",
    "message_id": "<abc@app.test>",
    "to": [{ "name": "", "address": "user@example.com" }],
    "subject": "Verify your account",
    "opened_at": "2026-10-24T16:05:00Z",
    "first_open": true,
    "open_count": 1,
    "source": "ui",
    "user_agent": "Mozilla/5.0 ..."
  }
}
```

`sms.opened` carries the SMS fields instead (`id`, `provider_id`, `from`, `to`, `body`, `api`) plus the same `opened_at`, `first_open`, `open_count` and `source`.

### Provider-shaped open formats

| Format | Shape | Phase |
|--------|-------|-------|
| SendGrid Event Webhook | JSON array with `event: "open"`, `email`, `timestamp`, `sg_message_id` | 4 |
| Mailgun webhooks | `event-data.event: "opened"` with signature block | 4 |
| Postmark Open webhook | `RecordType: "Open"`, `MessageID`, `Recipient`, `FirstOpen` | 4 |
| Twilio status callback | `MessageStatus=read` (as Twilio reports for WhatsApp/RCS) | 4 |

Plain SMS has no read receipts on real networks, so `sms.opened` is a simulation feature. The Twilio `read` format is offered for apps that also handle WhatsApp/RCS channels.

## Endpoints

An endpoint is a destination. URL, query params, headers, body and secret all accept variables and templates (static, secret, dynamic, random, computed, prompt), defined in [12-webhook-variables.md](12-webhook-variables.md).

| Field | Notes |
|-------|-------|
| Name | e.g. "Laravel inbound mail" |
| URL | e.g. `http://localhost:8000/webhooks/inbound-mail`; `host.docker.internal` hint in UI when running in Docker |
| Method | `POST` (default), `PUT`, `PATCH`, `GET` |
| Headers | static headers, e.g. `Authorization: Bearer ...` |
| Template | native JSON (default), a built-in service template (Twilio, Mailgun, Slack, ...) or a custom template; see [13-webhook-templates.md](13-webhook-templates.md) |
| Secret | used for signing |
| Timeout | default 10 s |
| Retry policy | max attempts (default 5), backoff (exponential: 1s, 5s, 30s, 2m, 10m), retry on 5xx/timeouts/connection errors, not on 4xx (configurable) |
| Enabled | toggle |

## Rules (automatic mode)

A rule links events to an endpoint with an optional filter:

```json
{
  "endpoint_id": "01JB...",
  "events": ["email.received"],
  "filter": {
    "all": [
      { "field": "to", "operator": "matches", "value": "*@support.local" },
      { "field": "subject", "operator": "contains", "value": "Ticket" }
    ]
  }
}
```

- Fields: email (`from`, `to`, `cc`, `subject`, `body`, `header:<name>`, `has_attachment`, `tag`), SMS (`from`, `to`, `body`, `status`, `api`), opened events (`open_count`, `first_open`, `source`).
- Operators: `equals`, `contains`, `starts_with`, `matches` (glob), `regex`, `exists`.
- Combinators: `all`, `any`, `not`.
- The UI provides a visual rule builder plus a "test against recent messages" preview that shows which existing messages would match.
- Matching: `equals`, `contains`, `starts_with` and `matches` ignore case; `regex` uses JavaScript-compatible syntax and is case-sensitive. A field with several values (`to`, `cc`, `tag`) matches when any value matches. `exists` is true when the field has a non-empty value. A field the event does not have never matches (and `exists` is false).
- Rules fire in their list order; each matching enabled rule creates one delivery. `not` wraps one condition or one group; the builder offers one nested group level, and the API accepts deeper nesting.

## Manual mode

- **From a message:** "Send to webhook" button on any email/SMS. Pick endpoint and format, preview the rendered request, optionally edit the body, send.
- **Variables at send time:** the send dialog asks for any Prompt variables and lets you override others for this one send.
- **From scratch:** a mini request composer (like a tiny Postman) with presets for each provider format, e.g. "Twilio inbound SMS" or "SendGrid inbound parse".
- **Replay:** any past delivery can be resent as-is, or edited then resent.
- **API:** `POST /api/v1/webhooks/{endpointId}/send` with `{ "email_id": "..." }`, `{ "sms_id": "..." }` or a raw payload, so CI scripts can trigger it.
- **CLI:** `sendmock webhook send --endpoint <name> --email <id>` talking to a running instance.

## Email replies and inbound routes (Mailgun style)

Phase 4. Apps that let users answer an email (support tickets, comment notifications with `reply+<token>@...` addresses) need a reply to arrive as a webhook. SendMock simulates the reply and delivers it the way Mailgun Routes do, so the inbound handler you run in production can be tested locally.

### Simulating replies and forwards

The recipient of an email your app sent can **reply**, **reply all** or **forward** it, from the email detail (see the design in [07-ui.md](07-ui.md#mail)) or the API:

| Action | API | Result |
|--------|-----|--------|
| Reply | `POST /api/v1/emails/{emailId}/reply` with `body`, optional `subject`, `html`, `from`, `include_original` and attachments | to the original `Reply-To` (or `From`), from the original recipient (or `from`), `Re: <subject>`, the original quoted below an "On ... wrote:" line |
| Reply all | the same with `reply_all: true` | as Reply, plus the other original recipients in `Cc` |
| Forward | `POST /api/v1/emails/{emailId}/forward` with `to`, optional `body` (a note above the forwarded message), `subject`, `from`, `include_original` and `include_attachments` | to the given address (for example `support@inbound.app.test`), `Fwd: <subject>`, the original below a "---------- Forwarded message ---------" block with its From, Date, Subject and To, and the original attachments (on by default) |

- `include_original` (default `true`) makes the server add the quote or the forwarded-message block. The UI puts that text in the message box itself, Gmail style, and sends `false`.
- Replies get `In-Reply-To` and `References` from the original `Message-ID`; forwards get `References` only, as mail clients do.
- `Re:` and `Fwd:` are not doubled when the subject already starts with them.
- Only emails your app sent (`direction: outbound`) can be replied to or forwarded; the API returns `409` for incoming emails.
- The original email lists its replies and forwards, and its timeline gets "Replied by recipient" and "Forwarded by recipient" entries.
- `POST /api/v1/emails/inbound` creates any incoming email (fields or raw MIME), for example a fresh message to `support@inbound.app.test`.
- Mail that arrives over SMTP for an **inbound domain** (Settings, e.g. `reply.app.test`, `*.inbound.local`) is also treated as incoming.
- Incoming emails are stored with `direction: inbound`, shown with an Inbound badge and a "Reply to" or "Forward of" link to the original, and fire `email.inbound` (not `email.received`, so rules on mail your app sends never loop on replies).

### Inbound routes

Routes follow Mailgun's model, so a route copied from the Mailgun dashboard or created through its API behaves the same:

| Part | Mailgun syntax | Meaning |
|------|----------------|---------|
| Filter | `match_recipient("reply\+(?P<token>.+)@reply.app.test")` | regex on each recipient; named groups can be used in actions as `\g<token>` |
| Filter | `match_header("subject", ".*support")` | regex on a header |
| Filter | `catch_all()` | every incoming email |
| Action | `forward("http://localhost:8000/webhooks/mail")` | POST the parsed email to a URL |
| Action | `forward("dev@company.com")` | forward to a real address; only through the release allowlist ([03-email.md](03-email.md#release-and-forwarding-to-real-smtp)) |
| Action | `store(notify="http://localhost:8000/webhooks/stored")` | keep the message and POST a notification with `message-url`; `GET` on that URL returns the message as Mailgun does |
| Action | `stop()` | do not evaluate lower-priority routes |

- Routes run by `priority` (lower first); every matching route runs until one calls `stop()`.
- The forwarded request is Mailgun's: `multipart/form-data` with `recipient`, `sender`, `from`, `subject`, `body-plain`, `stripped-text`, `stripped-signature`, `body-html`, `stripped-html`, `attachment-count`, `attachment-N`, `message-headers`, `content-id-map`, and the `timestamp`, `token`, `signature` fields (HMAC-SHA256 with the webhook signing key). A URL ending in `mime` gets `body-mime` instead of the parsed fields.
- `stripped-text` removes the quoted original and the "On ... wrote:" line; `stripped-signature` holds the text after a `-- ` signature separator.
- Responses: `2xx` is success, `406` rejects the message without retries, anything else is retried on Mailgun's schedule (compressed by the endpoint's retry policy for fast tests).
- Mailgun Routes API on the provider port: `GET` and `POST /v3/routes`, `GET`, `PUT` and `DELETE /v3/routes/{routeId}`, so apps that create their routes on boot work against SendMock.
- Routes can also send in another provider's inbound format (SendGrid Inbound Parse, Postmark inbound) by picking that template; the filter and action model stays the same.
- Every forward is a normal webhook delivery: logged, replayable and visible in the email's timeline.

UI: **Webhooks > Inbound routes** (list with priority, expression and actions, editor with a "matches N of the last 50 incoming emails" preview). API: `/api/v1/inbound-routes`; CLI: `sendmock route list|create|test`; MCP: `sendmock_inbound_routes_{list,create,update,delete,test}`.

## Payload formats

### Native (default)

JSON, consistent across event types:

```json
{
  "id": "evt_01JB...",
  "type": "email.received",
  "created_at": "2026-10-24T16:00:00Z",
  "data": {
    "id": "01JB...",
    "from": { "name": "App", "address": "no-reply@app.test" },
    "to": [{ "name": "", "address": "user@example.com" }],
    "subject": "Verify your account",
    "text": "...",
    "html": "...",
    "headers": { "Message-ID": "..." },
    "attachments": [
      { "filename": "invoice.pdf", "content_type": "application/pdf", "size": 1234, "url": "http://localhost:8025/api/v1/emails/01JB.../attachments/0" }
    ],
    "extracted": { "otp": ["482913"], "links": ["https://app.test/verify?t=..."] }
  }
}
```

Options per endpoint: include raw `.eml` (base64), inline attachments as base64 vs URLs, include HTML or not.

### Provider-shaped formats

So you can test the exact handler you run in production. These are delivered as built-in **payload templates**; the full catalogue (email providers, SMS providers, Slack/Discord/Teams and automation tools) and **custom templates** are defined in [13-webhook-templates.md](13-webhook-templates.md).

| Format | Shape | Phase |
|--------|-------|-------|
| Twilio inbound SMS | form-encoded `From`, `To`, `Body`, `MessageSid`, `NumMedia`, ... + `X-Twilio-Signature` | 3 |
| Twilio status callback | form-encoded `MessageSid`, `MessageStatus`, `ErrorCode`, ... | 3 |
| Vonage inbound / DLR | JSON or query params as Vonage sends | 3 |
| SendGrid Inbound Parse | `multipart/form-data` with `from`, `to`, `subject`, `text`, `html`, `envelope`, attachments | 4 |
| Mailgun routes | form/multipart with `sender`, `recipient`, `body-plain`, `stripped-text`, signature fields | 4 |
| Postmark inbound | JSON (`From`, `To`, `TextBody`, `HtmlBody`, `Attachments`) | 4 |
| Amazon SES via SNS | SNS notification JSON wrapping SES receipt | 4 |
| Bounce / complaint / delivered | SendGrid Event Webhook (`bounce`, `dropped`, `spamreport`, `delivered`), Mailgun (`failed`, `complained`, `delivered`), Postmark (`Bounce`, `SpamComplaint`, `Delivery`), SES via SNS, Resend (`email.bounced`, `email.complained`, `email.delivered`) | 4 |
| Custom template | `minijinja` template with access to the event, variables, random generators and text filters; any content type (see [12-webhook-variables.md](12-webhook-variables.md)) | 3 |

Format fidelity is verified with fixture tests derived from each provider's public docs.

## Signing

### Native: Standard Webhooks

Native deliveries follow the [Standard Webhooks](https://www.standardwebhooks.com/) specification (used by Twilio, Resend, OpenAI, Anthropic, Svix, ngrok and others), instead of a home-grown scheme. Users get official verification libraries in 9 languages (PHP, JS/TS, Python, Go, Java/Kotlin, Rust, Ruby, C#, Elixir) for free.

| Header | Value |
|--------|-------|
| `webhook-id` | the event ID (`evt_01JB...`), identical across retries, used as an idempotency key |
| `webhook-timestamp` | Unix seconds of this attempt |
| `webhook-signature` | `v1,<base64(HMAC-SHA256(secret, "{webhook-id}.{webhook-timestamp}.{body}"))>`; several space-separated signatures during secret rotation |

- Endpoint secrets use the spec's `whsec_<base64>` format; "Regenerate" keeps the old secret valid for a configurable overlap (default 24 h) and signs with both, so rotation can be tested.
- Extra informational headers: `webhook-attempt` (attempt number) and `user-agent: sendmock/<version>`. The event type is in the payload `type` field, as the spec recommends.
- Verification snippets in [08-integrations.md](08-integrations.md#receiving-webhooks-verifying-the-signature).

### Provider formats

Use the provider's own algorithm where documented (Twilio HMAC-SHA1 of URL + sorted params with auth token; Mailgun timestamp/token/signature; SendGrid signed event webhook; Slack signing secret) so production verification code passes unchanged.

## Delivery engine

- Persistent queue in `webhook_deliveries` (survives restart).
- Worker pool with bounded concurrency; per-endpoint ordering is best-effort (not guaranteed), documented as such.
- Response body stored up to 64 KB; larger bodies truncated with a flag.
- Delivery states: `pending`, `render_failed` (template error, not sent), `in_flight`, `succeeded`, `failed` (will retry), `exhausted`, `cancelled`.
- UI shows a live log with status code, duration, attempt number, and a diff-friendly view of request/response.

## Saved deliveries (bookmarks)

Any delivery (or composer request) can be **saved with a name**, e.g. "Twilio STOP reply" or "Postmark inbound with 2 attachments":

- Saved deliveries survive retention pruning and `reset` (they are configuration, not traffic).
- One-click re-send to the same or another endpoint, with optional re-render.
- "Save as template" turns a saved delivery into a custom payload template.
- Exported with the seed file, so a team shares the same fixtures.
- API: `/api/v1/webhooks/saved`; CLI: `sendmock webhook saved list|send`; MCP: `sendmock_webhook_saved_{list,send}`.

## Metrics

A small dashboard (Webhooks > Overview, and the app home page) with: deliveries per endpoint over time, success rate, p50/p95 latency, retries, most common failure codes, plus captured email/SMS/HTTP counts. Computed from the existing tables, no extra infrastructure. API: `/api/v1/stats` (home page) and `/api/v1/webhooks/metrics` (Webhooks > Overview, by range and endpoint).

## Example use cases

1. **Inbound email feature:** rule `email.received` where `to` matches `*@inbound.local` -> `POST http://localhost:8000/webhooks/mail` in Postmark format.
2. **Reply by email:** your app sends a notification with `Reply-To: reply+42@reply.app.test`; click **Reply as recipient**, and the route `match_recipient("reply\+(?P<ticket>.+)@reply.app.test")` -> `forward("http://localhost:8000/webhooks/mail")` posts it in Mailgun format with `stripped-text` holding only the new text.
3. **SMS delivery receipts:** app sends via Twilio-compatible API with `StatusCallback`; SendMock calls it as status changes.
4. **Two-way SMS:** simulate a user texting "YES" to your number; your number's reply webhook receives it in Twilio format, the app answers with TwiML `<Message>`, and the reply appears in the conversation ([04-sms.md](04-sms.md#reply-webhook-twilio-style)).
5. **Open tracking:** rule `email.opened` with `first_open = true` -> `POST http://localhost:8000/webhooks/sendgrid-events` in SendGrid Event Webhook format; open the email in the UI and watch your app record the open.
6. **Mirror everything to another tool:** forward all events as native JSON to a log collector or a team chat bot.
