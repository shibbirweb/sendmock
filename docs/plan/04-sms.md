# 04. SMS Gateway

## Behaviour

SendMock pretends to be an SMS vendor. Your app "sends" SMS by making the same HTTP calls it makes to a real provider, but pointed at SendMock. Messages are stored, shown in a phone-style UI, and given simulated delivery statuses. Nothing is ever sent to a carrier.

It also works in the other direction: you can **simulate an incoming SMS** (a user replying "STOP" or texting a keyword) and SendMock calls your app's inbound webhook exactly like the provider would.

## API surfaces

### 1. Native API (always on)

Simple, provider-neutral, easiest to call from any language.

```
POST /api/v1/sms
Content-Type: application/json
Authorization: Bearer <any token, optional>

{
  "from": "+15550001111",
  "to": "+8801700000000",
  "body": "Your code is 482913",
  "status_callback": "http://localhost:3000/sms/status",
  "metadata": { "user_id": 42 }
}
```

Response `201`:

```json
{
  "id": "01JB...",
  "status": "queued",
  "segments": 1,
  "encoding": "GSM-7"
}
```

Also accepts `application/x-www-form-urlencoded` and a `GET` variant (`/api/v1/sms/send?to=...&body=...`) because many local/regional SMS vendors use query-string APIs.

### 2. Provider emulation

