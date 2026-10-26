# 22. Configurable Email and SMS Providers

SendMock answers the real APIs of 15 providers ([providers](../wiki/providers.md)). Payment gateways are already data, not code ([17](17-payments.md#gateways-and-payment-methods-configurable)): a developer edits a built-in, adds a gateway SendMock does not ship, and resets to the shipped behaviour. Email and SMS providers are still fixed adapters, which leaves three gaps:

- **A provider SendMock does not ship.** Regional SMS vendors (SSL Wireless, Infobip, Africa's Talking) and smaller email APIs cannot be tested at all, or only through the planned "Generic HTTP" SMS adapter, which covers a request but not the provider's real responses and errors.
- **A built-in that differs from the account in use:** another API version, an extra required field, a different message id format, a status name the app checks for.
- **Providers the team does not use** still show in pickers, lists and the Settings > Connection snippets.

This plan makes email and SMS providers work like payment gateways: every provider is a definition the user can change, remove or add to, the built-ins are definitions too, and **Reset to default** brings back the shipped one.

Features: **EM-18 Configurable email providers** and **SM-16 Configurable SMS providers** ([criteria](acceptance/01-email.md#em-18-configurable-email-providers), [SMS](acceptance/02-sms-verify.md#sm-16-configurable-sms-providers)). Work item **W16** in [Phase U3](18-phase-u3.md): the UI, the contract and the mock API in Stage A; the runtime in Stage B (Phase 2 for the SMS built-ins, Phase 4 for email providers and custom providers).

## 1. What a provider is

A provider is one definition, in one area (email or SMS):

| Part | What it holds |
|------|---------------|
| Identity | name, key (the `/providers/<key>/...` path and the `provider` value stored on each message), accent colour, enabled |
| Host | the provider's API host (`api.sendgrid.com`), used on the provider port to route by `Host` when two providers share a path |
| Credentials | name / value rows (API key, account SID, auth token), each marked secret or not, masked everywhere like gateway credentials; **Check credentials** off by default, on means wrong ones get the provider's `401` answer |
| Operations | one or more requests it answers: kind, method, path template (`/v3/{domain}/messages`) and request format (JSON, form, multipart or query) |
| Field mapping | for a send, where each part of the message is read from in the request, as a path (`personalizations[0].to[*].email`, the form field `To`); anything unmapped is kept as metadata |
| Validation | required fields and checks (email address, E.164 number, body length), each naming the error response it returns |
| Responses | the success status, headers and body template, and one error response per error kind (missing field, invalid value, unauthorized, not found, rate limited) |
| Message id | a template for the provider's id (`SM{{ random_hex(32) }}`, `<{{ uuid() }}@sendmock.local>`) |
| Callbacks | the [webhook template](13-webhook-templates.md) used for its status callbacks and inbound messages, and its status names for each SendMock status (Twilio `delivered`, Vonage DLR `status=delivered`) |
| Error codes (SMS) | the provider's error code for each delivery outcome, so the magic test numbers fail with the provider's own codes |

Operation kinds come from a fixed catalogue that SendMock knows how to run:

| Area | Kinds |
|------|-------|
| Email | send, send batch, send with template, fetch one |
| SMS | send, fetch one, list, cancel, start verification, check verification |

A new kind (one SendMock cannot run yet) still needs code: one entry in the kind registry and its handler, like a new payment flow step.

Templates use the same engine, functions and filters as webhook templates and gateways. They read `request` (method, path, headers, body), `message` (id, provider id, from, to, subject or body, status), `error` (kind, field, reason), `credentials` (by name) and the functions `uuid()`, `random_hex(length)`, `now_iso()` and `now_unix()`.

## 2. Built-ins

- The built-ins are definitions that reproduce the shapes in [03](03-email.md#http-send-apis) and [04](04-sms.md#2-provider-emulation) exactly: email SendGrid, Mailgun, Postmark, Resend, Amazon SES and Brevo; SMS Twilio, Twilio Verify, Vonage, Plivo and MessageBird. "Generic HTTP" stops being an adapter: it becomes **Add provider > Blank**.
- The provider fixture tests and SDK tests (EM-08, SM-02, SM-04, SM-05 and VF-03) run against the shipped definitions, so a built-in still matches the real provider. Twilio's test numbers and error codes stay exact.
- An edited built-in shows **Modified**. **Reset to default** restores the shipped definition, after asking.
- **Remove** takes a built-in out of routing, pickers and snippets. It moves to a **Removed** group on the list, where **Restore** brings it back as it was. A request to a removed provider's paths gets SendMock's native `404` error, and the request log shows why.
- The SendMock native API (`POST /api/v1/send`, `POST /api/v1/sms`) is not a provider and cannot be edited or removed.

## 3. Custom providers

- **Add provider** starts from blank or from the closest built-in, whose definition is copied and then edited.
- A custom provider can be deleted at any time. Messages it caught keep its name as text and show "deleted provider" in their detail.
- Its key must be unique in its area. Its paths must not clash with another enabled provider's (same method and path on the provider port, without a different host); a save that would clash is refused and names the other provider.
- Changes apply to the next request, with no restart.

## 4. Screens

- **Mail > Providers** (`/mail/providers`) and **SMS > Providers** (`/sms/providers`), shaped like Payments > Gateways. Mail gets children in the sidebar (Inbox, Providers); SMS gets Providers after Verify. The command palette and `G` shortcuts follow the sidebar.
- **The list:** name, key, built-in or custom, Modified, enabled, and messages in the last 24 hours. A **Removed** group shows removed built-ins with Restore. **Add provider** opens a dialog: name, key, and start from blank or a built-in.
- **The provider sheet** has tabs:
  - **General:** name, key, host, accent, enabled, credentials and Check credentials.
  - **Requests:** the operations, the field mapping of the send and the validation rules.
  - **Responses:** the success and error responses with their templates.
  - **Callbacks:** the webhook template and the status names (and, for SMS, the error code per outcome).
  - **Preview:** a sample request (from the provider's example, or edited), the message SendMock would store, and the response it would return, with problems under each part. A save with template errors, an invalid path or a clash is refused with the reason.
  - **Try it:** a ready `curl` command and the SDK base URL for this provider.
- A message's detail shows its provider as a badge that opens the provider's sheet.
- **Settings > Connection** builds its provider snippets from the enabled providers, custom ones included.

## 5. Every surface

Like gateways, providers are operations in the registry, so all four ways and the parity check ([20](20-surface-parity.md)) cover them:

| Operation | REST | CLI | MCP |
|-----------|------|-----|-----|
| List | `GET /email/providers` | `sendmock email providers list` | `sendmock_email_provider_list` |
| Get | `GET /email/providers/{providerKey}` | `sendmock email providers get <providerKey>` | `sendmock_email_provider_get` |
| Create | `POST /email/providers` | `sendmock email providers create` | `sendmock_email_provider_create` |
| Update | `PATCH /email/providers/{providerKey}` | `sendmock email providers update <providerKey>` | `sendmock_email_provider_update` |
| Delete or remove | `DELETE /email/providers/{providerKey}` | `sendmock email providers delete <providerKey>` | `sendmock_email_provider_delete` |
| Restore | `POST /email/providers/{providerKey}/restore` | `sendmock email providers restore <providerKey>` | `sendmock_email_provider_restore` |
| Reset | `POST /email/providers/{providerKey}/reset` | `sendmock email providers reset <providerKey>` | `sendmock_email_provider_reset` |
| Preview | `POST /email/providers/{providerKey}/preview` | `sendmock email providers preview <providerKey>` | `sendmock_email_provider_preview` |

SMS has the same eight under `/sms/providers`, `sendmock sms providers` and `sendmock_sms_provider_*`. `DELETE` removes a built-in (restorable) and deletes a custom provider.

- Secrets are masked in every answer; a masked value sent back keeps the stored one; MCP never reveals them (the existing exemption).
- The agent skill gets `add-email-provider` and `add-sms-provider` workflows (and MCP prompts of the same names): the agent reads the provider's API docs, writes the definition, checks the preview, sends a test request with the provider's SDK or `curl`, and exports the result to the seed file.
- The seed file stores changed built-ins and custom providers under `[[email.providers]]` and `[[sms.providers]]`, secrets as `${ENV}` references.

## 6. Build steps

Stage A, against the mock API (each step is one commit, approved before the next):

1. Plan and criteria (this document, EM-18, SM-16).
2. Contract: the types and endpoint registry for the 16 operations, the regenerated spec, the surface catalogue entries and the CLI and MCP reference.
3. Mock data: the 11 built-in definitions from plans 03 and 04, custom provider handling, and mock handlers for every operation.
4. Screens: the two lists, the Removed group and the Add provider dialog.
5. Screens: the provider sheet (General, Requests, Responses, Callbacks) and the preview.
6. Wiring: sidebar children, palette and shortcuts, the provider badge on messages, and Settings > Connection reading the providers.
7. Docs: menu pages for Mail > Providers and SMS > Providers, "Advanced: create an email provider" and "Advanced: create an SMS provider" walkthroughs, the providers page and screenshots.
8. Tests: a test per criterion, the surface parity check, and the guide walkthrough tests (WS-06.4).

Stage B: the runtime that answers requests from the definitions, the SMS built-ins in Phase 2, email providers and custom providers in Phase 4.

## 7. Open points

- **Twilio Verify** has more state than a plain send (pending, approved, canceled, expired, attempts). Its definition edits responses, labels and status names, but the verification state machine itself stays code.
- **Provider-specific signing of callbacks** (Twilio's `X-Twilio-Signature`) stays in the template functions, as for gateways; a new signature scheme needs a new function.
