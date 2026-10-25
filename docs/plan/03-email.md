# 03. Email (SMTP)

## Behaviour

SendMock is a **catch-all, receive-only** mail sink. It accepts mail for any recipient and any domain, stores it, and never delivers it anywhere (unless release/forwarding is explicitly configured).

Apps can hand mail to SendMock in two ways:

1. **SMTP** (classic mailers, frameworks, `sendmail`).
2. **Email provider HTTP APIs** (SendGrid, Mailgun, Postmark, Resend, SES, Brevo, ...), because many modern apps never use SMTP. See [HTTP send APIs](#http-send-apis).

Both paths produce the same stored message and the same `email.received` event.

## SMTP server

Custom async implementation on tokio. A full MTA library is unnecessary: we only need the receiving side, and owning it keeps the binary small and lets us add chaos/testing features.

### Supported commands and extensions

| Item | Status |
|------|--------|
| `HELO`, `EHLO` | v1 |
| `MAIL FROM`, `RCPT TO`, `DATA`, `RSET`, `NOOP`, `QUIT`, `VRFY` (always 252) | v1 |
| `PIPELINING`, `8BITMIME`, `SMTPUTF8`, `SIZE` | v1 |
| `STARTTLS` | v1 (self-signed cert generated on first run, or user-provided cert/key) |
| Implicit TLS (SMTPS, port 465 style) | v1, optional listener |
| `AUTH PLAIN`, `AUTH LOGIN`, `AUTH CRAM-MD5` | v1, accept any credentials by default |
| `BDAT` / `CHUNKING` | later |

### Options

| Flag | Env | Default | Meaning |
|------|-----|---------|---------|
| `--smtp-addr` | `SENDMOCK_SMTP_ADDR` | `127.0.0.1:1025` | listen address |
| `--smtp-max-size` | `SENDMOCK_SMTP_MAX_SIZE` | `25MB` | reject larger messages with 552 |
| `--smtp-auth` | `SENDMOCK_SMTP_AUTH` | `accept-any` | `accept-any`, `none` (advertise no AUTH), `file:<path>` |
| `--smtp-tls-cert`, `--smtp-tls-key` | | auto | custom certificate |
| `--smtp-require-tls` | | off | refuse `MAIL` before `STARTTLS` |
| `--smtp-allow-rcpt` | | `*` | glob list; others get 550 (useful to test bounce handling) |

### SMTP session log

Every SMTP connection is recorded so developers can see *why* a client fails (TLS handshake, AUTH mechanism, rejected recipient, size limit), not only the messages that succeeded:

- Full command/response transcript per session (client IP, EHLO name, TLS version and cipher, AUTH mechanism and username, every command and reply code, timings).
- `DATA` content is not duplicated in the transcript (it links to the stored email); AUTH passwords are masked.
- Failed sessions (no message stored) are kept too, with the failure reason highlighted.
- Stored in `smtp_sessions` (transcript capped at 256 KB), same retention rules as emails.
- UI: **Logs > SMTP** list and transcript viewer; each email links to the session that delivered it. API: `/api/v1/logs/smtp`.

### Chaos / failure simulation (Phase 4+)

Toggled from the UI or API, so developers can test error handling:

- Reject next N messages with a chosen code (`421`, `450`, `550`, `552`).
- Reject specific recipients (pattern) with `550 No such user`.
- Add artificial latency per command.
- Drop connection mid-`DATA`.

## HTTP send APIs

Apps using an email provider's HTTP API point the SDK (or base URL) at SendMock instead of the provider. SendMock validates the request like the provider, builds a standard MIME message from it (so every viewer, extractor and webhook works the same), stores the original JSON request alongside, and returns the provider's response shape.

| API | Endpoint emulated | Notes | Phase |
|-----|-------------------|-------|-------|
| Native | `POST /api/v1/send` | simple JSON (`from`, `to`, `cc`, `bcc`, `subject`, `text`, `html`, `attachments` base64, `headers`, `tags`); Mailpit-compatible shape where practical | 1 |
| SendGrid | `POST /v3/mail/send` | `personalizations`, `content`, `attachments`, dynamic template IDs stored as metadata; returns `202` with `X-Message-Id` | 4 |
| Mailgun | `POST /v3/{domain}/messages` | multipart/form, `o:tag`, `h:` headers, `v:` variables | 4 |
| Postmark | `POST /email`, `POST /email/batch`, `POST /email/withTemplate` | `X-Postmark-Server-Token` accepted; `MessageStream` stored | 4 |
| Resend | `POST /emails`, `POST /emails/batch` | returns `{ "id": ... }`; idempotency key header honoured | 4 |
| Amazon SES v2 | `POST /v2/email/outbound-emails` | simple and raw content; SigV4 accepted without verification | 4 |
| Brevo | `POST /v3/smtp/email` | `api-key` header | 4 |

### Native send attachments

`attachments` on `POST /api/v1/send` uses the shape SendGrid and Resend use, so it feels familiar:

```json
"attachments": [
  { "filename": "invoice.pdf", "content": "JVBERi0xLjQK...", "content_type": "application/pdf" },
  { "filename": "logo.png", "content": "iVBORw0KGgo...", "content_type": "image/png", "content_id": "logo" }
]
```

| Field | Required | Meaning |
|-------|----------|---------|
| `filename` | yes | name shown and used for downloads |
| `content` | yes | the file bytes, base64 encoded (standard alphabet, padding optional, line breaks ignored) |
| `content_type` | no | MIME type; guessed from the file extension when missing (`application/octet-stream` as the last resort) |
| `content_id` | no | makes the attachment inline, so the HTML can show it with `cid:<content_id>` |

- The stored message is built as real MIME (`multipart/mixed`, with `multipart/related` for inline parts), so it equals the same message sent over SMTP.
- Limits: the decoded attachments count towards the 25 MB message size limit.
- Errors return `400` naming the attachment, for example `attachments[1].content is not valid base64` or `attachments[0].filename is required`, and are recorded in the request log.

Provider routes are served on the dedicated provider port at the real provider paths (same mechanism as SMS, see [04-sms.md](04-sms.md#api-surfaces)) and under `/providers/<name>/...` on the main port. Each provider's API key/token is accepted by default and can be enforced to test auth errors.

Template sends (SendGrid dynamic templates, Postmark templates, Resend templates) cannot be rendered without the provider's template content: SendMock stores the template ID and `dynamic_template_data`/`TemplateModel`, shows them in a "Template data" panel, and optionally renders a local template registered under the same ID (`sendmock.seed.toml`, see [02-architecture.md](02-architecture.md#configuration-and-seed-file)).

Rejected requests (missing `from`, invalid address, auth failure) are recorded in the HTTP request log (**Logs > HTTP**) with the exact error response returned.

## Delivery outcome simulation

Real providers report what happened after sending: delivered, bounced, complained (marked as spam). Apps need to handle those callbacks (suppress addresses, show "email bounced" in the UI). SendMock simulates them as events:

| Event | Meaning |
|-------|---------|
| `email.delivered` | provider accepted delivery to the mailbox |
| `email.deferred` | temporary failure (soft bounce in progress) |
| `email.bounced` | hard or soft bounce, with `bounce_type`, SMTP code and diagnostic text |
| `email.complained` | recipient marked the email as spam |
| `email.unsubscribed` | recipient used `List-Unsubscribe` (one-click) |

Triggered by:

- **Magic recipient addresses** (compatible with the Amazon SES mailbox simulator, plus SendMock aliases on any domain):

| Recipient | Outcome |
|-----------|---------|
| `success@simulator.amazonses.com`, `delivered@<any>` | `email.delivered` |
| `bounce@simulator.amazonses.com`, `bounce@<any>`, `bounce+hard@<any>` | hard bounce (`550 5.1.1 user unknown`) |
| `bounce+soft@<any>` | `email.deferred`, then soft bounce after retries |
| `complaint@simulator.amazonses.com`, `complaint@<any>` | delivered, then `email.complained` |
| `ooto@simulator.amazonses.com` | delivered, then out-of-office auto-reply stored as a new email |
| `suppressionlist@simulator.amazonses.com` | bounce with suppression-list reason |

- **Delivery profile** (Settings): `off` (default, no delivery events), `auto-delivered` (every message gets `email.delivered` after a short delay), or `realistic` (delay plus a configurable bounce/complaint rate).
- **Manual buttons** on any email: Simulate delivered / bounce (hard, soft) / complaint / unsubscribe.
- **API**: `POST /api/v1/emails/{emailId}/simulate` with `{ "event": "bounced", "bounce_type": "hard" }`.

Each event flows through webhook rules in native or provider format (SendGrid Event Webhook, Mailgun events, Postmark Bounce/SpamComplaint/Delivery, SES via SNS, Resend), see [13-webhook-templates.md](13-webhook-templates.md). The email detail shows a delivery timeline (received, delivered, opened, bounced...).

## Parsing and storage

1. Session collects envelope (`MAIL FROM`, `RCPT TO` list) and raw `DATA` bytes.
2. `mail-parser` extracts headers, text/HTML bodies, attachments, inline (CID) images.
3. Indexed fields go into the `emails` row; raw bytes are zstd-compressed into `raw`.
4. **BCC detection:** envelope recipients not present in `To`/`Cc` headers are shown as BCC.
5. **Extractors** run on ingest and store results for quick UI/API access:
   - OTP/verification codes (configurable regex list; default 4-8 digit codes near words like "code", "OTP", "verification").
   - Links (especially verification/reset links).
6. Publish `email.received` on the event bus.

## Viewing features (UI and API)

- HTML preview (sandboxed), plain text, raw source, headers table.
- Attachments: list, download, inline image rendering via CID rewriting.
- Responsive preview: desktop / tablet / mobile widths.
- Browser notifications for new emails (opt-in, per-tab permission), with optional filter (e.g. only `to:*@my-feature.test`).
- Remote images blocked by default, one-click load.
- Download `.eml`.
- Search: full-text plus filters (`from:`, `to:`, `subject:`, `has:attachment`, `is:unread`, `tag:`).
- Tags: from `X-Tags` header (Mailpit compatible), manual, or automatic:
  - **Plus addressing:** `user+invoice@app.test` gets tag `invoice` (toggle in Settings).
  - **Tag rules:** filter-based rules (same filter builder as webhook rules) that add tags on arrival, e.g. "subject contains Invoice -> tag billing".
- Attachment and inline image **thumbnails** in the attachments list.
- **MIME tree inspector:** collapsible view of the multipart structure (content types, encodings, charsets, sizes, Content-ID, disposition) with per-part download.
- **Screenshot:** render the HTML preview to a PNG for sharing (client-side, via the sandboxed iframe).
- **List-Unsubscribe check:** validates `List-Unsubscribe` and `List-Unsubscribe-Post` syntax (RFC 2369 / RFC 8058 one-click) and shows warnings.

## Quality checks

Promoted to v1 because every established competitor (Mailpit, Mailtrap, smtp4dev) treats them as core:

- **HTML compatibility check:** scores the HTML/CSS against email client support data (caniemail.com dataset, embedded at build time; licence to be confirmed). Shows per-client support percentages and highlights the offending lines in the source.
- **Link check:** on demand, sends `HEAD`/`GET` to every link and image URL in the message and reports status codes, redirects and timeouts. Opt-in per run (it makes outbound network calls), with a configurable timeout and concurrency.
- **Spam check (optional):** when `--spamassassin host:port` is configured, sends the raw message to a running SpamAssassin (`spamd`) and shows the score and triggered rules. Hidden when not configured.

Each check is a tab in the email detail and an API endpoint (`/emails/{emailId}/html-check`, `/link-check`, `/spam-check`), so tests and AI agents can assert on them.

## `sendmail` shim

Some stacks (PHP `mail()`, cron, legacy apps) call a local `sendmail` binary instead of SMTP. The same binary provides:

```
sendmock sendmail [-t] [-f from] [recipients...]
```

It reads the message from stdin and submits it to the running `sendmock` SMTP listener (configurable with `--smtp-addr`). Example `php.ini`:

```ini
sendmail_path = "/usr/local/bin/sendmock sendmail -t"
```

On Unix, a symlink named `sendmail` pointing to `sendmock` should also work (detect `argv[0]`).

## Release and forwarding to real SMTP

For final checks in real mail clients (Gmail, Outlook, Apple Mail):

- **Release (manual):** "Release" button on an email (or `POST /api/v1/emails/{emailId}/release`) sends it through a configured relay SMTP server to the original or a chosen recipient.
- **Auto-forward:** rules (same filter builder) that automatically forward matching messages to fixed real addresses, e.g. "everything to `*@qa.app.test` -> `qa-team@company.com`".
- **Relay config:** `--relay-smtp smtp://user:pass@smtp.example.com:587` or Settings; STARTTLS/implicit TLS; optional `Return-Path` override.
- **Safety:** off by default; a recipient allowlist (glob patterns) is required before anything can be sent out; every release/forward is logged with result and visible in the email timeline.

## Replies and inbound email

Phase 4. SendMock can also simulate mail coming **in** to your app: a recipient replying to or forwarding an email your app sent (**Reply**, **Reply all** and **Forward** in the email detail, or `POST /api/v1/emails/{emailId}/reply` and `/forward`), any incoming email through `POST /api/v1/emails/inbound`, or SMTP mail for a configured inbound domain. Incoming emails are stored with `direction: inbound`, fire `email.inbound`, and are delivered to your app by inbound routes that work like Mailgun Routes (`match_recipient`, `forward`, `store`, `stop`, the Mailgun form fields and signature, and the `/v3/routes` API). Details in [05-webhooks.md](05-webhooks.md#email-replies-and-inbound-routes-mailgun-style).

## Optional: POP3 (later)

Read-only POP3 listener so desktop mail clients can view captured mail. Low priority.
