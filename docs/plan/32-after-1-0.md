# 32. After 1.0: the backlog

The features planned for after 1.0 ([GitHub milestone "After 1.0"](https://github.com/shibbirweb/sendmock/milestone/3), issues #159 to #169). On 2026-11-07, with every 1.0 criterion waiting on the owner's release steps ([31](31-release-runbook.md)), the owner chose to build them now on `feat/phase-0` in #48 rather than wait. Each item gets its design note here and its criteria in [acceptance/](acceptance/README.md) before any code, then the usual commit per part.

## Order

Smallest change with the most users first; items that need an outside party (a distribution's maintainers, Docker's extension review) last.

| # | Item | Issue | Feature |
|---|------|-------|---------|
| A1 | Mailpit API compatibility | #163 | EM-19 (new) |
| A2 | `email.clicked` link-click tracking | #164 | EM-20 (new) |
| A3 | More SMS provider formats (AWS SNS SMS, Infobip) | #165 | SM-17 (new) |
| A4 | Vonage Verify v2 and other verify APIs | #160 | VF-05 (new) |
| A5 | Multi-project inboxes | #167 | PL-10 (new) |
| A6 | POP3 read access | #159 | EM-21 (new) |
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

**As built, A2d (2026-11-07):** "Clicked events" in the Mail guide's reading page with the CLI, API and MCP rows, `email.clicked` in the webhooks event list and its fields in Rules and filters, `sendmock_email_click` named in the skill's webhook workflow (and the plugin's copy), and binary tests of `sendmock email click` and the MCP tool (`email_commands.rs`, `mcp_stdio.rs`). A list from an MCP tool comes back as the tool's text, since structured content must be an object.

## A3. More SMS providers (SM-17)

**Why:** apps that send SMS through Infobip, Telnyx, Sinch, Africa's Talking or Amazon SNS cannot point their SDK at SendMock yet. SendMock already has the webhook formats for the first four (`infobip.dlr`, `telnyx.message`, `sinch.sms`, `africastalking.sms`, checked against their docs on 2026-11-05) but not their send APIs; SNS has neither. Five SMS providers ship today (Twilio, Twilio Verify, Vonage, Plivo, MessageBird).

**How:** each provider is a new definition beside the built-in ones (SM-16, [22](22-configurable-providers.md)), so nothing in the existing providers changes: its send operation (method, path, request format), the field mapping to SendMock's message parts, the success answer and the error answers in the provider's own shape, the message ID it makes, its status names, and the callback template its delivery reports use. The definitions live in `web/src/mocks/fixtures/more-sms-provider-fixtures.ts` (the existing file is long) and are exported to `crates/sendmock-ops/builtin/` like the others. Every request and answer is read from the provider's API reference first, as a fixture with its link and the date checked; each provider also passes its official Node SDK against the provider port in the SMS clients workflow, as the Twilio SDKs do.

| Part | Provider | Send API | Delivery reports | Node SDK |
|------|----------|----------|------------------|----------|
| A3a | Infobip | `POST /sms/2/text/advanced` | `infobip.dlr` to `notifyUrl` | `@infobip-api/sdk` |
| A3b | Telnyx | `POST /v2/messages` | `telnyx.message` to `webhook_url` | `telnyx` |
| A3c | Sinch | `POST /xms/v1/{service_plan_id}/batches` | `sinch.sms` to `callback_url` | `@sinch/sdk-core` |
| A3d | Africa's Talking | `POST /version1/messaging` | `africastalking.sms` to the callback set on the account (the provider's settings) | `africastalking` |
| A3e | Amazon SNS | `Publish` with `PhoneNumber` (the query API: form body, XML answer) | none: SNS logs delivery status to CloudWatch, which SendMock does not emulate | `@aws-sdk/client-sns` |

The exact paths, fields and shapes above are checked against the API references when each part starts and corrected here if they differ. A part that finds the provider's API cannot be described by a definition (for example SNS's request signing or XML answers) says so in its As built note and adds the smallest engine change it needs, with its own test.


**As built, A3a Infobip (2026-11-07):** the definition is in `web/src/mocks/fixtures/more-sms-provider-fixtures.ts`. Infobip's Node SDK (`@infobip-api/sdk` 0.3.2, read from its source) posts to `/sms/2/text/advanced` with `Authorization: App <key>`, and accepts an `http://` base URL, so it points at the provider port unchanged. The answer is Infobip's `bulkId` and `messages[]` with the `PENDING_ACCEPTED` status; a refusal is its `requestError.serviceException`. Delivery reports use `infobip.dlr`, which turns SendMock's status names into Infobip's itself, so the provider's status names keep SendMock's (`delivered`, `failed`, `undelivered`) and only gate which statuses are reported (final ones). Tests: `crates/sendmock-api/tests/more_sms_providers_api.rs` and `examples/sms/node-infobip` in the SMS clients workflow.

**As built, A3b Telnyx (2026-11-07):** Telnyx's Node SDK (`telnyx` 7.30.0, read from its source) posts to `/messages` under `https://api.telnyx.com/v2` and takes a `baseURL`, so it reaches `/v2/messages` on the provider port. The answer is Telnyx's `data` message object with the recipient `queued`; a refusal is its `errors` list (`10004`, missing required parameter, 422). The `telnyx.message` template sent `message.received` for every event, which is wrong for an outbound status; it now sends `message.received` for inbound messages and `message.sent` then `message.finalized` for status updates, with Telnyx's status names (`sent`, `delivered`, `sending_failed`, `delivery_failed`) on the recipient. Webhook signing (Ed25519 with the account's key) is not emulated. Tests: `more_sms_providers_api.rs` and `examples/sms/node-telnyx`.