Mounted under `/providers/<name>/...` on the main HTTP port, and at the **real provider path** on the optional dedicated provider port (`--provider-addr`, default off, e.g. `127.0.0.1:8026`), so an SDK whose host is swapped hits the right path. The same port also serves the email provider APIs from [03-email.md](03-email.md#http-send-apis). If two providers ever share a path, the request is routed by `Host` header, or a provider can get its own port (`--provider-port twilio=8027`).

| Provider | Endpoints emulated | Phase |
|----------|--------------------|-------|
| Twilio Messaging | `POST /2010-04-01/Accounts/{AccountSid}/Messages.json`, `GET .../Messages/{Sid}.json`, `GET .../Messages.json` (list), `MessagingServiceSid` sends, status callbacks, inbound webhook format | 2 |
| Twilio Messaging Services | `POST/GET /v1/Services` (messaging.twilio.com), sender pool from virtual numbers | 2 |
| Twilio Verify | see [Twilio Verify](#twilio-verify) below | 2 |
| Twilio WhatsApp | same Messages API with `whatsapp:+...` addresses; see [WhatsApp via Twilio](#whatsapp-via-twilio) | 4 |
| Vonage (Nexmo) SMS API | `POST /sms/json`, delivery receipt (DLR) webhook format, inbound format | 2 |
| Plivo | `POST /v1/Account/{auth_id}/Message/` | 4 |
| MessageBird / Bird | `POST /messages` | 4 |
| AWS SNS (SMS) | `Publish` action (query API) | later |
| Infobip | `POST /sms/2/text/advanced` | later |
| Generic HTTP GET/POST | configurable param names (`to`, `msg`, `api_key`...) for regional vendors | 4 |

**Built in, not fixed (decided 2026-10-27).** The providers in this table ship as built-in presets, like payment gateways ([17](17-payments.md)) and webhook templates ([13](13-webhook-templates.md)): a user can edit one (paths, field names, response and error shapes), delete the ones they do not use, or add a provider that is not listed, starting blank or from the closest built-in; **Reset to default** brings a built-in back. The screen and the stored shape follow the gateway editor; the details are designed with the provider phase.

Each emulated endpoint:

- Validates required params and returns the provider's error shape and HTTP status for invalid requests (missing `To`, bad number, empty body).
- Returns a response body shaped like the provider's (IDs like `SM` + 32 hex for Twilio).
- Accepts any credentials by default; optionally enforces configured ones to test auth errors.
- Honours provider-specific callback params (`StatusCallback` for Twilio, account-level DLR URL for Vonage).

The exact field coverage per provider is tracked in a compatibility table in user docs, verified against each provider's official SDK in tests.

### Messaging Services (Twilio)

Many apps send with `MessagingServiceSid` instead of `From`. SendMock:

- Accepts `MessagingServiceSid` on Messages create; picks a sender from the service's number pool (virtual numbers assigned to it), or a generated number if the pool is empty.
- Lets services be created via API (`/v1/Services`), UI (Numbers > Messaging services) or the seed file.
- Unknown service SIDs are auto-created by default (lenient) or rejected with Twilio error `21701` (strict mode), so both "just works" and "test the error" are possible.

## Twilio Verify

Most OTP login flows call **Twilio Verify**, not the raw Messages API, so without it many apps cannot test login at all. Emulated on the provider port at `verify.twilio.com` paths:

| Endpoint | Behaviour |
|----------|-----------|
| `POST /v2/Services` / `GET /v2/Services/{ServiceSid}` | create/fetch a Verify service (friendly name, code length 4-10) |
| `POST /v2/Services/{ServiceSid}/Verifications` | start a verification (`To`, `Channel` = `sms`, `whatsapp`, `email`, `call`); returns `status: pending` |
| `GET /v2/Services/{ServiceSid}/Verifications/{Sid}` | fetch status |
| `POST /v2/Services/{ServiceSid}/Verifications/{Sid}` | update (`Status=canceled` / `approved`) |
| `POST /v2/Services/{ServiceSid}/VerificationCheck` | check `Code` against `To` or `VerificationSid`; returns `approved` or `pending` |

Behaviour:

- **Code generation:** random by default; a **fixed code** option per service or globally (e.g. `123456`) for fully deterministic tests.
- **Where the code appears:**
  - `sms` / `whatsapp` channel: a real captured SMS ("Your <service> verification code is: 482913") in the SMS screen.
  - `email` channel: a real captured email in the Mail screen.
  - `call` channel: recorded as a "voice call" item in the Verify log (no audio), code shown.
  - Always available via `/api/v1/otp?to=...`, the CLI (`sendmock otp`) and MCP (`sendmock_otp_get`).
- **Realistic rules:** 10 minute expiry (configurable), max 5 check attempts then error `60202`, max send attempts then `60203`, unknown verification `20404`, expired returns `20404` like the real API.
- **Force a state:** UI buttons and API (`POST /api/v1/verify/{verificationId}/force` with `approved`, `canceled`, `expired`, `max_attempts`) to test edge cases.
- **Events:** `verify.started`, `verify.checked` (with `approved` true/false), `verify.expired`; available to webhook rules.
- **UI:** a **Verify** tab in the SMS screen listing verifications with status, channel, code, attempts and timeline.

Later: Vonage Verify v2 and other providers' verify APIs using the same internal model.

## WhatsApp via Twilio

Twilio sends WhatsApp through the same Messages API with `whatsapp:` prefixed addresses. SendMock accepts them, stores the channel (`sms` or `whatsapp`), shows a WhatsApp badge and chat styling, supports `read` status for the opened/read flow, and sends inbound WhatsApp messages to the app in Twilio format. Template (content SID) sends are stored with their variables. (Phase 4; full WhatsApp Business Cloud API emulation stays in the backlog.)

## API request log

Every request to the native and provider SMS APIs (and the email HTTP send APIs) is logged, **including rejected ones** (400 bad number, 401 bad credentials, 404 unknown service), with method, path, headers (credentials masked), body, the exact response returned and timing. This answers "why did my SDK call fail?" without guessing.

- Stored in `api_requests` (bodies capped at 64 KB), same retention as messages.
- UI: **Logs > HTTP** with filters (provider, status class, path), linked from each accepted message.
- API: `/api/v1/logs/http`.

### 3. Provider SDK usage

Two ways an app can use its normal provider SDK against SendMock:

1. **Base URL / host override**, where the SDK supports it.
2. **Custom HTTP client** that rewrites the provider host to SendMock (most official SDKs accept an injectable HTTP client).

Per-SDK instructions live in [08-integrations.md](08-integrations.md). Confirming the cleanest method for each official SDK is a Phase 4 task.

## Message processing

1. Parse request, normalise numbers to E.164 when possible (keep the raw value too).
2. Compute **encoding and segments**: GSM-7 (160 chars single, 153 per segment when concatenated, with extension-table characters counting as 2) vs UCS-2 (70 / 67). Shown in the UI because it affects real-world cost.
3. Run extractors (OTP codes, links), same as email.
4. Store, publish `sms.sent` event (meaning "your app sent an SMS to SendMock").
5. Schedule simulated status transitions.

## Delivery simulation

Configurable globally (UI settings) and per request (via magic numbers):

| Setting | Default | Meaning |
|---------|---------|---------|
| Profile | `instant` | `instant` (delivered immediately), `realistic` (queued -> sent after ~300 ms -> delivered after ~1-3 s), `manual` (stays `sent` until you click a status in the UI) |
| Failure rate | 0% | random fraction marked `undelivered` / `failed` |
| Magic numbers | on | numbers that always produce a specific outcome |

Magic numbers follow **Twilio's official test numbers and error codes exactly** ([Twilio test credentials](https://www.twilio.com/docs/iam/test-credentials)), so tests written against SendMock also match Twilio's own test mode. The error is returned synchronously on send (HTTP 400 with Twilio's error JSON), as Twilio does.

`To` numbers (Twilio):

| To number | Result | Twilio error |
|-----------|--------|--------------|
| `+15005550001` | invalid number | 21211 |
| `+15005550002` | cannot route to this number | 21612 |
| `+15005550003` | no international permissions | 21408 |
| `+15005550004` | number is blocked (opted out) | 21610 |
| `+15005550009` | number cannot receive SMS | 21614 |
| anything else | normal profile | |

`From` numbers (Twilio):

| From number | Result | Twilio error |
|-------------|--------|--------------|
| `+15005550001` | invalid From | 21212 |
| `+15005550006` | valid, passes | |
| `+15005550007` | not owned / not SMS-capable | 21606 |
| `+15005550008` | message queue full | 21611 |
| anything else | accepted (lenient default); with **strict Twilio test mode** on, rejected with 21606 like real test credentials | |

SendMock extensions for **after-send** outcomes (Twilio's test mode has no equivalent because it never sends status callbacks):

| To number | Result | Error code in callback |
|-----------|--------|------------------------|
| `+15005550101` | accepted, then `undelivered` (unreachable handset) | 30003 |
| `+15005550102` | accepted, then `undelivered` (landline / unreachable carrier) | 30006 |
| `+15005550103` | accepted, then `undelivered` (filtered by carrier) | 30007 |
| `+15005550104` | accepted, then `failed` (unknown error) | 30008 |
| `+15005550105` | accepted, delivered after 30 s (slow delivery) | |
| `+15005550106` | accepted, delivered, then `read` (WhatsApp/RCS style) | |

Other providers (Vonage, Plivo, ...) map the same outcomes to their own error codes and status names. The full table is shown in Settings > SMS simulation.

The built-in numbers above are read-only, so they always match Twilio. The **Magic numbers** switch (Settings > SMS) turns them off; they then behave like any other number.

### Custom outcome numbers

Your own rules for your own test numbers, for example "my QA number always fails with 30007" or "every number starting `+1555777` is delivered after 10 s". Managed in Settings > SMS, the API (`/api/v1/outcome-rules/sms`), the CLI (`sendmock outcome-rule ...`), MCP and the seed file (`[[sms.outcome_rules]]`).

| Field | Meaning |
|-------|---------|
| Match | `to` or `from` number |
| Pattern | an exact E.164 number, or a pattern with `*` for any digits (`+1555777*`) |
| Outcome | `reject` (refused on send, HTTP 400 with Twilio's error JSON and the given code), `undelivered` or `failed` (accepted, then that status with the given code), `delayed_delivery` (delivered after the given delay), `read` (delivered, then read) |
| Error code | required for `reject`, `undelivered` and `failed`, for example `30007` |
| Delay | seconds for `delayed_delivery`, 1 to 3,600 |
| Note | optional, shown in the list |
| Enabled | rules can be switched off without deleting them |

- Order matters: the first enabled rule that matches wins. Custom rules are checked before the built-in magic numbers, then the simulation profile and failure rate apply.
- A "Test a number" box in Settings shows which rule, magic number or profile a number would get.

Each status change:

- Appends to `sms_status_history`.
- Publishes `sms.status` on the bus.
- Calls the per-message status callback (if provided) in the provider's format, and also flows through webhook rules.

## Simulating inbound SMS

From the UI ("New inbound SMS" composer, or replying inside a conversation thread) or API:

```
POST /api/v1/sms/inbound
{ "from": "+8801700000000", "to": "+15550001111", "body": "STOP", "format": "twilio" }
```

SendMock stores it with direction `inbound` and publishes `sms.inbound`. Webhook rules (or the number's configured inbound URL) deliver it to your app in the chosen provider format, for example a Twilio-style `application/x-www-form-urlencoded` POST with `From`, `To`, `Body`, `MessageSid`, plus an `X-Twilio-Signature` header computed with the configured auth token.

If your app answers with TwiML, SendMock records the reply in the same conversation. See [Reply webhook (Twilio style)](#reply-webhook-twilio-style).

## Reply webhook (Twilio style)

Phase 3 (moved from Phase 4 on 2026-10-25: two-way SMS is a core flow, so the reply webhook ships with the Twilio inbound format). This works like a Twilio phone number's "A message comes in" webhook: when someone texts your number, Twilio POSTs the message to your app, and your app can answer with TwiML to reply.

### Where the inbound message goes

The first match wins:

1. The number belongs to a Messaging Service whose inbound setting is "Send a webhook": the service's request URL.
2. The number has its own inbound URL in the Numbers registry (`SmsUrl`, `SmsMethod`, `SmsFallbackUrl`), or the service setting is "Defer to sender's webhook".
3. Neither: no reply webhook. Webhook rules on `sms.inbound` still fire either way, so a rule and a number URL can both receive the message (the UI warns about this).

### The request

Exactly what Twilio sends, so the handler you run in production works unchanged:

- `POST` (or `GET` when `SmsMethod` is `GET`) as `application/x-www-form-urlencoded`.
- Fields: `MessageSid`, `SmsSid`, `SmsMessageSid`, `AccountSid`, `MessagingServiceSid`, `From`, `To`, `Body`, `NumMedia`, `NumSegments`, `MediaUrl{N}` and `MediaContentType{N}`, `ApiVersion`, and the geographic fields (`FromCountry`, `ToCountry`, ...) when known. WhatsApp adds `ProfileName` and `WaId`.
- Headers: `X-Twilio-Signature` (HMAC-SHA1 of the full URL plus sorted parameters with the configured auth token, see [05-webhooks.md](05-webhooks.md#provider-formats)), `I-Twilio-Idempotency-Token`, `User-Agent: TwilioProxy/1.1`.

### The reply (TwiML)

SendMock reads the response body as TwiML when it is `text/xml` or `application/xml`:

```xml
<Response>
  <Message statusCallback="http://localhost:8000/sms/status">Thanks, your booking is confirmed.</Message>
</Response>
```

| TwiML | Behaviour |
|-------|-----------|
| `<Message>` text, or `<Body>` and `<Media>` children | stored as an outbound reply in the same thread, linked to the inbound message (`in_reply_to_sms_id`), sent through the normal delivery simulation |
| `to` and `from` attributes | override the reply's recipient and sender (default: back to the sender, from the number that was texted) |
| `statusCallback` | status callbacks for the reply, as for any sent message |
| `action` and `method` | called once the reply is sent, with `MessageStatus`; its TwiML response is processed the same way |
| `<Redirect>` | fetches TwiML from another URL and processes it |
| empty `<Response/>` or `204` | no reply, success |

Several `<Message>` verbs create several replies, in order. To stop loops, one inbound message can trigger at most 10 TwiML fetches (redirects and actions included).

### Errors

Failures use Twilio's error codes and are shown on the inbound message (drawer and conversation), in the API request log, and on the `sms.inbound` event:

| Problem | Twilio error |
|---------|--------------|
| non-2xx response, or no answer within 15 seconds | 11200 HTTP retrieval failure |
| connection refused or reset | 11205 HTTP connection failure |
| body is not valid TwiML | 12100 Document parse failure |
| unsupported `Content-Type` | 12300 Invalid Content-Type |

When the primary URL fails and a fallback URL is set, SendMock calls the fallback with the same request plus `ErrorCode` and `ErrorUrl`, as Twilio does. Reply webhooks are not retried (Twilio does not retry them either); use **Resend reply webhook** in the message drawer after fixing the handler.

### UI, API and CLI

- Conversation view: inbound bubbles show the webhook result (status code, or the Twilio error code); replies created from TwiML carry a "TwiML reply" badge.
- Message drawer: a **Reply webhook** tab with the request, the response and the parsed TwiML, plus **Resend reply webhook**.
- Numbers: inbound URL, method and fallback URL per number; Messaging Services: the inbound setting (send a webhook, defer to sender, drop).
- API: `POST /api/v1/sms/{smsId}/reply-webhook/resend`; CLI: `sendmock sms reply-webhook resend <smsId>`; MCP: `sendmock_sms_reply_webhook_resend`.

Other providers' reply mechanisms (Plivo XML, for example) can be added later as new adapters; providers without one (Vonage) only get the inbound webhook.

## MMS and media

MMS (and WhatsApp images and documents) carry files next to the text. Providers do not take files inline: Twilio takes public `MediaUrl` links and downloads them. SendMock supports that, and also accepts inline files on the native API, because local files have no public URL.

### Sending

| API | How media is passed | What SendMock does |
|-----|---------------------|--------------------|
| Twilio Messages (Phase 2) | `MediaUrl` form field, repeatable, up to 10 | downloads each URL and keeps a copy, so the conversation still shows it if the app's URL goes away; a URL that cannot be fetched fails the message with `11200`, as Twilio does (the other media error codes come from Twilio's error reference when the Messages API is built) |
| Native `POST /api/v1/sms` | `media_urls: ["https://..."]` and / or `media: [{ "filename", "content" (base64), "content_type" }]`, same shape as email attachments | URL media is downloaded like Twilio's; inline media is decoded and stored |
| Simulated inbound (`POST /api/v1/sms/inbound`, "Reply as recipient") | `media: [...]` inline | stored like inline media |

- Each message has at most 10 media items and 5 MB of media in total (Twilio's MMS limit). `content_type` is guessed from the file extension when missing.
- Errors return `400` naming the item, for example `media[2].content is not valid base64`, `media[0].filename is required` or `media goes over the 5 MB limit`.
- Every stored file is served at `GET /api/v1/sms/{smsId}/media/{mediaIndex}` with its content type. The reply webhook sends `NumMedia`, `MediaUrl{N}` and `MediaContentType{N}` pointing at these copies, and TwiML `<Media>` replies are stored the same way.
- A message with media is an MMS on the `sms` channel; WhatsApp uses the same fields. Segment counting covers the text only.
- In the browser demo, media sent as URLs cannot be downloaded, so they show a placeholder image with the URL.

### UI

- Bubbles show images as thumbnails (a click opens the full image) and other files as chips with name, size and a download link; messages with media get an "MMS" badge (a "Media" badge on WhatsApp). A media-only message shows "Photo" or "Attachment" in the thread list preview.
- The message drawer lists the media with type, size, source URL and download.
- "Reply as recipient" has an attach button for one or more files, shown as removable chips before sending, with the same limits.
- Settings > Connection adds `media` and `media_urls` chips to the SMS body; `{{file:...}}` values are read and encoded by each snippet.

## Virtual numbers

A small registry (UI: "Numbers") of fake owned numbers, each with:

- Label (e.g. "Support line").
- Channel capabilities (SMS, WhatsApp).
- Inbound webhook URL, method, fallback URL and format (mirrors how you configure a number in a provider console; see [Reply webhook](#reply-webhook-twilio-style)).
- Status callback default.
- Optional Messaging Service membership (sender pool).

Not required for basic sending; any `from` is accepted.

## UI

Phone-style conversation view grouped by number pair, segment/encoding badges, status timeline, OTP "copy" button, and a composer for inbound simulation. Details in [07-ui.md](07-ui.md).
