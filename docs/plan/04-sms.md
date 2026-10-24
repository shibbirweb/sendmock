# 04. SMS Gateway

## Behaviour

MessageHook pretends to be an SMS vendor. Your app "sends" SMS by making the same HTTP calls it makes to a real provider, but pointed at MessageHook. Messages are stored, shown in a phone-style UI, and given simulated delivery statuses. Nothing is ever sent to a carrier.

It also works in the other direction: you can **simulate an incoming SMS** (a user replying "STOP" or texting a keyword) and MessageHook calls your app's inbound webhook exactly like the provider would.

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

Each emulated endpoint:

- Validates required params and returns the provider's error shape and HTTP status for invalid requests (missing `To`, bad number, empty body).
- Returns a response body shaped like the provider's (IDs like `SM` + 32 hex for Twilio).
- Accepts any credentials by default; optionally enforces configured ones to test auth errors.
- Honours provider-specific callback params (`StatusCallback` for Twilio, account-level DLR URL for Vonage).

The exact field coverage per provider is tracked in a compatibility table in user docs, verified against each provider's official SDK in tests.

### Messaging Services (Twilio)

Many apps send with `MessagingServiceSid` instead of `From`. MessageHook:

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
  - Always available via `/api/v1/otp?to=...`, the CLI (`messagehook otp`) and MCP (`messagehook_otp_get`).
- **Realistic rules:** 10 minute expiry (configurable), max 5 check attempts then error `60202`, max send attempts then `60203`, unknown verification `20404`, expired returns `20404` like the real API.
- **Force a state:** UI buttons and API (`POST /api/v1/verify/{verificationId}/force` with `approved`, `canceled`, `expired`, `max_attempts`) to test edge cases.
- **Events:** `verify.started`, `verify.checked` (with `approved` true/false), `verify.expired`; available to webhook rules.
- **UI:** a **Verify** tab in the SMS screen listing verifications with status, channel, code, attempts and timeline.

Later: Vonage Verify v2 and other providers' verify APIs using the same internal model.

## WhatsApp via Twilio

Twilio sends WhatsApp through the same Messages API with `whatsapp:` prefixed addresses. MessageHook accepts them, stores the channel (`sms` or `whatsapp`), shows a WhatsApp badge and chat styling, supports `read` status for the opened/read flow, and sends inbound WhatsApp messages to the app in Twilio format. Template (content SID) sends are stored with their variables. (Phase 4; full WhatsApp Business Cloud API emulation stays in the backlog.)

## API request log

Every request to the native and provider SMS APIs (and the email HTTP send APIs) is logged, **including rejected ones** (400 bad number, 401 bad credentials, 404 unknown service), with method, path, headers (credentials masked), body, the exact response returned and timing. This answers "why did my SDK call fail?" without guessing.

- Stored in `api_requests` (bodies capped at 64 KB), same retention as messages.
- UI: **Logs > HTTP** with filters (provider, status class, path), linked from each accepted message.
- API: `/api/v1/logs/http`.

### 3. Provider SDK usage

Two ways an app can use its normal provider SDK against MessageHook:

1. **Base URL / host override**, where the SDK supports it.
2. **Custom HTTP client** that rewrites the provider host to MessageHook (most official SDKs accept an injectable HTTP client).

Per-SDK instructions live in [08-integrations.md](08-integrations.md). Confirming the cleanest method for each official SDK is a Phase 4 task.

## Message processing

1. Parse request, normalise numbers to E.164 when possible (keep the raw value too).
2. Compute **encoding and segments**: GSM-7 (160 chars single, 153 per segment when concatenated, with extension-table characters counting as 2) vs UCS-2 (70 / 67). Shown in the UI because it affects real-world cost.
3. Run extractors (OTP codes, links), same as email.
4. Store, publish `sms.sent` event (meaning "your app sent an SMS to MessageHook").
5. Schedule simulated status transitions.

## Delivery simulation

Configurable globally (UI settings) and per request (via magic numbers):

| Setting | Default | Meaning |
|---------|---------|---------|
| Profile | `instant` | `instant` (delivered immediately), `realistic` (queued -> sent after ~300 ms -> delivered after ~1-3 s), `manual` (stays `sent` until you click a status in the UI) |
| Failure rate | 0% | random fraction marked `undelivered` / `failed` |
| Magic numbers | on | numbers that always produce a specific outcome |

Magic numbers follow **Twilio's official test numbers and error codes exactly** ([Twilio test credentials](https://www.twilio.com/docs/iam/test-credentials)), so tests written against MessageHook also match Twilio's own test mode. The error is returned synchronously on send (HTTP 400 with Twilio's error JSON), as Twilio does.

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

MessageHook extensions for **after-send** outcomes (Twilio's test mode has no equivalent because it never sends status callbacks):

| To number | Result | Error code in callback |
|-----------|--------|------------------------|
| `+15005550101` | accepted, then `undelivered` (unreachable handset) | 30003 |
| `+15005550102` | accepted, then `undelivered` (landline / unreachable carrier) | 30006 |
| `+15005550103` | accepted, then `undelivered` (filtered by carrier) | 30007 |
| `+15005550104` | accepted, then `failed` (unknown error) | 30008 |
| `+15005550105` | accepted, delivered after 30 s (slow delivery) | |
| `+15005550106` | accepted, delivered, then `read` (WhatsApp/RCS style) | |

Other providers (Vonage, Plivo, ...) map the same outcomes to their own error codes and status names. The full table is shown in Settings > SMS simulation.

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

MessageHook stores it with direction `inbound` and publishes `sms.inbound`. Webhook rules (or the number's configured inbound URL) deliver it to your app in the chosen provider format, for example a Twilio-style `application/x-www-form-urlencoded` POST with `From`, `To`, `Body`, `MessageSid`, plus an `X-Twilio-Signature` header computed with the configured auth token.

If your app responds with TwiML containing `<Message>`, MessageHook can parse it and record the reply as an outbound SMS, so two-way conversations can be tested end to end (Phase 4).

## Virtual numbers

A small registry (UI: "Numbers") of fake owned numbers, each with:

- Label (e.g. "Support line").
- Channel capabilities (SMS, WhatsApp).
- Inbound webhook URL and format (mirrors how you configure a number in a provider console).
- Status callback default.
- Optional Messaging Service membership (sender pool).

Not required for basic sending; any `from` is accepted.

## UI

Phone-style conversation view grouped by number pair, segment/encoding badges, status timeline, OTP "copy" button, and a composer for inbound simulation. Details in [07-ui.md](07-ui.md).