**As built, A3c Sinch (2026-11-07):** Sinch's Node SDK (`@sinch/sdk-core` 1.8.0) calls the SMS API with a Bearer token and no OAuth when it is given a service plan ID and an API token, at `/xms/v1/{service_plan_id}/batches`; `sms.setHostname` points it at the provider port. The answer is Sinch's `mt_text` batch, a refusal its `code` and `text`. `sinch.sms` already wrote inbound messages and recipient delivery reports, so the provider keeps SendMock's status names. Sinch sends reports only when the batch asks for them (`delivery_report`); SendMock sends them whenever a `callback_url` is given. Tests: `more_sms_providers_api.rs` and `examples/sms/node-sinch`.

**As built, A3d Africa's Talking (2026-11-07):** Africa's Talking's Node SDK (`africastalking` 0.8.4) posts a form to `/version1/messaging` with the `apikey` header and only accepts a 201; it has no base URL option, so the example adds a request interceptor to the SDK's own axios that sends its calls to the provider port. The answer is `SMSMessageData` with the recipient's `statusCode` 101, a refusal is plain text. Its delivery reports go to a callback set on the account, so the provider sends none itself; a webhook rule with `africastalking.sms` does. While writing the refusals, `error.reason` turned out to be empty for a failed required-field rule (it carries only a provider's own message), so each new provider's refusal now names its own field (Infobip `Message text is missing`, Telnyx `The 'text' parameter is required.`, Sinch `Field 'body' is required`, Africa's Talking `missing required form field 'message'`) and the tests check the text. Tests: `more_sms_providers_api.rs` and `examples/sms/node-africastalking`. The Advanced guide's walkthrough for adding an SMS provider used Africa's Talking as its example of a vendor SendMock does not ship; it now adds Clickatell (`POST /messages` on `platform.clickatell.com`, told apart from MessageBird's same path by its host). Termii was tried first and refused, since its real path starts with `/api/`, which is SendMock's own.

**As built, A3e Amazon SNS (2026-11-07):** the AWS SDK's SNS client (`@aws-sdk/client-sns` 3.1164.0) uses the Query protocol: a form posted to `/` with `Action=Publish`, answered in XML. A definition describes that (form request, `PublishResponse` and `ErrorResponse` bodies with `Content-Type: text/xml`); two engine changes were needed. SNS has no sender field, and the engine required one: a provider whose field mapping has no `from` and no messaging service now stores its messages from the provider's name (`send_operation_kind.rs`), while providers that map a sender still require it. And `/providers/<key>/` with nothing after it fell through to the web UI, since a catch-all route takes no empty path; `provider_routes.rs` now routes a provider's root. SNS logs delivery status to CloudWatch, so the provider has no callback. Tests: `more_sms_providers_api.rs` and `examples/sms/node-sns`; SM-17.6 is proven by `message-providers.spec.ts` (the five listed as built-in) and `sms-clients-workflow.test.ts` (the providers page names each send API).

**Also found while building A3:** the CI run of A3a failed SM-16.3 because the demo's live traffic toasts stack over the last provider row's buttons, now that the list is longer; that test hides the toaster. And `otp_answers_the_newest_code_per_recipient_and_channel` failed about 3 times in 10: two SMS stored in the same millisecond got random ULIDs, so "the newest" (and any list in id order) could swap them. `SystemIdGenerator` now uses the `ulid` crate's monotonic generator, with a test that 10,000 ids in a row strictly increase.

## A4. Vonage Verify v2 (VF-05)

**Why:** Twilio Verify is the only one-time-code API SendMock answers (VF-01 to VF-04). Vonage Verify v2 is the other common one; an app using it cannot run its login flow against SendMock today. Other providers' verify APIs (Sinch Verification, Infobip 2FA, Plivo Verify) follow as later parts once this one shows the pattern.

**What Vonage sends and answers,** read from the Vonage Node SDK's source and its test data (`@vonage/verify2` 1.22.1, 2026-11-07), which builds every URL from a configurable `apiHost`:

| Request | Answer |
|---------|--------|
| `POST /v2/verify` with `brand`, `workflow` (`[{channel: "sms", to}]`, also `email`, `whatsapp`, `voice`), optional `code_length`, `code`, `locale`, `channel_timeout`, `callback_url` | 202 `{ request_id }` |
| `POST /v2/verify/{request_id}` with `code` | 200 `{ request_id, status: "completed" }` (the SDK's `checkCode` returns this status); a wrong code 400 problem `Invalid Code` |
| `DELETE /v2/verify/{request_id}` | 204, the request cancelled |
| a finished, cancelled or unknown request | 404 problem `Not Found`, "Request <id> was not found or it has been verified already." |

Errors are problem details (`title`, `type`, `detail`, `instance`), as the SDK's data sets show.

**How:** like Twilio Verify, a stateful API stays in code as an adapter (`vonage_verify_api.rs` beside `twilio_verify_api.rs`, [22](22-configurable-providers.md)) over the same verify domain, so a Vonage verification is an ordinary SendMock verification: listed in Verify, its code delivered as an SMS (or email, or WhatsApp) into SendMock, readable by `GET /api/v1/otp`, and firing the same `verify.*` events. Vonage has no verify service the way Twilio does, only a `brand` per request, so SendMock keeps one verify service per brand, made on first use and named after it, with `code_length` (default 4) and the workflow's channel taken from the request. A wrong code counts toward the service's attempt limit; past it, the request ends and later checks answer 404, as Vonage's do. The provider is built in as `vonage_verify`, a sibling of the existing `vonage` SMS provider, and the Vonage Node SDK's `Verify2` client runs a login against it in the SMS clients workflow.

**Not in this part:** `next_workflow`, silent authentication and templates; the status `callback_url` events; Vonage's legacy Verify v1 (`/verify/json`).

**As built, A4 (2026-11-07):** `vonage_verify_api.rs` answers the three requests over the verify domain, tried after Twilio Verify in the provider runtime, and the `vonage_verify` definition lists it with Basic credentials (`api_key`, `api_secret`), which Verify v2 accepts beside the SDK's JWT; the JWT itself is not checked. Reading the SDK showed the check answers `completed`, not `complete` as first written here, so the table and VF-05.2 say `completed` (the SDK's `checkCode` returns that status, and an app compares against it). Vonage's phone numbers have no `+`; SendMock adds it, so the code SMS and the Verify list show E.164. The `request_id` is the verification's SID (`VE...`) rather than a UUID, so one id works in both APIs. The captured code SMS still carries `twilio_verify` as its API, since the verify domain sends it for either API. Tests: `vonage_verify_api.rs` (VF-05.1 to VF-05.3) and `examples/sms/node-vonage-verify` with `@vonage/verify2` 1.22.1 (VF-05.4), which generates an RSA key for the SDK's JWT, completes one login and cancels another.

## A5. Projects: multi-project inboxes (PL-10)

**Why:** a team often shares one SendMock (a dev server, a CI runner, a Docker host). Today every app's mail, SMS and codes land in one list, so each developer filters by recipient or subject and a test reading "the latest code" can read another app's. Separate instances work but need more ports and more configuration.

**How others do it** (read 2026-11-07): smtp4dev keeps several mailboxes in one server, chosen by rules on the recipient, with a default mailbox for the rest and a mailbox picker in its UI ([its configuration doc](https://github.com/rnwood/smtp4dev/blob/master/docs/Configuration.md)). Mailtrap's sandbox groups inboxes into projects, and each inbox has its own SMTP credentials, so the username picks the inbox ([its sandbox API](https://docs.mailtrap.io/developers/email-sandbox/sandboxes-inboxes)). Mailpit and MailHog have one mailbox. SendMock follows Mailtrap's credentials model, since apps already set an SMTP username, plus a header and a URL prefix for HTTP APIs, which have no username of their own.

**What a project is:** a name for captured traffic inside one instance. A project has a key (lowercase letters, digits and dashes, up to 40 characters) and a display name. `default` always exists and holds everything not sent to another project; it cannot be deleted.

| Belongs to a project | Shared by every project |
|---|---|
| emails (with their attachments, timeline, opens, clicks and responses), SMS messages and threads, verifications | providers, templates, webhook endpoints, rules and variables, numbers, outcome rules, payments, HTTP bins, settings |

Projects separate traffic; they do not secure it. Anyone who can open SendMock can pick any project or "All projects", as in smtp4dev. Access control stays what it is today ([PL-06](acceptance/04-catcher-platform.md#pl-06-security-defaults)).

**How traffic picks its project:**

| Way in | Picked by | Unknown key |
|---|---|---|
| SMTP | the AUTH username, when it is a project's key (any password under `accept-any`) | stored in `default`, as without AUTH; apps send all kinds of usernames, and refusing would break mail that works today |
| REST send APIs (`/api/v1/send`, `/api/v1/sms`, inbound) | the `X-SendMock-Project` header | 404 `project_not_found` |
| provider APIs (Twilio, Vonage, SendGrid and the rest, on the provider port or under `/providers/<key>`) | the `X-SendMock-Project` header, or the URL prefix `/projects/<project>/` before the provider's path, for SDKs that take a base URL but no extra header | 404 in the provider's own error shape when it has one for a missing resource, else SendMock's |

**How reading works:** every list and lookup of captured traffic (emails, SMS, threads, verifications, `GET /otp`, `/links`, the `/wait/*` helpers, `GET /events/recent` and the realtime stream) takes an optional `project` (query parameter, `--project` in the CLI, a `project` argument in MCP). Without it they read every project, as today, so a single-project instance sees no change. Events carry `project` in their data, so a webhook rule can filter on it.

**Managing projects:** Settings > Projects lists them with their key, their message counts and a "Connect" block (the SMTP username and the header or URL prefix to use), and creates, renames and deletes them. Deleting a project deletes its traffic. REST `GET/POST /api/v1/projects`, `PATCH/DELETE /api/v1/projects/{projectKey}`, CLI `sendmock projects list|create|update|delete`, MCP `sendmock_project_*`, all from operations in `sendmock-ops`. The seed file has a `[[projects]]` table, and reset keeps projects like other configuration.

**In the UI:** a project switcher in the top bar ("All projects", then each project) kept in the URL (`?project=`), which filters Mail, SMS and Verify and the live toasts. It shows only when a project other than `default` exists, so a single-project instance looks as it does today.

**Parts:** A5a the store, operations, REST, CLI and MCP, with SMTP and the header; A5b the provider URL prefix; A5c the UI (mock first, then live) and docs.

**As built, A5a and A5b (2026-11-07):** projects live in their own table (migration 0035), and emails, SMS and verifications gained a `project_key` column (`default` for everything stored before). The request's client and project travel together as `RequestScope` in the operation context; the REST router and the provider routes set it from `X-SendMock-Project` (allowed in CORS) or, on provider routes, from a leading `/projects/<key>/`, which is stripped before the provider sees the path, so `http://127.0.0.1:8026/projects/shop` (provider port) or `http://127.0.0.1:8025/providers/twilio/projects/shop` (main port) is a project's base URL. SMTP looks the AUTH username up with a cheap existence check and only then clones the context. An unknown project on a provider route answers SendMock's own `404 project_not_found`, not the provider's not-found shape the table above planned: the project is resolved before any provider is matched, and a provider's not-found means a missing resource of its own, which would mislead. `/projects/` joins `/api/` and `/providers/` as paths a provider definition may not use. Reads take `project` on emails (and the email delete filter), the latest email, SMS, conversations (which then count only the project's messages), verifications, OTP, links, the email and SMS waits and recent events; the live stream is not filtered on the server, and the UI filters its toasts by the event's `project`. Rule messages carry `project` (from the stored email or SMS, or from a verification event's data). Tests: `projects_api.rs`, `project_traffic_api.rs`, `project_reads_api.rs`, `project_provider_api.rs`, and the Telnyx Node SDK example sending under `/projects/shop/` (PL-10.4).

**As built, A5c (2026-11-07):** Settings > Projects lists the projects with their traffic counts, adds (key and name), renames and deletes them, and shows the three ways to send to one with copy buttons. The top bar picker appears once a second project exists; its choice is a root search parameter kept from screen to screen with TanStack Router's `retainSearchParams`, read by the email, SMS, conversation and verification list hooks, so every screen using them is scoped. The realtime provider sits outside the router and reads the choice from the URL when an event arrives; events about another project stay in the bell without a toast. Seed files carry `[[projects]]` (`key`, `name`; never `default`), applied by a seed adapter that adds or renames and, on a reset with a seed, removes the projects the seed does not list. Tests: `projects.spec.ts` (mock mode), `realtime-event-effects.test.ts`, `project_seed_api.rs`.

**Not in this part:** per-project settings, retention or webhook endpoints; per-project credentials that SendMock checks; routing by recipient rules (smtp4dev's model), which tag rules and inbound routes already cover for filtering.

## A6. POP3 read access (EM-21)

**Why:** some apps and test suites read a mailbox over POP3: an inbound-mail feature that polls a support address, a QA script built on Python's `poplib` or PHP's IMAP extension, a desktop mail client pointed at a test server. Today they cannot read what SendMock caught without changing to its API.

**How others do it** (Mailpit's `internal/pop3` source, read 2026-11-07): Mailpit's POP3 server is off until credentials are configured, since it hands out every message. It serves the newest 100 messages, with USER and PASS, STAT, LIST, UIDL (the message id), RETR, TOP, NOOP, DELE, RSET, QUIT and CAPA (RFC 1939 and 2449); DELE only marks, and the marked messages are deleted when the client sends QUIT, so a dropped connection deletes nothing. A line over RFC 1939's limit is refused, an idle session closes after 10 minutes, and five failed logins close the connection. TLS is implicit, with a certificate given on the command line.

**How:** a new `sendmock-pop3` crate with the protocol (a session state machine over a `Pop3Mailbox` trait, testable without a socket) and the listener, wired by the binary like the SMTP one; the mailbox is implemented in `sendmock-ops` over the email repository, so deletes go through the same path as the API and fire `email.deleted`.

- **Off by default:** `--pop3-addr` (`SENDMOCK_POP3_ADDR`) turns it on, bound to `127.0.0.1` unless told otherwise (Docker publishes it only when asked).
- **Login:** `--pop3-auth` takes `accept-any` (the default, as for SMTP on a local machine) or `file:<path>` with the same `user:password` lines as `--smtp-auth`.
- **Mailbox:** the username picks it, as SMTP's does: a project's key reads that project's emails ([A5](#a5-projects-multi-project-inboxes-pl-10)), any other username reads `default`. The newest 100 emails of that project, numbered oldest first as POP3 clients expect; the list is fixed at login, as RFC 1939 asks.
- **Messages:** RETR answers the stored raw message with dot-stuffing; TOP the headers and the first n body lines; UIDL the email id, which never changes, so clients that remember downloaded ids work across sessions.
- **Seen in the product:** `/api/v1/info` lists the POP3 address, Settings > Connection shows the host, port and how to log in, and the CLI's `serve --help` and the configuration docs describe the options.

**Not in this part:** STLS and implicit TLS (SendMock runs on the developer's machine or a private network; TLS follows if asked), APOP and SASL logins, IMAP.
