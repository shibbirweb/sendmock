# 32. After 1.0: the backlog

The features planned for after 1.0 ([GitHub milestone "After 1.0"](https://github.com/shibbirweb/sendmock/milestone/3), issues #159 to #169). On 2026-11-07, with every 1.0 criterion waiting on the owner's release steps ([31](31-release-runbook.md)), the owner chose to build them now on `feat/phase-0` in #48 rather than wait. Each item gets its design note here and its criteria in [acceptance/](acceptance/README.md) before any code, then the usual commit per part.

## Order

Smallest change with the most users first; items that need an outside party (a distribution's maintainers, Docker's extension review) last.

| # | Item | Issue | Feature |
|---|------|-------|---------|
| A1 | Mailpit API compatibility | #163 | EM-19 (new) |
| A2 | `email.clicked` link-click tracking | #164 | EM-20 (new) |
| A3 | More SMS provider formats (AWS SNS SMS, Infobip) | #165 | to be written |
| A4 | Vonage Verify v2 and other verify APIs | #160 | to be written |
| A5 | Multi-project inboxes | #167 | to be written |
| A6 | POP3 read access | #159 | to be written |
| A7 | Push notification emulation | #166 | to be written |
| A8 | WhatsApp Business Cloud API, in full | #161 | to be written |
| A9 | System tray app | #168 | to be written |
| A10 | Helm chart and Docker Desktop extension | #162 | to be written |
| A11 | Official distribution repositories | #169 | needs maintainers ([09](09-distribution.md#package-channels-by-stage-decided-2026-10-27)) |

## A1. Mailpit API compatibility (EM-19)

**Why:** SendMock listens on Mailpit's ports (SMTP 1025, HTTP 8025, [10](10-open-questions.md)), so an app switches by changing nothing. Its test suite does not: tests that read mail through Mailpit's API (`/api/v1/messages`, `/api/v1/message/latest`, `/api/v1/search`) fail against SendMock. [10](10-open-questions.md) §9 recommended compatibility aliases after 1.0; this builds them.

**Source of truth:** Mailpit's own API definition, `server/ui/api/v1/swagger.json` in `axllent/mailpit` at `v1.33.0` (the latest release on 2026-11-07). A trimmed copy (the paths and definitions below) is kept as a test fixture in `crates/sendmock-api/tests/fixtures/mailpit/`, with its source and licence (MIT) noted, and every answer is checked against it.

**What is served,** on the main HTTP port at Mailpit's paths:

| Mailpit endpoint | Answer | From |
|------------------|--------|------|
| `GET /api/v1/messages?start&limit` | `MessagesSummary`: `total`, `unread`, `messages_count`, `messages_unread`, `start`, `tags`, `messages` (each a `MessageSummary`), newest first | the email list |
| `GET /api/v1/search?query&start&limit` | the same, for messages matching a [Mailpit search](https://mailpit.axllent.org/docs/usage/search-filters/) | the email list with its `query` |
| `DELETE /api/v1/search?query` | `ok` | delete each match |
| `PUT /api/v1/messages` (`IDs`, `Read`, `Search`) | `ok`; no IDs and no search sets every message | mark read or unread |
| `DELETE /api/v1/messages` (`IDs`) | `ok`; no IDs deletes every message | delete |
| `GET /api/v1/message/{ID}` | `Message`: addresses as `{Name, Address}`, `Text`, `HTML`, `Attachments` and `Inline` with `PartID`, `Tags`, `Size`, `Date`; marks it read | the email detail |
| `GET /api/v1/message/{ID}/headers` | `{header: [values]}`, keys in alphabetical order | the raw source's headers |
| `GET /api/v1/message/{ID}/raw` | the source as `text/plain` | the raw source |
| `GET /api/v1/message/{ID}/part/{PartID}` | the part's bytes with its content type | the MIME part |
| `GET /api/v1/tags`, `PUT /api/v1/tags` (`IDs`, `Tags`) | the tag names; `ok` after replacing the messages' tags | the email tags |
| `GET /view/{ID}.html`, `GET /view/{ID}.txt` | the HTML or text part; 404 when the message has none | the email detail |

`{ID}` is SendMock's email ID; `latest` means the newest message, as in Mailpit. Mailpit's search words map to SendMock's own search, which reads the same `from:`, `to:`, `subject:`, `tag:`, `is:read`, `is:unread` and `has:attachment` filters; other filters are read as words. Errors answer as Mailpit does: 404 with a plain text body for a missing message, 400 with plain text for a bad request.

**Not served:** `GET /api/v1/info` and `POST /api/v1/send` are SendMock's own endpoints at the same paths, with their own shapes, and stay so (an app that sends through Mailpit's HTTP API is rare; one that reads through it is common). Mailpit's chaos, web UI configuration, HTML, link and spam checks, release, thumbnails and tag rename and delete are not emulated: SendMock has its own versions of most of them in its API. The docs page lists both.

**Where it lives** (the Adapter pattern, as for provider emulation): `crates/sendmock-ops/src/email/mailpit/` translates SendMock's email records to Mailpit's shapes (`MailpitMessageSummary`, `MailpitMessage`, `MailpitMessagesSummary`) and Mailpit's requests to SendMock's email operations, with no HTTP in it; `crates/sendmock-api/src/mailpit_routes.rs` is the thin router that reads the request and writes the answer. These are compatibility aliases, like the provider APIs, not new operations: they add no CLI command or MCP tool, since the native ones already do the same.

**Docs:** a guide page "Coming from Mailpit" under Mail: what keeps working unchanged (ports, the endpoints above, `X-Tags`), the two endpoints that differ, and what SendMock adds.

**Tests naming EM-19:** unit tests of the adapter's translations; API tests for every endpoint above, each answer checked against the fixture's definitions; an end-to-end test that sends mail over SMTP and reads it back through the Mailpit paths, as a Mailpit-based test suite does.

**As built (2026-11-07):** `crates/sendmock-ops/src/email/mailpit/` (`mailpit_shapes.rs`, `mailpit_mailbox.rs`) and `crates/sendmock-api/src/mailpit_routes.rs`, merged into the app router, so UI auth covers it like the native API. New store queries in `crates/sendmock-store/src/email/email_mailbox_queries.rs` (a page by offset, counts, every tag, read status for a search), and `compute_file_checksums` in `sendmock-core` for the attachments' `Checksums`. Deletes and per-message changes go through the native operations, so `email.deleted` and the UI follow. Two things found while building: the mail parser renders an HTML version of a text-only message for SendMock's preview, which Mailpit does not have, so the adapter reads the MIME tree and answers `HTML: ""` and a 404 view for those; and Mailpit's dates are Go's RFC 3339 without trailing zero fractions, which SendMock's format already matches. Tests: `mailpit_api.rs` (every endpoint, each answer checked against `fixtures/mailpit/mailpit-definitions.json`), `crates/sendmock/tests/mailpit_compatibility.rs` (SMTP to `search` and `message/latest` on a real binary), unit tests in `mailpit_shapes.rs`, and `scripts/mailpit-docs.test.ts` (the guide lists every path the router serves).

## A2. `email.clicked` link-click tracking (EM-20)

**Why:** apps test click tracking the way they test opens: "the user clicked the verify link, so stop the reminder", engagement scores, A/B links. Every email provider SendMock emulates reports clicks, and `email.opened` already exists ([05](05-webhooks.md#opened-events), EM-11); clicks were left for after 1.0 ([11](11-roadmap.md)).

**What the providers send** (checked against their docs on 2026-11-07): SendGrid `"event": "click"` with `url` (and `url_offset`); Mailgun `"event": "clicked"` with `url`; Postmark `"RecordType": "Click"` with `OriginalLink` and `ClickLocation` (`HTML` or `Text`); Resend `"type": "email.clicked"` with `data.click` `{ ipAddress, link, timestamp, userAgent }`; Amazon SES `"eventType": "Click"` with `click` `{ ipAddress, link, linkTags, timestamp, userAgent }`; Brevo `"event": "click"` with `link`; SparkPost `"type": "click"` with `target_link_url`. Each built-in template gains its click shape, and each provider's status names gain `clicked`, so a provider endpoint receives clicks exactly as the provider sends them.

**When it fires,** as opens do, but a click is always deliberate, so there is no setting to turn the UI's clicks off:

| Source | `source` | Behaviour |
|--------|----------|-----------|
| A link clicked in the email's HTML or text preview | `ui` | the link opens in a new tab as before, and the click is recorded |
| Simulate click in the email's actions (pick one of its links) | `manual` | always fires |
| `POST /api/v1/emails/{emailId}/clicks` with `url` (and optional `user_agent`) | `api` | always fires, for CI tests |

The URL must be one of the email's links (the `links` SendMock already extracts, EM-13), as a provider only tracks links it rewrote; another URL answers 422 `unknown_link` with the email's links in the message.

**Payload** (`email.clicked`): the email fields `email.opened` carries, plus `url`, `clicked_at`, `first_click` (the first click on that URL), `click_count` (all clicks on the email), `source` and `user_agent`. Each click is kept (`GET /api/v1/emails/{emailId}/clicks`, newest first), the email's detail gains `click_count`, and its timeline shows each click.

**Where it lives:** migration `email_clicks` (email, URL, time, source, user agent); `EmailClickRepository` beside the opens; `RecordEmailClickOperation` and `ListEmailClicksOperation` in `crates/sendmock-ops/src/email/` (so REST, CLI `sendmock email click <emailId> --url` and the MCP tool `sendmock_email_click` come from the registry); the event in the event catalogue and webhook rule filters on `url`, `first_click`, `click_count` and `source`. The UI first, against the mock (API change in [06](06-api.md), then types, the regenerated spec and the MSW handlers), then the binary.

**Split:** A2a the contract, mock and UI (the preview's click capture, Simulate click, the timeline entries, the Deeper entries); A2b the binary (store, operations, event, rule filters); A2c the provider templates and their fixture tests; A2d the docs (Opened and clicked events, the Mail guide, the skill).


**As built, A2a and A2b (2026-11-07):** one commit, since the generated spec and the binary's registry must agree in CI. UI and mock: `web/src/features/mail/detail/preview/use-preview-link-clicks.ts` listens for clicks in the preview (the listener belongs to the app page; the click's target comes from the preview's own realm, so it is checked with `closest`, not `instanceof Element`), `simulate-click-menu.tsx` adds Simulate > Click a link, and `web/src/mocks/clicks/` and `email-click-handlers.ts` answer the API. Binary: migration `0034_email_clicks.sql`, `email_click.rs` in the store, `email_click_operations.rs` in the operations (422 `unknown_link` lists the email's links), `email.clicked` in the event catalogue, the rule fields `url`, `first_click` and `click_count` in `sendmock-webhooks` and in the UI's rule builder, and `with_engagement_event_fields` reading a click's own fields as an open's. The wait-for-email answer now carries the same detail as `GET /emails/{emailId}`, click count included. Tests: `crates/sendmock-api/tests/email_clicks_api.rs`, `web/tests/e2e/email-clicks.spec.ts`, `web/src/mocks/clicks/record-mock-click.test.ts` and the rule message unit test. A2c (provider click shapes) and A2d (docs, CLI test, skill) follow.

**As built, A2c (2026-11-07):** the click shapes live in the template definitions (`web/src/mocks/fixtures/template-definitions.ts`, exported to `crates/sendmock-ops/builtin/` with the providers' `clicked` status names and `email.clicked` in each email template's events), plus `clicked` in both event name tables (`template_event_name_filters.rs` and the demo's `render-template-text.ts`). SES now sends a click as event publishing does (`eventType` with a `click` object) and SparkPost sends opens and clicks as `track_event`s. `crates/sendmock-api/tests/email_click_provider_formats.rs` delivers one click to all seven templates and reads each body at the paths `fixtures/provider_webhooks/click_events.json` records from the providers' docs. Building it found a bug in the demo's template renderer: an `if` nested in another `if`'s branch took the inner tag into its condition and left an `endif` behind; the condition now stops at the first `%}` (regression test in `render-template-conditions.test.ts`).
