# 32. After 1.0: the backlog

The features planned for after 1.0 ([GitHub milestone "After 1.0"](https://github.com/shibbirweb/sendmock/milestone/3), issues #159 to #169). On 2026-11-07, with every 1.0 criterion waiting on the owner's release steps ([31](31-release-runbook.md)), the owner chose to build them now on `feat/phase-0` in #48 rather than wait. Each item gets its design note here and its criteria in [acceptance/](acceptance/README.md) before any code, then the usual commit per part.

## Order

Smallest change with the most users first; items that need an outside party (a distribution's maintainers, Docker's extension review) last.

| # | Item | Issue | Feature |
|---|------|-------|---------|
| A1 | Mailpit API compatibility | #163 | EM-19 (new) |
| A2 | `email.clicked` link-click tracking | #164 | to be written |
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
