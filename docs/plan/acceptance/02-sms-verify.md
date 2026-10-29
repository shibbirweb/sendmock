# Acceptance: SMS (SM) and Verify (VF)

Plan: [04-sms.md](../04-sms.md). Rules for IDs, ticking and tests: [README.md](README.md).

## SM-01 Native SMS API

Phase 2.

- [x] SM-01.1 `POST /api/v1/sms` (JSON and form) stores the SMS and returns `201` with id, status, segments and encoding. (#48)
- [x] SM-01.2 The `GET /api/v1/sms/send?to=...&body=...` variant works. (#48)
- [x] SM-01.3 Missing `to` or `body` returns `400` with a field-level error. (#48)
- [x] SM-01.4 Numbers are normalised to E.164 where possible and the raw value is kept. (#48)
- [x] SM-01.5 The SMS appears in the UI thread within 1 second. (#48)

## SM-02 Twilio Messages API

Phase 2.

- [ ] SM-02.1 Create, fetch and list at `/2010-04-01/Accounts/{AccountSid}/Messages[...].json` return Twilio-shaped JSON with `SM` + 32 hex IDs.
- [ ] SM-02.2 Missing or invalid params return Twilio's error JSON and HTTP status.
- [ ] SM-02.3 Any credentials are accepted by default; with credentials enforced, wrong ones return `401` in Twilio's format.
- [ ] SM-02.4 The official Twilio SDKs (PHP, Node, Python, Go, Java, C#, Ruby) send successfully using the documented redirection recipe.

## SM-03 Twilio Messaging Services

UI in U1, backend Phase 2.

- [ ] SM-03.1 A send with `MessagingServiceSid` and no `From` picks a sender from the service's number pool.
- [ ] SM-03.2 Unknown service SIDs are auto-created in lenient mode and rejected with error `21701` in strict mode.
- [ ] SM-03.3 Services can be managed from UI, API, CLI, MCP and the seed file.
- [ ] SM-03.4 A service has a sender pool and inbound handling (send a webhook with fallback, defer to the sender's webhook, or drop); a number belongs to at most one service, and moving it updates both services.

## SM-04 Vonage SMS API

Phase 2.

- [ ] SM-04.1 `POST /sms/json` returns Vonage's response shape with message IDs and status.
- [ ] SM-04.2 Errors use Vonage's status codes and error text.
- [ ] SM-04.3 Delivery receipts are sent in Vonage DLR format.

## SM-05 Other SMS providers and generic vendor

Phase 4.

- [ ] SM-05.1 Plivo and MessageBird send endpoints accept requests and return their provider's response and error shapes.
- [ ] SM-05.2 A generic GET/POST vendor with configurable parameter names (`to`, `msg`, `api_key`, ...) captures SMS from regional vendor clients.

## SM-06 Encoding and segments

Phase 2.

- [x] SM-06.1 GSM-7 text: 160 characters is 1 segment, 161 is 2 (153 per segment); extension-table characters count as 2. (#48)
- [x] SM-06.2 Any non-GSM character switches to UCS-2: 70 characters is 1 segment, 71 is 2 (67 per segment). (#48)
- [ ] SM-06.3 Encoding and segment count are shown on each bubble and returned by the API.

## SM-07 Delivery simulation and magic numbers

Phase 2. Docs: [Delivery simulation](../04-sms.md#delivery-simulation).

- [ ] SM-07.1 `instant`, `realistic` and `manual` profiles produce the documented status sequences and timings.
- [ ] SM-07.2 Every Twilio `To` and `From` magic number returns exactly Twilio's error code and HTTP status on send.
- [ ] SM-07.3 Each `+150055501xx` extension number produces its documented after-send outcome and error code.
- [ ] SM-07.4 Strict Twilio test mode rejects non-magic `From` numbers with `21606`.
- [ ] SM-07.5 A failure rate of N% marks about N% of messages `undelivered`/`failed` over 1,000 sends (within 5 points).
- [ ] SM-07.6 Every transition is stored in the status history and shown in the message drawer.
- [ ] SM-07.7 Custom outcome numbers can be created, edited, reordered, switched off and deleted from Settings, the API, CLI, MCP and the seed file, with the code and delay rules enforced.
- [ ] SM-07.8 The first enabled matching custom rule wins over magic numbers and the profile, `*` patterns match any digits, and each outcome (`reject`, `undelivered`, `failed`, `delayed_delivery`, `read`) behaves as documented.
- [ ] SM-07.9 With the Magic numbers switch off, `+15005550xxx` numbers behave like any other number; "Test a number" shows which rule, magic number or profile applies.

## SM-08 Status callbacks

Phase 2.

- [ ] SM-08.1 `StatusCallback` (Twilio) and the DLR URL (Vonage) receive one callback per status change, in the provider's format and order.
- [ ] SM-08.2 Twilio callbacks carry a valid `X-Twilio-Signature` for the configured auth token.
- [ ] SM-08.3 Callbacks are logged and visible in the message drawer, and failed callbacks are retried like webhooks.

## SM-09 Inbound SMS and two-way conversations

Phase 2 (inbound), Phase 3 (reply webhook and TwiML; moved from Phase 4 on 2026-10-25). Docs: [Reply webhook](../04-sms.md#reply-webhook-twilio-style).

- [ ] SM-09.1 The UI composer and `POST /api/v1/sms/inbound` create an inbound SMS and fire `sms.inbound`.
- [ ] SM-09.2 The number's inbound URL (or a matching rule) receives it in the chosen provider format with a valid signature.
- [ ] SM-09.3 A TwiML `<Message>` response from the app is recorded as an outbound reply in the same thread.
- [ ] SM-09.4 The inbound message goes to the Messaging Service request URL, else the number's inbound URL, with the configured method, all of Twilio's inbound fields, `X-Twilio-Signature` and `I-Twilio-Idempotency-Token`.
- [ ] SM-09.5 TwiML `to`, `from`, `statusCallback`, `action`, `<Media>` and `<Redirect>` behave as documented; several `<Message>` verbs create several replies in order; one inbound message triggers at most 10 TwiML fetches.
- [ ] SM-09.6 Failures carry Twilio's error codes (11200, 11205, 12100, 12300), the fallback URL is called with `ErrorCode` and `ErrorUrl`, and nothing is retried automatically.
- [ ] SM-09.7 Inbound bubbles show the webhook result, TwiML replies carry a "TwiML reply" badge, and the drawer shows the request, response and parsed TwiML with "Resend reply webhook" (also in REST, CLI and MCP).

## SM-10 SMS opened (read) events

Phase 3.

- [ ] SM-10.1 An outbound SMS bubble scrolled into view fires `sms.opened` once (first-open setting) and shows the Read tick.
- [ ] SM-10.2 Inbound SMS never fire `sms.opened`; the API returns `409` for them.
- [ ] SM-10.3 "Simulate read" and `POST /sms/{smsId}/open` always fire.

## SM-11 WhatsApp via Twilio

Phase 4.

- [ ] SM-11.1 Sends with `whatsapp:+...` addresses are stored with channel `whatsapp` and shown with WhatsApp styling.
- [ ] SM-11.2 Inbound WhatsApp messages are delivered in Twilio's format.
- [ ] SM-11.3 The `read` status is supported in callbacks.

## SM-12 Virtual numbers

UI in U1, backend Phase 2 (moved from Phase 4 on 2026-10-29).

- [ ] SM-12.1 Numbers can be created, edited and deleted with label, channels, inbound URL and format, and status callback.
- [ ] SM-12.2 An inbound message to a registered number goes to its inbound URL without needing a rule.
- [ ] SM-12.3 The form and the API reject a number that is not E.164, is already registered, has no channel, or has a URL that is not `http` or `https`.

## SM-13 API request log

UI in U1, backend Phase 1 (email APIs) and Phase 2 (SMS APIs).

- [ ] SM-13.1 Every request to native and provider APIs is logged, including `4xx` rejections, with the exact response returned.
- [x] SM-13.2 Credentials are masked in the log. (#48)
- [x] SM-13.3 The log can be filtered by provider, status class and path, and each accepted message links to its request. (#48)
- [x] SM-13.4 Rejected requests are highlighted, and request and response bodies are shown formatted (JSON pretty-printed, form fields as a table). (#48)
- [x] SM-13.5 The request log loads 50 rows at a time and loads more on scroll, so it stays fast with thousands of requests. (#48)

## SM-14 Provider port

Phase 2.

- [ ] SM-14.1 With `--provider-addr`, provider routes answer at their real root paths (Twilio, Verify, Messaging Services, email providers).
- [ ] SM-14.2 The same routes answer under `/providers/<name>/` on the main port.
- [ ] SM-14.3 `--provider-port <provider>=<port>` gives a provider its own port.

## SM-15 MMS and media

UI in U1, backend Phase 2 (Twilio and native), Phase 4 (WhatsApp). Docs: [MMS and media](../04-sms.md#mms-and-media).

- [x] SM-15.1 A Twilio send with `MediaUrl` stores a copy of each file; a URL that cannot be fetched fails the message with `11200`. (#48)
- [x] SM-15.2 A native send with `media_urls` and / or inline base64 `media` stores the media, and `GET /sms/{smsId}/media/{mediaIndex}` returns each file with its content type. (#48)
- [x] SM-15.3 More than 10 items, more than 5 MB, a missing filename or invalid base64 returns `400` naming the item. (#48)
- [ ] SM-15.4 Bubbles show image thumbnails and file chips with an "MMS" or "Media" badge, and the message drawer lists the media.
- [ ] SM-15.5 "Reply as recipient" can attach files, and the reply webhook sends `NumMedia` and `MediaUrl{N}` pointing at SendMock's copies.

---

## SM-16 Configurable SMS providers

UI in U3 (W16), runtime in Phase 2 (built-ins) and 4 (custom). Plan: [22-configurable-providers.md](../22-configurable-providers.md).

- [x] SM-16.1 SMS > Providers lists every SMS provider, built-in and custom, with its key, whether it is built in, Modified, enabled and messages in the last 24 hours; removed built-ins are listed in a Removed group. (UI and mock API; the live runtime in Phases 2 and 4)
- [x] SM-16.2 A provider can be added from blank or from a built-in (whose definition is copied) and edited: name, key, host, accent, enabled, credentials (secrets masked) and Check credentials, operations (send, fetch one, list, cancel, start verification, check verification) with method, path template and request format, the field mapping, validation rules, success and error responses, the message id template, the callback template and status names and the provider error code for each delivery outcome. (UI and mock API; the live runtime in Phases 2 and 4)
- [x] SM-16.3 An edited built-in shows Modified and Reset to default restores it after confirming; Remove takes a built-in out of routing, pickers and Settings > Connection and Restore brings it back unchanged; a custom provider can be deleted, and the messages it caught keep its name and show "deleted provider". (UI and mock API; the live runtime in Phases 2 and 4)
- [x] SM-16.4 The preview runs a sample request through the definition and shows the message SendMock would store and the response it would return, with problems under each part; a save with template errors, an invalid path template, a duplicate key or a path that clashes with another enabled provider is refused with the reason. (UI and mock API; the live runtime in Phases 2 and 4)
- [ ] SM-16.5 Requests at a provider's paths, on the provider port and under `/providers/<key>/`, are answered from its current definition, so a change applies to the next request; a custom provider's sends appear in SMS with its name, and a removed provider's paths answer SendMock's native `404`.
- [ ] SM-16.6 REST, CLI and MCP list, get, create, update, delete or remove, restore, reset and preview SMS providers with the same validation as the UI; secrets are masked in every answer, the CLI and UI reveal one after a confirmation, and MCP never reveals them; the skill's `add-sms-provider` workflow takes an agent from the provider's API docs to a working provider (definition, preview, test send, seed export).
- [x] SM-16.7 The seed file exports changed built-ins and custom providers under `[[sms.providers]]` with secrets as `${ENV}` references, and applying it recreates them. (UI and mock API; the live runtime in Phases 2 and 4)
- [ ] SM-16.8 The shipped built-ins pass the existing provider fixture and SDK tests (SM-02, SM-04, SM-05 and VF-03) unchanged, so the defaults still match the real providers; Twilio's test numbers and error codes stay exact.

## VF-01 Verify services

UI in U1, backend Phase 2. Docs: [Twilio Verify](../04-sms.md#twilio-verify).

- [ ] VF-01.1 `POST /v2/Services` creates a service and `GET` returns it in Twilio's shape.
- [ ] VF-01.2 Code length (4 to 10), fixed code and TTL can be set per service and globally.
- [ ] VF-01.3 Services can be created, edited and deleted from the Services tab, with the code length, fixed code and TTL rules enforced in the form and the API.

## VF-02 Start a verification and deliver the code

Phase 2.

- [ ] VF-02.1 Starting a verification returns `status: pending` in Twilio's shape.
- [ ] VF-02.2 The `sms` and `whatsapp` channels create a captured SMS with the code; the `email` channel creates a captured email; `call` creates a Verify log entry.
- [ ] VF-02.3 With a fixed code configured, that code is always used.
- [ ] VF-02.4 `GET /api/v1/otp?to=...&channel=verify`, `sendmock otp` and `sendmock_otp_get` return the code.
- [ ] VF-02.5 Too many sends return error `60203`.

## VF-03 Check a verification

Phase 2.

- [ ] VF-03.1 The correct code returns `approved`; a wrong code returns `pending`.
- [ ] VF-03.2 After 5 wrong checks the verification fails with `60202`.
- [ ] VF-03.3 Expired or unknown verifications return `20404`.
- [ ] VF-03.4 An app using the official Twilio Verify SDK completes an OTP login against SendMock.

## VF-04 Force state and events

UI in U1, backend Phase 2.

- [ ] VF-04.1 Forcing `approved`, `canceled`, `expired` or `max_attempts` from UI, API, CLI or MCP changes the state immediately.
- [ ] VF-04.2 `verify.started`, `verify.checked` and `verify.expired` fire and can trigger webhook rules.
- [ ] VF-04.3 The Verify tab lists verifications with code, status, attempts and expiry countdown.
- [ ] VF-04.4 The verification drawer shows the timeline and links to the captured SMS or email that carried the code.
