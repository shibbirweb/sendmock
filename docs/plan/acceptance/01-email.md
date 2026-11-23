# Acceptance: Email (EM)

Plan: [03-email.md](../03-email.md). Rules for IDs, ticking and tests: [README.md](README.md).

## EM-01 SMTP receive

Phase 1. Docs: [SMTP server](../03-email.md#smtp-server).

- [x] EM-01.1 A message sent with `EHLO`, `MAIL FROM`, `RCPT TO`, `DATA`, `QUIT` to `127.0.0.1:1025` is stored and appears in the UI and `GET /api/v1/emails` within 1 second. (#48)
- [x] EM-01.2 Mail for any recipient and any domain is accepted (catch-all); nothing is relayed anywhere. (#48)
- [x] EM-01.3 `PIPELINING`, `8BITMIME`, `SMTPUTF8` and `SIZE` are advertised and work; a message larger than `--smtp-max-size` is rejected with `552`. (#48)
- [x] EM-01.4 Multiple recipients in one session are stored once with all envelope recipients; envelope recipients missing from `To`/`Cc` are shown as BCC. (#48)
- [x] EM-01.5 Mail from Laravel, Symfony, Nodemailer, Python smtplib, Django, Go net/smtp, Spring, lettre, Rails and MailKit is received correctly (cross-language CI). (#48)
- [x] EM-01.6 Malformed commands get the correct SMTP error code and never crash the server; 500 concurrent sessions are handled without errors. (#48)

## EM-02 SMTP TLS and AUTH

Phase 1.

- [x] EM-02.1 `STARTTLS` works with an auto-generated self-signed certificate on first run, and with a user-provided cert/key. (#48)
- [x] EM-02.2 Implicit TLS works on the optional SMTPS listener. (#48)
- [x] EM-02.3 `AUTH PLAIN`, `LOGIN` and `CRAM-MD5` accept any credentials in `accept-any` mode; with `file:<path>` wrong credentials get `535`; with `none` no AUTH is advertised. (#48)
- [x] EM-02.4 `--smtp-require-tls` rejects `MAIL` before `STARTTLS` with `530`. (#48)
- [x] EM-02.5 The authenticated username is stored on the email and shown in the UI. (#48)

## EM-03 Storage, retention and search

Phase 1.

- [x] EM-03.1 Raw messages are stored zstd-compressed and the downloaded `.eml` is byte-identical to what was received. (#48)
- [x] EM-03.2 With `--max-emails N` the oldest messages are pruned so at most N remain; `--max-age` prunes by age. (#48)
- [x] EM-03.3 `--db memory` keeps nothing on disk. (#48)
- [x] EM-03.4 Full-text search and the filters `from:`, `to:`, `subject:`, `has:attachment`, `is:unread`, `tag:`, `source:` return the correct messages, in under 200 ms with 10,000 stored emails. (#48)
- [x] EM-03.5 Delete one, delete by filter and delete all work from UI, API, CLI and MCP. (#48)

## EM-04 Email viewer

UI in U1, live in Phase 1. Docs: [Viewing features](../03-email.md#viewing-features-ui-and-api).

- [x] EM-04.1 HTML renders in a sandboxed iframe with a strict CSP; scripts in the email never run. (UI on mock data; live in Phase 1)
- [x] EM-04.2 Remote images are blocked by default and load after clicking "Load images". (UI on mock data; live in Phase 1)
- [x] EM-04.3 Desktop, tablet and mobile width toggles resize the preview. (UI on mock data; live in Phase 1)
- [x] EM-04.4 Text, Source (highlighted), Headers and Attachments tabs show the correct content; CID inline images display in the HTML view. (UI on mock data; live in Phase 1)
- [x] EM-04.5 Attachments download with the original filename and bytes; image attachments show thumbnails. (#48)
- [x] EM-04.6 The MIME tab shows the full multipart tree with type, encoding, charset and size per part, and each part can be downloaded. (#48)
- [x] EM-04.7 "Screenshot" saves a PNG of the rendered HTML. (#48)
- [x] EM-04.8 Broken HTML, missing charsets and non-English content (Bangla, Arabic, Japanese) render without errors. (#48)
- [x] EM-04.9 The HTML and Text views list the email's attachments under the message, each with its name, size, an inline mark for inline parts and a download link; an email without attachments shows no list. (owner request, 2026-11-20)

## EM-05 OTP and link extraction

UI in U1, backend Phase 1.

- [x] EM-05.1 4 to 8 digit codes near words such as "code", "OTP" or "verification" are extracted from text and HTML bodies. (#48)
- [x] EM-05.2 Links (including verification and reset links) are extracted and listed. (#48)
- [x] EM-05.3 Custom OTP patterns from Settings are used for new messages. (#48)
- [x] EM-05.5 The OTP pattern editor flags invalid regular expressions and its tester shows which pattern matched and the extracted code. (#48)
- [x] EM-05.4 The UI shows a copy button per code and link; `GET /api/v1/otp?to=...` and `sendmock otp` return the latest code for that recipient. (#48)
- [x] EM-05.6 A code followed by `is your`, up to three words and a word for a code (`909582 is your App login code`) is extracted from SMS bodies and from email subjects and bodies; a number followed by other words is still not a code. (Added 2026-11-22 with the fix for #316.)

## EM-06 sendmail shim

Phase 1.

- [x] EM-06.1 `sendmock sendmail -t` reads a message from stdin and it is stored like an SMTP message. (#48)
- [x] EM-06.2 PHP `mail()` with `sendmail_path` pointing at the shim delivers to SendMock. (#48)
- [x] EM-06.3 A symlink named `sendmail` behaves the same; `-f` sets the envelope sender. (#48)

## EM-07 Native HTTP send API

Phase 1.

- [x] EM-07.1 `POST /api/v1/send` with from, to, cc, bcc, subject, text, html, attachments and headers stores a message equal to the equivalent SMTP message. (#48)
- [x] EM-07.2 Invalid input returns `400` with a field-level error and is recorded in the HTTP request log. (#48)
- [x] EM-07.3 The stored email shows source `native_api`. (#48)
- [x] EM-07.4 `attachments` with `filename`, base64 `content`, optional `content_type` (guessed from the extension when missing) and optional `content_id` (inline, shown through `cid:`) are stored as attachments of the message. (#48)
- [x] EM-07.5 A missing filename, invalid base64 or attachments over the size limit return `400` naming the attachment. (#48)

## EM-08 Email provider HTTP send APIs

Phase 4. Docs: [HTTP send APIs](../03-email.md#http-send-apis).

- [x] EM-08.1 SendGrid `v3/mail/send`, Mailgun `messages`, Postmark `email` / `batch` / `withTemplate`, Resend `emails` / `batch`, SES v2 and Brevo requests are accepted at the real provider paths on the provider port and under `/providers/<name>/`.
- [x] EM-08.2 Each returns the provider's success response shape and status code.
- [x] EM-08.3 Missing required fields and invalid addresses return the provider's error shape and status code.
- [x] EM-08.4 Template sends store the template ID and data and show them in the Template data tab; a local template registered under the same ID is rendered.
- [x] EM-08.5 The official SDK for each provider (where one exists) can send to SendMock using the documented redirection recipe.

## EM-09 SMTP session log

UI in U1, backend Phase 1.

- [x] EM-09.1 Every SMTP session, including failed ones, is listed with client, EHLO name, TLS, AUTH user, result and duration. (#48)
- [x] EM-09.2 The transcript shows every command and reply; AUTH passwords are masked; DATA content is linked, not duplicated. (#48)
- [x] EM-09.3 Each stored email links to its session. (#48)
- [x] EM-09.4 Failed sessions are highlighted with their reason, and the transcript viewer tells commands from replies and colours reply codes by class. (#48)
- [x] EM-09.5 The session list loads 50 rows at a time and loads more on scroll, so it stays fast with thousands of sessions. (#48)

## EM-10 Delivery outcome simulation

Native events Phase 3, provider formats Phase 4. Docs: [Delivery outcome simulation](../03-email.md#delivery-outcome-simulation).

- [x] EM-10.1 Sending to each SES mailbox simulator address and each SendMock alias (`delivered@`, `bounce@`, `bounce+soft@`, `complaint@`, ...) produces the documented events.
- [x] EM-10.2 Delivery profiles `off`, `auto-delivered` and `realistic` behave as documented.
- [x] EM-10.3 Manual "Simulate" actions fire the chosen event; the API and CLI do the same.
- [x] EM-10.4 Events appear on the email timeline and are delivered by matching webhook rules in native and provider formats.
- [x] EM-10.5 Custom outcome addresses can be created, edited, reordered, switched off and deleted from Settings, the API, CLI, MCP and the seed file; the first enabled match wins over the magic addresses.
- [x] EM-10.6 With the Magic addresses switch off, magic addresses behave like any other address; "Test an address" shows which rule, magic address or profile applies.

## EM-11 Email opened events

Phase 3. Docs: [Opened events](../05-webhooks.md#opened-events).

- [x] EM-11.1 Opening an email detail in the UI fires `email.opened` once with `first_open: true` (default setting).
- [x] EM-11.2 With "every open", re-opens fire with `first_open: false` and an incremented `open_count`.
- [x] EM-11.3 "Simulate open" and `POST /emails/{emailId}/open` always fire.
- [x] EM-11.4 With auto-fire turned off, viewing does not fire; manual and API opens still do.
- [x] EM-11.5 Mark unread does not reset `open_count` or `opened_at`.

## EM-12 Tags

Phase 1 (X-Tags, plus addressing), Phase 4 (tag rules).

- [x] EM-12.1 `X-Tags` header values become tags. (#48)
- [x] EM-12.2 With plus addressing on, `user+invoice@x.test` gets tag `invoice`. (#48)
- [x] EM-12.3 Tag rules add tags to matching new messages. (#48)
- [x] EM-12.4 Manual tags can be added and removed from UI, API, CLI and MCP. (#48)

## EM-13 Quality checks

Phase 1 (List-Unsubscribe), Phase 4 (HTML, link, spam).

- [x] EM-13.1 The HTML check reports per-client support for the CSS/HTML used and points at the offending source lines. (#48)
- [x] EM-13.2 The link check reports status, redirects and timeouts for every link and image, and runs only when requested. (#48)
- [x] EM-13.3 With `--spamassassin` configured, the spam score and rules are shown; without it the tab is hidden. (#48)
- [x] EM-13.4 Invalid `List-Unsubscribe` / `List-Unsubscribe-Post` headers produce warnings. (#48)

## EM-14 Release and auto-forward

Phase 4. Docs: [Release and forwarding](../03-email.md#release-and-forwarding-to-real-smtp).

- [x] EM-14.1 Release and auto-forward are impossible until a relay and a recipient allowlist are configured. (#48)
- [x] EM-14.2 Release sends the message through the relay to the original or chosen recipients; recipients outside the allowlist are refused. (#48)
- [x] EM-14.3 Auto-forward rules forward matching messages automatically. (#48)
- [x] EM-14.4 Every release and forward is logged on the email timeline with its result and fires `email.released`. (#48)

## EM-15 SMTP chaos

Phase 4.

- [x] EM-15.1 "Reject next N" returns the chosen code for exactly N messages. (#48)
- [x] EM-15.2 Recipient patterns are rejected with `550`. (#48)
- [x] EM-15.3 Command latency and dropped connections mid-DATA happen as configured, and clients see the failure. (#48)

## EM-16 Browser notifications

UI in U1, live in Phase 1.

- [x] EM-16.1 After the user grants permission, a notification appears for each new email (respecting the optional filter). (#48)
- [x] EM-16.2 Nothing is requested or shown until the user turns notifications on. (UI on mock data; live in Phase 1)

## EM-17 Simulated replies and inbound email

UI in U1, backend Phase 4. Docs: [Email replies and inbound routes](../05-webhooks.md#email-replies-and-inbound-routes-mailgun-style).

- [x] EM-17.1 "Reply as recipient" and `POST /api/v1/emails/{emailId}/reply` create an inbound email to the original `Reply-To` (or `From`), from the original recipient, with a `Re:` subject, `In-Reply-To` and `References` from the original `Message-ID`, and the original text quoted. (#48)
- [x] EM-17.2 `POST /api/v1/emails/inbound` (fields or raw MIME) and SMTP mail for a configured inbound domain create inbound emails. (#48)
- [x] EM-17.3 Inbound emails fire `email.inbound`, never `email.received`, and show an Inbound badge and a "Reply to" or "Forward of" link to the original. (#48)
- [x] EM-17.4 "Forward" and `POST /api/v1/emails/{emailId}/forward` create an inbound email to the given address with a `Fwd:` subject, the original below a forwarded-message block, and the original attachments unless turned off; "Reply all" adds the other original recipients in `Cc`. (#48)
- [x] EM-17.5 The original email lists its replies and forwards as links and its timeline shows them; replying to or forwarding an incoming email is not offered in the UI and returns `409` from the API. (#48)

## EM-18 Configurable email providers

UI in U3 (W16), runtime in Phase 4. Plan: [22-configurable-providers.md](../22-configurable-providers.md).

- [x] EM-18.1 Mail > Providers lists every email provider, built-in and custom, with its key, whether it is built in, Modified, enabled and messages in the last 24 hours; removed built-ins are listed in a Removed group. (UI and mock API; the live runtime in Phase 4)
- [x] EM-18.2 A provider can be added from blank or from a built-in (whose definition is copied) and edited: name, key, host, accent, enabled, credentials (secrets masked) and Check credentials, operations (send, send batch, send with template, fetch one) with method, path template and request format, the field mapping, validation rules, success and error responses, the message id template, the callback template and status names. (UI and mock API; the live runtime in Phase 4)
- [x] EM-18.3 An edited built-in shows Modified and Reset to default restores it after confirming; Remove takes a built-in out of routing, pickers and Settings > Connection and Restore brings it back unchanged; a custom provider can be deleted, and the messages it caught keep its name and show "deleted provider". (UI and mock API; the live runtime in Phase 4)
- [x] EM-18.4 The preview runs a sample request through the definition and shows the message SendMock would store and the response it would return, with problems under each part; a save with template errors, an invalid path template, a duplicate key or a path that clashes with another enabled provider is refused with the reason. (UI and mock API; the live runtime in Phase 4)
- [x] EM-18.5 Requests at a provider's paths, on the provider port and under `/providers/<key>/`, are answered from its current definition, so a change applies to the next request; a custom provider's sends appear in Mail with its name, and a removed provider's paths answer SendMock's native `404`.
- [x] EM-18.6 REST, CLI and MCP list, get, create, update, delete or remove, restore, reset and preview email providers with the same validation as the UI; secrets are masked in every answer, the CLI and UI reveal one after a confirmation, and MCP never reveals them; the skill's `add-email-provider` workflow takes an agent from the provider's API docs to a working provider (definition, preview, test send, seed export).
- [x] EM-18.7 The seed file exports changed built-ins and custom providers under `[[email.providers]]` with secrets as `${ENV}` references, and applying it recreates them. (UI and mock API; the live runtime in Phase 4)
- [x] EM-18.8 The shipped built-ins pass the existing provider fixture and SDK tests (EM-08) unchanged, so the defaults still match the real providers. (#48)

## EM-19 Mailpit API compatibility

0.1.0-beta.1 (planned as After 1.0), built on `feat/phase-0` by owner decision (2026-11-07). Plan: [32-after-1-0.md](../32-after-1-0.md#a1-mailpit-api-compatibility-em-19).

- [x] EM-19.1 `GET /api/v1/messages` and `GET /api/v1/search` answer Mailpit's `MessagesSummary` (`total`, `unread`, `messages_count`, `messages_unread`, `start`, `tags`, `messages`), newest first, with `start` and `limit`; search reads Mailpit's `from:`, `to:`, `subject:`, `tag:`, `is:read`, `is:unread` and `has:attachment` filters and plain words. (#48)
- [x] EM-19.2 `GET /api/v1/message/{ID}` (and `latest`) answers Mailpit's `Message` and marks the message read; `/headers`, `/raw`, `/part/{PartID}`, `/view/{ID}.html` and `/view/{ID}.txt` answer as Mailpit does, and a missing message or part answers 404 with a plain text body. (#48)
- [x] EM-19.3 `PUT /api/v1/messages` sets read or unread by IDs, by search or for every message; `DELETE /api/v1/messages` deletes by IDs or every message; `DELETE /api/v1/search` deletes the matches; each answers `ok`. (#48)
- [x] EM-19.4 `GET /api/v1/tags` lists every tag and `PUT /api/v1/tags` replaces the tags of the given messages. (#48)
- [x] EM-19.5 Every answer above matches the definitions in Mailpit's own API definition (`swagger.json` at `v1.33.0`, kept as a test fixture), and mail sent over SMTP reads back through the Mailpit paths as a Mailpit-based test suite reads it. (#48)
- [x] EM-19.6 The guide's "Coming from Mailpit" page lists what works unchanged, the endpoints whose shape differs (`/api/v1/info`, `/api/v1/send`) and what is not emulated. (#48)

## EM-20 Email clicked events

0.1.0-beta.1 (planned as After 1.0), built on `feat/phase-0` by owner decision (2026-11-07). Plan: [32-after-1-0.md](../32-after-1-0.md#a2-emailclicked-link-click-tracking-em-20).

- [x] EM-20.1 Clicking a link in an email's preview opens it in a new tab as before and fires `email.clicked` with `source: "ui"`, the URL and the browser's user agent. (#48)
- [x] EM-20.2 Simulate click (`manual`) and `POST /api/v1/emails/{emailId}/clicks` (`api`) always fire; a URL that is not one of the email's links answers 422 `unknown_link`. (#48)
- [x] EM-20.3 The event carries the email fields, `url`, `clicked_at`, `first_click`, `click_count`, `source` and `user_agent`; `GET /api/v1/emails/{emailId}/clicks` lists every click newest first, the detail shows `click_count` and the timeline shows each click. (#48)
- [x] EM-20.4 Webhook rules can match `email.clicked` and filter on `url`, `first_click`, `click_count` and `source`. (#48)
- [x] EM-20.5 The SendGrid, Mailgun, Postmark, Resend, Amazon SES, Brevo and SparkPost templates send a click in that provider's own shape and event name, checked against fixtures built from each provider's documented click payload. (#48)
- [x] EM-20.6 `sendmock email click` and the MCP tool `sendmock_email_click` record a click, and the docs and the agent skill describe clicked events. (#48)

## EM-21 POP3 read access

0.1.0-beta.1 (planned as After 1.0), built on `feat/phase-0` by owner decision (2026-11-07). Plan: [32-after-1-0.md](../32-after-1-0.md#a6-pop3-read-access-em-21).

- [x] EM-21.1 With `--pop3-addr` (off by default), SendMock answers POP3 on that address: a greeting, CAPA, USER and PASS, STAT, LIST, UIDL, RETR, TOP, NOOP, DELE, RSET and QUIT, with `-ERR` for an unknown command, a command out of turn and a line that is too long. (#48)
- [x] EM-21.2 `--pop3-auth` accepts any login by default, or only the `user:password` lines of a `file:<path>`; a wrong password answers `-ERR`, and five failed logins close the connection. (#48)
- [x] EM-21.3 The username picks the mailbox: a project's key reads that project's emails, any other username reads `default`; the mailbox holds the newest 100 emails, numbered oldest first, and is fixed at login. (#48)
- [x] EM-21.4 RETR answers the raw message as SendMock received it, dot-stuffed; TOP answers its headers and the first n body lines; UIDL answers each email's id, the same in every session. (#48)
- [x] EM-21.5 DELE marks a message and RSET clears the marks; QUIT deletes the marked emails as the API does, firing `email.deleted`, and a connection that drops without QUIT deletes nothing. (#48)
- [x] EM-21.6 `/api/v1/info` and Settings > Connection show the POP3 address when it is on, and Python's `poplib` logs in, lists and retrieves an email SendMock captured over SMTP. (#48)

## EM-22 Where a simulated reply goes

Phase 5 (W20), for the next beta (0.1.0-beta.4), added 2026-11-13 (owner request). Plan: [07-ui.md](../07-ui.md#mail) and [05-webhooks.md](../05-webhooks.md#simulating-replies-and-forwards).

- [x] EM-22.1 Send reply is enabled as soon as the composer opens: sending the prefilled reply unchanged creates the incoming email with the quoted original, an empty message box sends an empty body, and Reply all behaves the same; Forward is enabled once its To holds an address. (#241)
- [x] EM-22.2 `POST /api/v1/inbound-routes/match` with `to`, `cc` and `headers` answers the inbound routes that would run, in run order with their actions and ending at one that calls `stop()`, and the enabled webhook rules on `email.inbound` whose filter matches, with their endpoint's name and URL; it stores and sends nothing, and `sendmock route match` and `sendmock_inbound_route_match` give the same answer. (#241)
- [x] EM-22.3 The Reply, Reply all and Forward composers show a "Delivers to" row with each URL or address a matching route forwards or notifies and each matching rule's endpoint URL, each linking to its route or rule, and the row updates when the Forward address changes. (#241)
- [x] EM-22.4 When nothing would receive the email, the row says "Nothing receives this yet" and Send replies to your app creates, from an app URL and the choice "Only mail to <address>" (default) or "Every incoming email", an inbound route with a `forward` action to that URL, which then shows in the row and in Webhooks > Inbound routes. (#241)
- [x] EM-22.5 After sending, the toast and the new incoming email's header list each webhook request it caused with its URL and its status, updated live from pending to the HTTP status or error, each linking to the delivery in Webhooks > Deliveries, or say that nothing received it with a link to Webhooks > Inbound routes; `GET /api/v1/webhooks/deliveries?subject_id=<emailId>` answers only that email's deliveries. (#241)

## EM-23 Mailgun events and complaints APIs

1.4.0 (A23), planned 2026-11-20 from a user's request (owner request to plan it for 1.4.0). Plan: [32-after-1-0.md](../32-after-1-0.md#a23-fuller-twilio-and-mailgun-emulation-sm-19-sm-20-sm-21-em-23-pl-20-pl-21) (A23).

- [x] EM-23.1 `GET /v3/{domain}/events` answers Mailgun's `items` and `paging` for the emails sent through the Mailgun provider for that domain and their simulated outcomes (`accepted`, `delivered`, `failed` with `severity` and `delivery-status`, `opened`, `clicked`, `complained`), each item with the same event data the `mailgun.events` template sends.
- [x] EM-23.2 The events filters `event`, `recipient`, `message-id`, `from`, `to`, `subject`, `tags`, `severity`, `begin`, `end`, `ascending` and `limit` (up to 300) work as Mailgun documents, and the `paging` URLs answer the next and previous pages.
- [x] EM-23.3 `/v3/{domain}/complaints` lists, fetches, adds and deletes complaints (one address or all) in Mailgun's shapes, and an address without a complaint answers Mailgun's `404`.
- [x] EM-23.4 A complaint simulated in SendMock (Simulate, the `complaint@` alias or an outcome rule) adds the address for that domain, and a later send to it through Mailgun is accepted but not delivered, recorded as a `failed` event with reason `suppress-complaint`.
- [x] EM-23.5 The Mailgun provider's sheet lists each domain's complaints and clears them, and REST, CLI and MCP list and clear them too.
- [x] EM-23.6 In CI, the Mailgun PHP SDK reads the events of a sent email and adds, reads and deletes a complaint, and the provider docs list the new paths.

## EM-24 Mailgun sends and ids

1.5.0 (A28), planned 2026-11-22 from a user's report on 1.4.0 (owner request). Plan: [32-after-1-0.md](../32-after-1-0.md#a28-plug-and-play-for-mailgun-and-twilio-apps-em-24-to-em-27-sm-22-to-sm-24-pl-24-to-pl-27-ai-08) (A28).

- [ ] EM-24.1 A Mailgun send with `template` and no `text` or `html` is accepted and stored with its template id, as on Mailgun (R-02).
- [ ] EM-24.2 `h:X-Mailgun-Variables` and every `v:*` field of a `/messages` send, and the `X-Mailgun-Variables` header of a `/messages.mime` send, are stored as the email's user variables and read by templates as `data.user_variables` (R-08).
- [ ] EM-24.3 A provider send keeps the provider's message id on the stored email; templates read it as `data.provider_message_id`, the email API shows it, and the built-in Mailgun templates use it, so a webhook carries the id the send answered (R-26).
- [ ] EM-24.4 Every provider route percent-decodes its path parameters before matching, so `DELETE /v3/{domain}/complaints/user%40example.org` removes the complaint as `user@example.org` does (R-28).
- [ ] EM-24.5 The Mailgun PHP and Node SDKs send with `template` and with `v:` variables in CI, and the webhooks for those emails carry the variables and the id the SDK got back.
- [ ] EM-24.6 A Mailgun template send fills the template from `h:X-Mailgun-Variables` as well as `t:variables`, and `t:variables` wins a key both give, as on Mailgun (R-36).

## EM-25 Mailgun webhooks as Mailgun sends them

1.5.0 (A28), planned 2026-11-22 from a user's report on 1.4.0 (owner request). Plan: [32-after-1-0.md](../32-after-1-0.md#a28-plug-and-play-for-mailgun-and-twilio-apps-em-24-to-em-27-sm-22-to-sm-24-pl-24-to-pl-27-ai-08) (A28).

- [ ] EM-25.1 `mailgun.events` carries `user-variables` on every event of an email that has them, and `delivery-status`, `severity` and `reason` per event, matching a fixture from Mailgun's documented events (R-03).
- [ ] EM-25.2 A simulated soft bounce is sent as `severity: temporary` with its SMTP code and message, a hard bounce as `permanent`; template data has `data.bounce.type`, `data.bounce.code` and `data.bounce.message` (the flat fields stay as aliases), and previews and renders of a bounced email show them (R-33).
- [ ] EM-25.3 `mailgun.routes` sends Mailgun's store-and-notify fields (`from`, `To`, `Message-Id`, `In-Reply-To`, `References`, the stripped text, HTML and signature, `body-html`, `message-headers`, `attachment-count`, the attachments, `content-id-map`, `message-url`), matching a fixture from Mailgun's documentation (R-06).
- [ ] EM-25.4 Each built-in template lists only the events its provider sends: inbound templates list `email.inbound`, event templates do not, and a rule built from the rule tool's inbound example fires for simulated inbound mail and replies (R-04, R-24).
- [ ] EM-25.5 Simulate warns before sending when a chosen endpoint's template does not list the event (R-24).
- [ ] EM-25.6 A built-in `mailgun.store_notify` template sends Mailgun's store-and-notify form, with `attachments` as a JSON list of each file's `url`, `content-type`, `name` and `size` and no file parts, and `mailgun.routes` is described as Mailgun's forward form (R-43).

## EM-26 Stored messages and local email templates

1.5.0 (A28), planned 2026-11-22 from a user's report on 1.4.0 (owner request). Plan: [32-after-1-0.md](../32-after-1-0.md#a28-plug-and-play-for-mailgun-and-twilio-apps-em-24-to-em-27-sm-22-to-sm-24-pl-24-to-pl-27-ai-08) (A28).

- [ ] EM-26.1 `GET /v3/domains/{domain}/messages/{key}` answers Mailgun's full stored-message shape for the provider id or SendMock's id, templates have `data.message_url`, and Mailgun events have a `storage` field with `url` and `key` (R-07).
- [ ] EM-26.2 Local email templates are listed, created, updated and deleted on REST, CLI, MCP and Mail > Templates in the UI (R-29).
- [ ] EM-26.3 `GET /v3/{domain}/templates/{name}` (with `active=yes`) answers from the local email templates in Mailgun's shape, and 404 as Mailgun does for an unknown name (R-10).
- [ ] EM-26.4 The `[[email.templates]]` keys are documented, and a setup file with an unknown key is refused by validate and import with the key's name (R-18).
- [ ] EM-26.5 Each attachment of a stored message (`GET /v3/domains/{domain}/messages/{key}`) has the `url` it can be downloaded from (R-43).

## EM-27 Simulating email events with the app's data

1.5.0 (A28), planned 2026-11-22 from a user's report on 1.4.0 (owner request). Plan: [32-after-1-0.md](../32-after-1-0.md#a28-plug-and-play-for-mailgun-and-twilio-apps-em-24-to-em-27-sm-22-to-sm-24-pl-24-to-pl-27-ai-08) (A28).

- [ ] EM-27.1 The Simulate open, click, bounce and complaint dialogs, REST actions and MCP tools take user variables, which are merged into the webhook payload before it is signed (R-09).
- [ ] EM-27.2 Viewing an email in the inbox does not record an open or send a webhook by default when a webhook rule would send one; the viewer says so and offers Count as an open, and the setting keeps the old behaviour (R-25).
- [ ] EM-27.3 The guide shows testing opens and bounces of SMTP-sent mail with user variables, without editing payloads.
