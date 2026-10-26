# Acceptance: Email (EM)

Plan: [03-email.md](../03-email.md). Rules for IDs, ticking and tests: [README.md](README.md).

## EM-01 SMTP receive

Phase 1. Docs: [SMTP server](../03-email.md#smtp-server).

- [ ] EM-01.1 A message sent with `EHLO`, `MAIL FROM`, `RCPT TO`, `DATA`, `QUIT` to `127.0.0.1:1025` is stored and appears in the UI and `GET /api/v1/emails` within 1 second.
- [ ] EM-01.2 Mail for any recipient and any domain is accepted (catch-all); nothing is relayed anywhere.
- [ ] EM-01.3 `PIPELINING`, `8BITMIME`, `SMTPUTF8` and `SIZE` are advertised and work; a message larger than `--smtp-max-size` is rejected with `552`.
- [ ] EM-01.4 Multiple recipients in one session are stored once with all envelope recipients; envelope recipients missing from `To`/`Cc` are shown as BCC.
- [ ] EM-01.5 Mail from Laravel, Symfony, Nodemailer, Python smtplib, Django, Go net/smtp, Spring, lettre, Rails and MailKit is received correctly (cross-language CI).
- [ ] EM-01.6 Malformed commands get the correct SMTP error code and never crash the server; 500 concurrent sessions are handled without errors.

## EM-02 SMTP TLS and AUTH

Phase 1.

- [ ] EM-02.1 `STARTTLS` works with an auto-generated self-signed certificate on first run, and with a user-provided cert/key.
- [ ] EM-02.2 Implicit TLS works on the optional SMTPS listener.
- [ ] EM-02.3 `AUTH PLAIN`, `LOGIN` and `CRAM-MD5` accept any credentials in `accept-any` mode; with `file:<path>` wrong credentials get `535`; with `none` no AUTH is advertised.
- [ ] EM-02.4 `--smtp-require-tls` rejects `MAIL` before `STARTTLS` with `530`.
- [ ] EM-02.5 The authenticated username is stored on the email and shown in the UI.

## EM-03 Storage, retention and search

Phase 1.

- [ ] EM-03.1 Raw messages are stored zstd-compressed and the downloaded `.eml` is byte-identical to what was received.
- [ ] EM-03.2 With `--max-emails N` the oldest messages are pruned so at most N remain; `--max-age` prunes by age.
- [ ] EM-03.3 `--db memory` keeps nothing on disk.
- [ ] EM-03.4 Full-text search and the filters `from:`, `to:`, `subject:`, `has:attachment`, `is:unread`, `tag:`, `source:` return the correct messages, in under 200 ms with 10,000 stored emails.
- [ ] EM-03.5 Delete one, delete by filter and delete all work from UI, API, CLI and MCP.

## EM-04 Email viewer

UI in U1, live in Phase 1. Docs: [Viewing features](../03-email.md#viewing-features-ui-and-api).

- [x] EM-04.1 HTML renders in a sandboxed iframe with a strict CSP; scripts in the email never run. (UI on mock data; live in Phase 1)
- [x] EM-04.2 Remote images are blocked by default and load after clicking "Load images". (UI on mock data; live in Phase 1)
- [x] EM-04.3 Desktop, tablet and mobile width toggles resize the preview. (UI on mock data; live in Phase 1)
- [x] EM-04.4 Text, Source (highlighted), Headers and Attachments tabs show the correct content; CID inline images display in the HTML view. (UI on mock data; live in Phase 1)
- [ ] EM-04.5 Attachments download with the original filename and bytes; image attachments show thumbnails.
- [ ] EM-04.6 The MIME tab shows the full multipart tree with type, encoding, charset and size per part, and each part can be downloaded.
- [ ] EM-04.7 "Screenshot" saves a PNG of the rendered HTML.
- [ ] EM-04.8 Broken HTML, missing charsets and non-English content (Bangla, Arabic, Japanese) render without errors.

## EM-05 OTP and link extraction

UI in U1, backend Phase 1.

- [ ] EM-05.1 4 to 8 digit codes near words such as "code", "OTP" or "verification" are extracted from text and HTML bodies.
- [ ] EM-05.2 Links (including verification and reset links) are extracted and listed.
- [ ] EM-05.3 Custom OTP patterns from Settings are used for new messages.
- [ ] EM-05.5 The OTP pattern editor flags invalid regular expressions and its tester shows which pattern matched and the extracted code.
- [ ] EM-05.4 The UI shows a copy button per code and link; `GET /api/v1/otp?to=...` and `sendmock otp` return the latest code for that recipient.

## EM-06 sendmail shim

Phase 1.

- [ ] EM-06.1 `sendmock sendmail -t` reads a message from stdin and it is stored like an SMTP message.
- [ ] EM-06.2 PHP `mail()` with `sendmail_path` pointing at the shim delivers to SendMock.
- [ ] EM-06.3 A symlink named `sendmail` behaves the same; `-f` sets the envelope sender.

## EM-07 Native HTTP send API

Phase 1.

- [ ] EM-07.1 `POST /api/v1/send` with from, to, cc, bcc, subject, text, html, attachments and headers stores a message equal to the equivalent SMTP message.
- [ ] EM-07.2 Invalid input returns `400` with a field-level error and is recorded in the HTTP request log.
- [ ] EM-07.3 The stored email shows source `native_api`.
- [ ] EM-07.4 `attachments` with `filename`, base64 `content`, optional `content_type` (guessed from the extension when missing) and optional `content_id` (inline, shown through `cid:`) are stored as attachments of the message.
- [ ] EM-07.5 A missing filename, invalid base64 or attachments over the size limit return `400` naming the attachment.

## EM-08 Email provider HTTP send APIs

Phase 4. Docs: [HTTP send APIs](../03-email.md#http-send-apis).

- [ ] EM-08.1 SendGrid `v3/mail/send`, Mailgun `messages`, Postmark `email` / `batch` / `withTemplate`, Resend `emails` / `batch`, SES v2 and Brevo requests are accepted at the real provider paths on the provider port and under `/providers/<name>/`.
- [ ] EM-08.2 Each returns the provider's success response shape and status code.
- [ ] EM-08.3 Missing required fields and invalid addresses return the provider's error shape and status code.
- [ ] EM-08.4 Template sends store the template ID and data and show them in the Template data tab; a local template registered under the same ID is rendered.
- [ ] EM-08.5 The official SDK for each provider (where one exists) can send to SendMock using the documented redirection recipe.

## EM-09 SMTP session log

UI in U1, backend Phase 1.

- [ ] EM-09.1 Every SMTP session, including failed ones, is listed with client, EHLO name, TLS, AUTH user, result and duration.
- [ ] EM-09.2 The transcript shows every command and reply; AUTH passwords are masked; DATA content is linked, not duplicated.
- [ ] EM-09.3 Each stored email links to its session.
- [ ] EM-09.4 Failed sessions are highlighted with their reason, and the transcript viewer tells commands from replies and colours reply codes by class.
- [ ] EM-09.5 The session list loads 50 rows at a time and loads more on scroll, so it stays fast with thousands of sessions.

## EM-10 Delivery outcome simulation

Native events Phase 3, provider formats Phase 4. Docs: [Delivery outcome simulation](../03-email.md#delivery-outcome-simulation).

- [ ] EM-10.1 Sending to each SES mailbox simulator address and each SendMock alias (`delivered@`, `bounce@`, `bounce+soft@`, `complaint@`, ...) produces the documented events.
- [ ] EM-10.2 Delivery profiles `off`, `auto-delivered` and `realistic` behave as documented.
- [ ] EM-10.3 Manual "Simulate" actions fire the chosen event; the API and CLI do the same.
- [ ] EM-10.4 Events appear on the email timeline and are delivered by matching webhook rules in native and provider formats.
- [ ] EM-10.5 Custom outcome addresses can be created, edited, reordered, switched off and deleted from Settings, the API, CLI, MCP and the seed file; the first enabled match wins over the magic addresses.
- [ ] EM-10.6 With the Magic addresses switch off, magic addresses behave like any other address; "Test an address" shows which rule, magic address or profile applies.

## EM-11 Email opened events

Phase 3. Docs: [Opened events](../05-webhooks.md#opened-events).

- [ ] EM-11.1 Opening an email detail in the UI fires `email.opened` once with `first_open: true` (default setting).
- [ ] EM-11.2 With "every open", re-opens fire with `first_open: false` and an incremented `open_count`.
- [ ] EM-11.3 "Simulate open" and `POST /emails/{emailId}/open` always fire.
- [ ] EM-11.4 With auto-fire turned off, viewing does not fire; manual and API opens still do.
- [ ] EM-11.5 Mark unread does not reset `open_count` or `opened_at`.

## EM-12 Tags

Phase 1 (X-Tags, plus addressing), Phase 4 (tag rules).

- [ ] EM-12.1 `X-Tags` header values become tags.
- [ ] EM-12.2 With plus addressing on, `user+invoice@x.test` gets tag `invoice`.
- [ ] EM-12.3 Tag rules add tags to matching new messages.
- [ ] EM-12.4 Manual tags can be added and removed from UI, API, CLI and MCP.

## EM-13 Quality checks

Phase 1 (List-Unsubscribe), Phase 4 (HTML, link, spam).

- [ ] EM-13.1 The HTML check reports per-client support for the CSS/HTML used and points at the offending source lines.
- [ ] EM-13.2 The link check reports status, redirects and timeouts for every link and image, and runs only when requested.
- [ ] EM-13.3 With `--spamassassin` configured, the spam score and rules are shown; without it the tab is hidden.
- [ ] EM-13.4 Invalid `List-Unsubscribe` / `List-Unsubscribe-Post` headers produce warnings.

## EM-14 Release and auto-forward

Phase 4. Docs: [Release and forwarding](../03-email.md#release-and-forwarding-to-real-smtp).

- [ ] EM-14.1 Release and auto-forward are impossible until a relay and a recipient allowlist are configured.
- [ ] EM-14.2 Release sends the message through the relay to the original or chosen recipients; recipients outside the allowlist are refused.
- [ ] EM-14.3 Auto-forward rules forward matching messages automatically.
- [ ] EM-14.4 Every release and forward is logged on the email timeline with its result and fires `email.released`.

## EM-15 SMTP chaos

Phase 4.

- [ ] EM-15.1 "Reject next N" returns the chosen code for exactly N messages.
- [ ] EM-15.2 Recipient patterns are rejected with `550`.
- [ ] EM-15.3 Command latency and dropped connections mid-DATA happen as configured, and clients see the failure.

## EM-16 Browser notifications

UI in U1, live in Phase 1.

- [ ] EM-16.1 After the user grants permission, a notification appears for each new email (respecting the optional filter).
- [x] EM-16.2 Nothing is requested or shown until the user turns notifications on. (UI on mock data; live in Phase 1)

## EM-17 Simulated replies and inbound email

UI in U1, backend Phase 4. Docs: [Email replies and inbound routes](../05-webhooks.md#email-replies-and-inbound-routes-mailgun-style).

- [ ] EM-17.1 "Reply as recipient" and `POST /api/v1/emails/{emailId}/reply` create an inbound email to the original `Reply-To` (or `From`), from the original recipient, with a `Re:` subject, `In-Reply-To` and `References` from the original `Message-ID`, and the original text quoted.
- [ ] EM-17.2 `POST /api/v1/emails/inbound` (fields or raw MIME) and SMTP mail for a configured inbound domain create inbound emails.
- [ ] EM-17.3 Inbound emails fire `email.inbound`, never `email.received`, and show an Inbound badge and a "Reply to" or "Forward of" link to the original.
- [ ] EM-17.4 "Forward" and `POST /api/v1/emails/{emailId}/forward` create an inbound email to the given address with a `Fwd:` subject, the original below a forwarded-message block, and the original attachments unless turned off; "Reply all" adds the other original recipients in `Cc`.
- [ ] EM-17.5 The original email lists its replies and forwards as links and its timeline shows them; replying to or forwarding an incoming email is not offered in the UI and returns `409` from the API.

## EM-18 Configurable email providers

UI in U3 (W16), runtime in Phase 4. Plan: [22-configurable-providers.md](../22-configurable-providers.md).

- [x] EM-18.1 Mail > Providers lists every email provider, built-in and custom, with its key, whether it is built in, Modified, enabled and messages in the last 24 hours; removed built-ins are listed in a Removed group. (UI and mock API; the live runtime in Phase 4)
- [x] EM-18.2 A provider can be added from blank or from a built-in (whose definition is copied) and edited: name, key, host, accent, enabled, credentials (secrets masked) and Check credentials, operations (send, send batch, send with template, fetch one) with method, path template and request format, the field mapping, validation rules, success and error responses, the message id template, the callback template and status names. (UI and mock API; the live runtime in Phase 4)
- [x] EM-18.3 An edited built-in shows Modified and Reset to default restores it after confirming; Remove takes a built-in out of routing, pickers and Settings > Connection and Restore brings it back unchanged; a custom provider can be deleted, and the messages it caught keep its name and show "deleted provider". (UI and mock API; the live runtime in Phase 4)
- [x] EM-18.4 The preview runs a sample request through the definition and shows the message SendMock would store and the response it would return, with problems under each part; a save with template errors, an invalid path template, a duplicate key or a path that clashes with another enabled provider is refused with the reason. (UI and mock API; the live runtime in Phase 4)
- [ ] EM-18.5 Requests at a provider's paths, on the provider port and under `/providers/<key>/`, are answered from its current definition, so a change applies to the next request; a custom provider's sends appear in Mail with its name, and a removed provider's paths answer SendMock's native `404`.
- [ ] EM-18.6 REST, CLI and MCP list, get, create, update, delete or remove, restore, reset and preview email providers with the same validation as the UI; secrets are masked in every answer, the CLI and UI reveal one after a confirmation, and MCP never reveals them; the skill's `add-email-provider` workflow takes an agent from the provider's API docs to a working provider (definition, preview, test send, seed export).
- [x] EM-18.7 The seed file exports changed built-ins and custom providers under `[[email.providers]]` with secrets as `${ENV}` references, and applying it recreates them. (UI and mock API; the live runtime in Phase 4)
- [ ] EM-18.8 The shipped built-ins pass the existing provider fixture and SDK tests (EM-08) unchanged, so the defaults still match the real providers.
