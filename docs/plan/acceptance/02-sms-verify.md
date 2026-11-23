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

- [x] SM-02.1 Create, fetch and list at `/2010-04-01/Accounts/{AccountSid}/Messages[...].json` return Twilio-shaped JSON with `SM` + 32 hex IDs.
- [x] SM-02.2 Missing or invalid params return Twilio's error JSON and HTTP status.
- [x] SM-02.3 Any credentials are accepted by default; with credentials enforced, wrong ones return `401` in Twilio's format. (#48)
- [x] SM-02.4 The official Twilio SDKs (PHP, Node, Python, Go, Java, C#, Ruby) send successfully using the documented redirection recipe. (#48)

## SM-03 Twilio Messaging Services

UI in U1, backend Phase 2.

- [x] SM-03.1 A send with `MessagingServiceSid` and no `From` picks a sender from the service's number pool.
- [x] SM-03.2 Unknown service SIDs are auto-created in lenient mode and rejected with error `21701` in strict mode.
- [x] SM-03.3 Services can be managed from UI, API, CLI, MCP and the seed file. (#48)
- [x] SM-03.4 A service has a sender pool and inbound handling (send a webhook with fallback, defer to the sender's webhook, or drop); a number belongs to at most one service, and moving it updates both services.

## SM-04 Vonage SMS API

Phase 2.

- [x] SM-04.1 `POST /sms/json` returns Vonage's response shape with message IDs and status.
- [x] SM-04.2 Errors use Vonage's status codes and error text.
- [x] SM-04.3 Delivery receipts are sent in Vonage DLR format.

## SM-05 Other SMS providers and generic vendor

Phase 4.

- [x] SM-05.1 Plivo and MessageBird send endpoints accept requests and return their provider's response and error shapes. (#48)
- [x] SM-05.2 A generic GET/POST vendor with configurable parameter names (`to`, `msg`, `api_key`, ...) captures SMS from regional vendor clients. (#48)

## SM-06 Encoding and segments

Phase 2.

- [x] SM-06.1 GSM-7 text: 160 characters is 1 segment, 161 is 2 (153 per segment); extension-table characters count as 2. (#48)
- [x] SM-06.2 Any non-GSM character switches to UCS-2: 70 characters is 1 segment, 71 is 2 (67 per segment). (#48)
- [x] SM-06.3 Encoding and segment count are shown on each bubble and returned by the API. (#48)

## SM-07 Delivery simulation and magic numbers

Phase 2. Docs: [Delivery simulation](../04-sms.md#delivery-simulation).

- [x] SM-07.1 `instant`, `realistic` and `manual` profiles produce the documented status sequences and timings.
- [x] SM-07.2 Every Twilio `To` and `From` magic number returns exactly Twilio's error code and HTTP status on send.
- [x] SM-07.3 Each `+150055501xx` extension number produces its documented after-send outcome and error code.
- [x] SM-07.4 Strict Twilio test mode rejects non-magic `From` numbers with `21606`.
- [x] SM-07.5 A failure rate of N% marks about N% of messages `undelivered`/`failed` over 1,000 sends (within 5 points).
- [x] SM-07.6 Every transition is stored in the status history and shown in the message drawer.
- [x] SM-07.7 Custom outcome numbers can be created, edited, reordered, switched off and deleted from Settings, the API, CLI, MCP and the seed file, with the code and delay rules enforced. (#48)
- [x] SM-07.8 The first enabled matching custom rule wins over magic numbers and the profile, `*` patterns match any digits, and each outcome (`reject`, `undelivered`, `failed`, `delayed_delivery`, `read`) behaves as documented.
- [x] SM-07.9 With the Magic numbers switch off, `+15005550xxx` numbers behave like any other number; "Test a number" shows which rule, magic number or profile applies.

## SM-08 Status callbacks

Phase 2.

- [x] SM-08.1 `StatusCallback` (Twilio) and the DLR URL (Vonage) receive one callback per status change, in the provider's format and order.
- [x] SM-08.2 Twilio callbacks carry a valid `X-Twilio-Signature` for the configured auth token.
- [x] SM-08.3 Callbacks are logged and visible in the message drawer, and failed callbacks are retried like webhooks. (#48)

## SM-09 Inbound SMS and two-way conversations

Phase 2 (inbound), Phase 3 (reply webhook and TwiML; moved from Phase 4 on 2026-10-25). Docs: [Reply webhook](../04-sms.md#reply-webhook-twilio-style).

- [x] SM-09.1 The UI composer and `POST /api/v1/sms/inbound` create an inbound SMS and fire `sms.inbound`. (#48)
- [x] SM-09.2 The number's inbound URL (or a matching rule) receives it in the chosen provider format with a valid signature. (#48)
- [x] SM-09.3 A TwiML `<Message>` response from the app is recorded as an outbound reply in the same thread. (#48)
- [x] SM-09.4 The inbound message goes to the Messaging Service request URL, else the number's inbound URL, with the configured method, all of Twilio's inbound fields, `X-Twilio-Signature` and `I-Twilio-Idempotency-Token`. (#48)
- [x] SM-09.5 TwiML `to`, `from`, `statusCallback`, `action`, `<Media>` and `<Redirect>` behave as documented; several `<Message>` verbs create several replies in order; one inbound message triggers at most 10 TwiML fetches. (#48)
- [x] SM-09.6 Failures carry Twilio's error codes (11200, 11205, 12100, 12300), the fallback URL is called with `ErrorCode` and `ErrorUrl`, and nothing is retried automatically. (#48)
- [x] SM-09.7 Inbound bubbles show the webhook result, TwiML replies carry a "TwiML reply" badge, and the drawer shows the request, response and parsed TwiML with "Resend reply webhook" (also in REST, CLI and MCP). (#48)

## SM-10 SMS opened (read) events

Phase 3.

- [x] SM-10.1 An outbound SMS bubble scrolled into view fires `sms.opened` once (first-open setting) and shows the Read tick.
- [x] SM-10.2 Inbound SMS never fire `sms.opened`; the API returns `409` for them.
- [x] SM-10.3 "Simulate read" and `POST /sms/{smsId}/open` always fire.

## SM-11 WhatsApp via Twilio

Phase 4.

- [x] SM-11.1 Sends with `whatsapp:+...` addresses are stored with channel `whatsapp` and shown with WhatsApp styling. (#48)
- [x] SM-11.2 Inbound WhatsApp messages are delivered in Twilio's format. (#48)
- [x] SM-11.3 The `read` status is supported in callbacks. (#48)

## SM-12 Virtual numbers

UI in U1, backend Phase 2 (moved from Phase 4 on 2026-10-29).

- [x] SM-12.1 Numbers can be created, edited and deleted with label, channels, inbound URL and format, and status callback.
- [x] SM-12.2 An inbound message to a registered number goes to its inbound URL without needing a rule. (#48)
- [x] SM-12.3 The form and the API reject a number that is not E.164, is already registered, has no channel, or has a URL that is not `http` or `https`.

## SM-13 API request log

UI in U1, backend Phase 1 (email APIs) and Phase 2 (SMS APIs).

- [x] SM-13.1 Every request to native and provider APIs is logged, including `4xx` rejections, with the exact response returned.
- [x] SM-13.2 Credentials are masked in the log. (#48)
- [x] SM-13.3 The log can be filtered by provider, status class and path, and each accepted message links to its request. (#48)
- [x] SM-13.4 Rejected requests are highlighted, and request and response bodies are shown formatted (JSON pretty-printed, form fields as a table). (#48)
- [x] SM-13.5 The request log loads 50 rows at a time and loads more on scroll, so it stays fast with thousands of requests. (#48)

## SM-14 Provider port

Phase 2.

- [x] SM-14.1 With `--provider-addr`, provider routes answer at their real root paths (Twilio, Verify, Messaging Services, email providers).
- [x] SM-14.2 The same routes answer under `/providers/<name>/` on the main port.
- [x] SM-14.3 `--provider-port <provider>=<port>` gives a provider its own port.

## SM-15 MMS and media

UI in U1, backend Phase 2 (Twilio and native), Phase 4 (WhatsApp). Docs: [MMS and media](../04-sms.md#mms-and-media).

- [x] SM-15.1 A Twilio send with `MediaUrl` stores a copy of each file; a URL that cannot be fetched fails the message with `11200`. (#48)
- [x] SM-15.2 A native send with `media_urls` and / or inline base64 `media` stores the media, and `GET /sms/{smsId}/media/{mediaIndex}` returns each file with its content type. (#48)
- [x] SM-15.3 More than 10 items, more than 5 MB, a missing filename or invalid base64 returns `400` naming the item. (#48)
- [x] SM-15.4 Bubbles show image thumbnails and file chips with an "MMS" or "Media" badge, and the message drawer lists the media. (#48)
- [x] SM-15.5 "Reply as recipient" can attach files, and the reply webhook sends `NumMedia` and `MediaUrl{N}` pointing at SendMock's copies. (#48)

---

## SM-16 Configurable SMS providers

UI in U3 (W16), runtime in Phase 2 (built-ins) and 4 (custom). Plan: [22-configurable-providers.md](../22-configurable-providers.md).

- [x] SM-16.1 SMS > Providers lists every SMS provider, built-in and custom, with its key, whether it is built in, Modified, enabled and messages in the last 24 hours; removed built-ins are listed in a Removed group. (UI and mock API; the live runtime in Phases 2 and 4)
- [x] SM-16.2 A provider can be added from blank or from a built-in (whose definition is copied) and edited: name, key, host, accent, enabled, credentials (secrets masked) and Check credentials, operations (send, fetch one, list, cancel, start verification, check verification) with method, path template and request format, the field mapping, validation rules, success and error responses, the message id template, the callback template and status names and the provider error code for each delivery outcome. (UI and mock API; the live runtime in Phases 2 and 4)
- [x] SM-16.3 An edited built-in shows Modified and Reset to default restores it after confirming; Remove takes a built-in out of routing, pickers and Settings > Connection and Restore brings it back unchanged; a custom provider can be deleted, and the messages it caught keep its name and show "deleted provider". (UI and mock API; the live runtime in Phases 2 and 4)
- [x] SM-16.4 The preview runs a sample request through the definition and shows the message SendMock would store and the response it would return, with problems under each part; a save with template errors, an invalid path template, a duplicate key or a path that clashes with another enabled provider is refused with the reason. (UI and mock API; the live runtime in Phases 2 and 4)
- [x] SM-16.5 Requests at a provider's paths, on the provider port and under `/providers/<key>/`, are answered from its current definition, so a change applies to the next request; a custom provider's sends appear in SMS with its name, and a removed provider's paths answer SendMock's native `404`.
- [x] SM-16.6 REST, CLI and MCP list, get, create, update, delete or remove, restore, reset and preview SMS providers with the same validation as the UI; secrets are masked in every answer, the CLI and UI reveal one after a confirmation, and MCP never reveals them; the skill's `add-sms-provider` workflow takes an agent from the provider's API docs to a working provider (definition, preview, test send, seed export).
- [x] SM-16.7 The seed file exports changed built-ins and custom providers under `[[sms.providers]]` with secrets as `${ENV}` references, and applying it recreates them. (UI and mock API; the live runtime in Phases 2 and 4)
- [x] SM-16.8 The shipped built-ins pass the existing provider fixture and SDK tests (SM-02, SM-04, SM-05 and VF-03) unchanged, so the defaults still match the real providers; Twilio's test numbers and error codes stay exact. (#48)

## VF-01 Verify services

UI in U1, backend Phase 2. Docs: [Twilio Verify](../04-sms.md#twilio-verify).

- [x] VF-01.1 `POST /v2/Services` creates a service and `GET` returns it in Twilio's shape.
- [x] VF-01.2 Code length (4 to 10), fixed code and TTL can be set per service and globally. (#48)
- [x] VF-01.3 Services can be created, edited and deleted from the Services tab, with the code length, fixed code and TTL rules enforced in the form and the API.

## VF-02 Start a verification and deliver the code

Phase 2.

- [x] VF-02.1 Starting a verification returns `status: pending` in Twilio's shape.
- [x] VF-02.2 The `sms` and `whatsapp` channels create a captured SMS with the code; the `email` channel creates a captured email; `call` creates a Verify log entry.
- [x] VF-02.3 With a fixed code configured, that code is always used.
- [x] VF-02.4 `GET /api/v1/otp?to=...&channel=verify`, `sendmock otp` and `sendmock_otp_get` return the code.
- [x] VF-02.5 Too many sends return error `60203`.

## VF-03 Check a verification

Phase 2.

- [x] VF-03.1 The correct code returns `approved`; a wrong code returns `pending`.
- [x] VF-03.2 After 5 wrong checks the verification fails with `60202`.
- [x] VF-03.3 Expired or unknown verifications return `20404`.
- [x] VF-03.4 An app using the official Twilio Verify SDK completes an OTP login against SendMock. (#48)

## VF-04 Force state and events

UI in U1, backend Phase 2.

- [x] VF-04.1 Forcing `approved`, `canceled`, `expired` or `max_attempts` from UI, API, CLI or MCP changes the state immediately.
- [x] VF-04.2 `verify.started`, `verify.checked` and `verify.expired` fire and can trigger webhook rules.
- [x] VF-04.3 The Verify tab lists verifications with code, status, attempts and expiry countdown. (#48)
- [x] VF-04.4 The verification drawer shows the timeline and links to the captured SMS or email that carried the code. (#48)


## VF-05 Vonage Verify v2

0.1.0-beta.1 (planned as After 1.0), built on `feat/phase-0` by owner decision (2026-11-07). Plan: [32-after-1-0.md](../32-after-1-0.md#a4-vonage-verify-v2-vf-05).

- [x] VF-05.1 `POST /v2/verify` with an `sms` workflow starts a verification, delivers its code by SMS into SendMock, and answers 202 with a `request_id`; an `email` workflow delivers it by email. (#48)
- [x] VF-05.2 `POST /v2/verify/{request_id}` with the right code answers 200 `completed`, a wrong code 400 `Invalid Code`, and a finished, cancelled or unknown request 404 `Not Found`, each in Vonage's problem shape. (#48)
  - Changed 2026-11-07 while building A4: the first wording said `complete`; Vonage's API and its Node SDK's `checkCode` answer `completed`, so the criterion names the real status.
- [x] VF-05.3 `DELETE /v2/verify/{request_id}` cancels the verification; every Vonage verification shows in Verify under a service named after its brand. (#48)
- [x] VF-05.4 The Vonage Node SDK's `Verify2` client starts and checks a verification against SendMock, with the code read from SendMock's API. (#48)
## SM-17 More SMS providers

0.1.0-beta.1 (planned as After 1.0), built on `feat/phase-0` by owner decision (2026-11-07). Plan: [32-after-1-0.md](../32-after-1-0.md#a3-more-sms-providers-sm-17).

- [x] SM-17.1 Infobip's send API captures the SMS and answers in Infobip's shape, with its errors; delivery reports reach the `notifyUrl` in Infobip's format; the Infobip Node SDK sends through it. (#48)
- [x] SM-17.2 Telnyx's send API captures the SMS and answers in Telnyx's shape, with its errors; status webhooks reach the `webhook_url` in Telnyx's format; the Telnyx Node SDK sends through it. (#48)
- [x] SM-17.3 Sinch's batches API captures the SMS and answers in Sinch's shape, with its errors; delivery reports reach the `callback_url` in Sinch's format; the Sinch Node SDK sends through it. (#48)
- [x] SM-17.4 Africa's Talking's messaging API captures the SMS and answers in its shape, with its errors; the Africa's Talking Node SDK sends through it. (#48)
- [x] SM-17.5 Amazon SNS's `Publish` with a `PhoneNumber` captures the SMS and answers SNS's `PublishResponse`, with SNS's errors; the AWS SDK's SNS client sends through it. (#48)
- [x] SM-17.6 SMS > Providers lists the five as built-in providers, and the docs list their send APIs. (#48)

## SM-18 WhatsApp Business Cloud API

0.1.0-beta.1 (planned as After 1.0), built on `feat/phase-0` by owner decision (2026-11-07). Plan: [32-after-1-0.md](../32-after-1-0.md#a8-whatsapp-business-cloud-api-sm-18).

- [x] SM-18.1 `POST /{version}/{phone_number_id}/messages` stores text, template, media, location, contacts, interactive and reaction messages as WhatsApp messages with a readable body and answers Meta's `messaging_product`, `contacts` and `messages` shape (`message_status` for templates). (#48)
- [x] SM-18.2 An invalid request is refused with Graph's error object (`OAuthException`, code `100`, `error_data.details`) and nothing is stored; `status: "read"` with a message id marks the message read and answers `{ success: true }`. (#48)
- [x] SM-18.3 Media can be uploaded, looked up (`url`, `mime_type`, `sha256`, `file_size`), downloaded and deleted, and a message sent with a media id carries the file. (#48)
- [x] SM-18.4 With a callback URL set, each status (`sent`, `delivered`, `read`, `failed` with `131026` and its error object) and each reply in a Cloud API conversation reaches it in Meta's envelope, signed with `X-Hub-Signature-256` from the app secret; the verification check sends `hub.mode`, `hub.verify_token` and `hub.challenge` and reports whether the challenge came back. (#48)
- [x] SM-18.5 SMS > Providers lists WhatsApp Cloud as a built-in provider with its credentials, and an app calling the Cloud API over HTTP sends, receives a status and a reply, and verifies their signatures in CI. (#48)

## SM-19 Twilio accounts and subaccounts

1.4.0 (A23), planned 2026-11-20 from a user's request (owner request to plan it for 1.4.0). Plan: [32-after-1-0.md](../32-after-1-0.md#a23-fuller-twilio-and-mailgun-emulation-sm-19-sm-20-sm-21-em-23-pl-20-pl-21) (A23).

- [x] SM-19.1 `GET /2010-04-01/Accounts/{AccountSid}.json` answers Twilio's Account (`sid`, `friendly_name`, `status`, `type`, `auth_token`, `owner_account_sid`, `date_created` and `date_updated` in RFC 2822, `subresource_uris`, `uri`) for the main account and each subaccount, and an unknown SID answers Twilio's `404`.
- [x] SM-19.2 `GET /2010-04-01/Accounts.json` lists the main account and its subaccounts in Twilio's page shape, filtered by `FriendlyName` and `Status`; `POST /2010-04-01/Accounts.json` creates a subaccount with a new `AC` SID and auth token; `POST /2010-04-01/Accounts/{AccountSid}.json` changes `FriendlyName` and `Status`.
- [x] SM-19.3 The account endpoints always check credentials, even with Check credentials off: the main account's credentials see every account, a subaccount's own see only itself, anything else answers Twilio's `401`, and the API request log masks the token in the answer.
- [x] SM-19.4 Subaccounts (SID, friendly name, auth token, status) are listed, added, edited and removed on the Twilio provider's Accounts tab, through REST, CLI and MCP (agents set tokens but never read them back) and in the seed file with tokens as `${ENV}` references.
- [x] SM-19.5 Status callbacks and simulated inbound replies for a message sent under `/Accounts/{AccountSid}/Messages.json` carry an `X-Twilio-Signature` made with that account's auth token; a SID that is not a subaccount uses the main token; a send under a suspended or closed subaccount is refused with Twilio's error and nothing is stored.
- [x] SM-19.6 The `twilio.inbound_sms` and `twilio.status_callback` endpoint templates sign with the provider's token for the event's account unless a `twilio_auth_token` webhook variable is set, which then wins, and the template editor and the variables list say which token signs.
- [x] SM-19.7 The SMS guide's "Twilio signatures" section lists which token signs each Twilio webhook, the default token `twilio-test-token`, that a masked value is not the token, and how to reveal the real one.
- [x] SM-19.8 In CI, the Twilio PHP and Node SDKs fetch a subaccount's token with the account fetch, send under the subaccount and validate every status callback with `RequestValidator`.

## SM-20 Twilio phone numbers API

1.4.0 (A23), planned 2026-11-20 from a user's request (owner request to plan it for 1.4.0). Plan: [32-after-1-0.md](../32-after-1-0.md#a23-fuller-twilio-and-mailgun-emulation-sm-19-sm-20-sm-21-em-23-pl-20-pl-21) (A23).

- [x] SM-20.1 `/2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers.json` lists (filtered by `PhoneNumber` and `FriendlyName`, in Twilio's page shape), fetches, creates (from `PhoneNumber` or `AreaCode`), updates (`FriendlyName`, `SmsUrl`, `SmsMethod`, `SmsFallbackUrl`, `StatusCallback`) and deletes virtual numbers, each with a stable `PN` SID, in Twilio's IncomingPhoneNumber shape.
- [x] SM-20.2 A number belongs to the account it was created under (the main account for numbers made in the UI) and lists only under that account; a number that is not E.164 or already registered is refused with Twilio's error.
- [x] SM-20.3 Numbers created, changed or deleted through the API show on the Numbers screen, and changes made there show in the API.
- [x] SM-20.4 `/v1/Services/{ServiceSid}/PhoneNumbers` lists, fetches, adds (`PhoneNumberSid`) and removes a Messaging Service's numbers in Twilio's PhoneNumber shape (`sid`, `account_sid`, `service_sid`, `phone_number`, `country_code`, `capabilities`, dates, `url`) over the same sender pool as the Numbers screen; adding a number that is in another service answers Twilio's error.
- [x] SM-20.5 In CI, the Twilio PHP and Node SDKs pointed at the provider port create a number, create a Messaging Service, add the number to it and send with `MessagingServiceSid`, and the provider docs list the new paths.

## SM-21 Twilio Debugger webhook

1.4.0 (A23), planned 2026-11-20 from a user's request (owner request to plan it for 1.4.0). Plan: [32-after-1-0.md](../32-after-1-0.md#a23-fuller-twilio-and-mailgun-emulation-sm-19-sm-20-sm-21-em-23-pl-20-pl-21) (A23).

- [x] SM-21.1 The built-in `twilio.debugger` template sends a form POST with `Sid` (`NO` and 32 hex), `AccountSid`, `ParentAccountSid` (only for a subaccount), `Timestamp`, `Level`, `PayloadType` and a JSON `Payload` with `resource_sid`, `service_sid`, `error_code` and `more_info`, signed with `X-Twilio-Signature` and the account's token, matching a fixture built from Twilio's documented example.
- [x] SM-21.2 The Twilio provider and each subaccount have a Debugger webhook URL, set on the provider sheet, through REST, CLI and MCP and in the seed file.
- [x] SM-21.3 With a Debugger URL set, a message that ends `failed` or `undelivered` with an error code (magic number, outcome rule or Simulate) sends one event with that code and the message SID, and a status callback or inbound URL that fails sends one event with error `11200` and the `webhook` request and response.
- [x] SM-21.4 Debugger events show on the message's timeline, are retried like status callbacks, and the template can also be picked for a webhook endpoint.

## SM-22 Twilio accounts in every place

1.5.0 (A28), planned 2026-11-22 from a user's report on 1.4.0 (owner request). Plan: [32-after-1-0.md](../32-after-1-0.md#a28-plug-and-play-for-mailgun-and-twilio-apps-em-24-to-em-27-sm-22-to-sm-24-pl-24-to-pl-27-ai-08) (A28).

- [ ] SM-22.1 An inbound SMS or MMS to a number owned by a subaccount is stored with that account, carries its `AccountSid` and is signed with its token (R-31).
- [ ] SM-22.2 `twilio.inbound_sms` always sends `FromCity`, `FromState`, `FromZip`, `FromCountry`, `ToCity`, `ToState`, `ToZip` and `ToCountry`, empty unless known, the countries from the numbers (R-34).
- [ ] SM-22.3 A fetch of a message, number or other account-scoped resource through an account that does not own it answers Twilio's 20404, and every answer reports the real owner in `account_sid` (R-35).
- [ ] SM-22.4 A 401 keeps Twilio's 20003 body, and the HTTP request log says why: a wrong token, an unknown account, or an account that is not the provider's (R-21).
- [ ] SM-22.5 Numbers take an account on add and update (REST, CLI `--account-sid`, MCP, UI), the setup file exports and imports it, `inbound_method` defaults to POST, and `sms services create` takes `--sid` (R-11, R-15).
- [ ] SM-22.6 The Twilio PHP and Node SDKs in CI fetch a subaccount's message through the main account and get 20404, and validate an inbound webhook signed with the subaccount's token.
- [ ] SM-22.7 A Messaging Service can be made with no numbers (`number_ids` left out, from the API, CLI and MCP); a send through a service with no usable sender goes from Twilio's test sender, and in strict Twilio test mode is refused with Twilio's 21704 (no numbers) or 21703 (no number for the recipient's channel) (R-45).
- [ ] SM-22.8 Saving the Twilio provider with an `account_sid` that is not `AC` and 32 letters or digits, an empty one included, is refused with the field named (R-47).
- [ ] SM-22.9 A Messaging Service can be made with only `friendly_name`: `inbound_mode` defaults to `defer_to_sender` and the inbound URLs to none, from the API, CLI and MCP (R-48).

## SM-23 Opt-out keywords

1.5.0 (A28), planned 2026-11-22 from a user's report on 1.4.0 (owner request). Plan: [32-after-1-0.md](../32-after-1-0.md#a28-plug-and-play-for-mailgun-and-twilio-apps-em-24-to-em-27-sm-22-to-sm-24-pl-24-to-pl-27-ai-08) (A28).

- [ ] SM-23.1 With opt-out emulation on (the default for the Twilio provider), an inbound STOP, STOPALL, UNSUBSCRIBE, CANCEL, END or QUIT blocks later sends from that number or Messaging Service to the sender with Twilio's 21610, and START, YES or UNSTOP lifts it (R-32).
- [ ] SM-23.2 Optional auto-replies answer STOP, START and HELP as Twilio does, recorded as outbound messages.
- [ ] SM-23.3 Opt-out emulation is switched per provider, number and Messaging Service, and opt-outs are listed and cleared on REST, CLI, MCP and the UI.
- [ ] SM-23.4 The Twilio PHP and Node SDKs in CI see 21610 after a STOP and send again after START.

## SM-24 Statuses set by hand

1.5.0 (A28), planned 2026-11-22 from a user's report on 1.4.0 (owner request). Plan: [32-after-1-0.md](../32-after-1-0.md#a28-plug-and-play-for-mailgun-and-twilio-apps-em-24-to-em-27-sm-22-to-sm-24-pl-24-to-pl-27-ai-08) (A28).

- [ ] SM-24.1 A final status set by hand (delivered, undelivered or failed) ends the simulated lifecycle: no later step changes it, and status callbacks are sent in status order (R-30).
- [ ] SM-24.2 Setting a status by hand says, in the CLI, the API answer and the UI, when its status callback is sent (R-14).
