# 22. Configurable Email and SMS Providers

SendMock answers the real APIs of 15 providers ([providers](../wiki/providers.md)). Payment gateways are already data, not code ([17](17-payments.md#gateways-and-payment-methods-configurable)): a developer edits a built-in, adds a gateway SendMock does not ship, and resets to the shipped behaviour. Email and SMS providers are still fixed adapters, which leaves three gaps:

- **A provider SendMock does not ship.** Regional SMS vendors (SSL Wireless, Infobip, Africa's Talking) and smaller email APIs cannot be tested at all, or only through the planned "Generic HTTP" SMS adapter, which covers a request but not the provider's real responses and errors.
- **A built-in that differs from the account in use:** another API version, an extra required field, a different message id format, a status name the app checks for.
- **Providers the team does not use** still show in pickers, filters and the Settings > Connection snippets.

This plan makes email and SMS providers work like payment gateways: every provider is a definition the user can change, remove or add to, the built-ins are definitions too, and **Reset to default** brings back the shipped one.

Features: **EM-18 Configurable email providers** and **SM-16 Configurable SMS providers** ([email criteria](acceptance/01-email.md#em-18-configurable-email-providers), [SMS criteria](acceptance/02-sms-verify.md#sm-16-configurable-sms-providers)). Work item **W16** in [Phase U3](18-phase-u3.md), inside the sign-off gate because it changes the contract: the UI, the contract and the mock API in Stage A; the runtime in Stage B.

## 1. Decisions

| Question | Decision |
|----------|----------|
| Same model as payment gateways? | Yes: definitions with Modified, Reset to default, add from blank or from a built-in, a live preview, masked credentials with an explicit reveal, and every operation in REST, CLI and MCP. |
| Can a built-in be deleted? | It can be **removed**: taken out of routing, pickers, filters and snippets, listed in a Removed group, and brought back unchanged with **Restore**. Only custom providers are deleted for good. This differs from gateways (built-ins can only be disabled) because the owner wants unused providers gone from the app. |
| What happens to messages of a deleted provider? | They stay. They keep the provider's key and name as text and show "deleted provider". |
| Where do the screens live? | **Mail > Providers** and **SMS > Providers**, as children in the sidebar, like Payments > Gateways. |
| What are the REST paths? | `/api/v1/emails/providers` and `/api/v1/sms/providers`, next to `/emails/latest` and `/sms/threads`. |
| How do messages name their provider? | By provider key. `Email.source` keeps `smtp`, `sendmail`, `native_api`, `verify` and `simulated` and takes any email provider key for API sends; `SmsMessage.api` keeps `native` and takes any SMS provider key. Both become strings in the contract instead of closed lists. |
| What becomes of the planned "Generic HTTP" SMS adapter? | It is dropped: **Add provider > Blank** replaces it, with real responses and errors. The `generic` value leaves `SmsApi`. The demo data ships one custom SMS provider, **SSL Wireless**, so the feature is visible from the first run. |
| Is the SendMock native API a provider? | No. `POST /api/v1/send` and `POST /api/v1/sms` are SendMock's own API and are not listed, edited or removed. |
| What stays in code? | The operation kinds (section 3), Twilio Verify's verification state machine, and template functions such as signature helpers. A new kind or signature scheme is one registry entry and its handler. |

## 2. The provider definition

One type serves both areas, `MessageProviderDefinition` (`web/src/lib/api/types/message-providers.ts`, parts in `message-provider-parts.ts`):

| Field | Type | What it holds |
|-------|------|---------------|
| `key` | string | lowercase, unique in its area, fixed after creation; the `/providers/<key>/...` path and the value stored on each message |
| `name` | string | shown on messages, badges, pickers and filters |
| `area` | `email` or `sms` | fixed |
| `accent` | `#rrggbb` | the badge colour |
| `is_enabled` | boolean | off: its paths get SendMock's native `404`, and it is hidden from pickers |
| `host` | string or null | the provider's API host, to route by `Host` on the provider port when two providers share a path |
| `credentials` | list of name, value, is_secret | what the app is configured with; secrets masked as `••••` plus the last 4, a masked value sent back keeps the stored one, the plain value only through the reveal operation |
| `check_credentials` | boolean | off by default (any credentials pass); on: wrong ones get the `unauthorized` answer |
| `operations` | list of kind, method, path, request_format | the requests it answers; `path` uses `{name}` for variable parts; `request_format` is `json`, `form`, `multipart` or `query` |
| `field_mapping` | list of part, source | where each message part is read from: a JSON path (`personalizations[0].to[*].email`), a form field (`To`) or a query parameter; unmapped fields are kept as metadata |
| `validation_rules` | list of part, check, max_length, error_kind | checks `required`, `email_address`, `e164_number` or `max_length`, each naming the error it answers |
| `success_response` | status, headers, body | the answer to a request that passes every check |
| `error_responses` | list of kind, status, headers, body | one answer per error kind: `missing_field`, `invalid_value`, `unauthorized`, `not_found`, `rate_limited` |
| `message_id_template` | string | the provider's id for each message |
| `callback_template_key` | string or null | the [webhook template](13-webhook-templates.md) for its status callbacks and inbound messages |
| `status_names` | map | the provider's name for each SendMock status |
| `outcome_error_codes` | map (SMS) | the provider's error code for each delivery outcome, so the magic test numbers fail with its own codes |
| `is_builtin`, `is_modified`, `is_removed`, `message_count_24h` | read only | shown on the list and the sheet |

**Message parts** a mapping or rule can name: email `from`, `to`, `cc`, `bcc`, `reply_to`, `subject`, `text`, `html`, `attachments`, `headers`, `tags`, `template_id`, `template_data`; SMS `from`, `to`, `body`, `media_urls`, `messaging_service`, `status_callback_url`.

**Templates** (bodies, headers, the message id) use the webhook template engine with its filters, and read:

| Variable | Holds |
|----------|-------|
| `request` | `method`, `path`, `path_params` (`{domain}` and so on), `headers`, `query`, `body` (parsed) |
| `message` | `id` (SendMock's ULID), `provider_id`, `from`, `to`, `subject`, `body`, `status`, `created_at` |
| `error` | `kind`, `part`, `reason` (in error responses) |
| `credentials` | the credential values by name |
| functions | `uuid()`, `random_hex(length)`, `now_iso()`, `now_unix()`, and the existing signature helpers |

## 3. Operation kinds

| Area | Kind | What SendMock does |
|------|------|--------------------|
| Email | `send` | stores one email from the mapped parts and answers |
| Email | `send_batch` | stores one email per item of a list (Postmark batch, Resend batch) |
| Email | `send_with_template` | stores the template id and data, and renders a local template registered under that id (EM-08.4) |
| Email | `fetch` | answers one sent message by its provider id |
| SMS | `send` | stores one message (segments, encoding, magic numbers and status callbacks as in [04](04-sms.md)) |
| SMS | `fetch` | answers one message by its provider id |
| SMS | `list` | answers the messages, newest first, in the provider's paging shape |
| SMS | `cancel` | cancels a queued message |
| SMS | `start_verification`, `check_verification` | run Twilio Verify's state machine ([04](04-sms.md#twilio-verify)) |

Each kind has a fixed set of message parts it reads and a default sample request for the preview.

## 4. Built-ins

The built-ins are definitions that reproduce the requests, responses and errors in [03](03-email.md#http-send-apis) and [04](04-sms.md#2-provider-emulation). Their field mappings follow each provider's API reference; the main ones:

| Key | Name | Host | Operations | Format | Message id | Main fields |
|-----|------|------|------------|--------|------------|-------------|
| `sendgrid` | SendGrid | `api.sendgrid.com` | send `POST /v3/mail/send` | JSON | the `X-Message-Id` header | `personalizations[*].to[*].email`, `from.email`, `subject`, `content[]`, `attachments`, `template_id`, `personalizations[0].dynamic_template_data` |
| `mailgun` | Mailgun | `api.mailgun.net` | send `POST /v3/{domain}/messages` | multipart | `<timestamp.random@{domain}>` | `to`, `from`, `subject`, `text`, `html`, `attachment`, `o:tag`, `h:*`, `v:*` |
| `postmark` | Postmark | `api.postmarkapp.com` | send `POST /email`, send_batch `POST /email/batch`, send_with_template `POST /email/withTemplate` | JSON | UUID | `From`, `To`, `Cc`, `Bcc`, `Subject`, `TextBody`, `HtmlBody`, `Attachments`, `Tag`, `TemplateId`, `TemplateModel` |
| `resend` | Resend | `api.resend.com` | send `POST /emails`, send_batch `POST /emails/batch`, fetch `GET /emails/{id}` | JSON | UUID | `from`, `to`, `cc`, `bcc`, `reply_to`, `subject`, `text`, `html`, `attachments`, `tags` |
| `ses` | Amazon SES | `email.us-east-1.amazonaws.com` | send `POST /v2/email/outbound-emails` | JSON | `MessageId`, as SES returns it | `FromEmailAddress`, `Destination.ToAddresses`, `Content.Simple.Subject.Data`, `Content.Simple.Body.Text.Data`, `Content.Simple.Body.Html.Data` |
| `brevo` | Brevo | `api.brevo.com` | send `POST /v3/smtp/email` | JSON | `<random@smtp-relay.mailin.fr>` | `sender.email`, `to[*].email`, `subject`, `textContent`, `htmlContent`, `attachment`, `templateId`, `params` |
| `twilio` | Twilio | `api.twilio.com` | send `POST /2010-04-01/Accounts/{AccountSid}/Messages.json`, fetch and cancel `.../Messages/{MessageSid}.json`, list `.../Messages.json` | form | `SM` + 32 hex | `To`, `From`, `Body`, `MediaUrl`, `MessagingServiceSid`, `StatusCallback` |
| `twilio_verify` | Twilio Verify | `verify.twilio.com` | start_verification `POST /v2/Services/{ServiceSid}/Verifications`, check_verification `POST /v2/Services/{ServiceSid}/VerificationCheck` | form | `VE` + 32 hex | `To`, `Channel`, `Code` |
| `vonage` | Vonage | `rest.nexmo.com` | send `POST /sms/json` | form or JSON | hex `message-id` | `to`, `from`, `text` |
| `plivo` | Plivo | `api.plivo.com` | send `POST /v1/Account/{auth_id}/Message/` | JSON | UUID | `src`, `dst`, `text` |
| `messagebird` | MessageBird | `rest.messagebird.com` | send `POST /messages` | JSON | 32 hex | `originator`, `recipients`, `body` |

- The shipped definitions live in `web/src/mocks/fixtures/email-provider-fixtures.ts` and `sms-provider-fixtures.ts` (Stage A) and in the Rust provider registry (Stage B), generated from one source so the two never drift.
- The provider fixture tests and SDK tests (EM-08, SM-02, SM-04, SM-05 and VF-03) run against the shipped definitions, so a built-in still matches the real provider. Twilio's test numbers and error codes stay exact.
- **The demo's custom provider, SSL Wireless** (`sslwireless`), shows a regional vendor added from blank. Its definition is modelled on the vendor's public API documentation when the fixture is written, and is marked in the demo as an example, not a supported built-in.

## 5. Rules

- **Keys:** lowercase letters, digits and `_`, 2 to 32 characters, unique in the area. `native` is reserved.
- **Paths:** must start with `/`, may use `{name}` parts, and must not start with `/api/` or `/providers/`. Two enabled providers in one area may not answer the same method and path unless their hosts differ. A save that would clash is refused and names the other provider.
- **Removing a built-in** keeps its definition; Restore brings it back as it was (edited or not). Reset to default works on removed built-ins too.
- **Disabling** keeps a provider listed but answers nothing, like a removed one.
- **Deleting a custom provider** asks first, naming how many messages it caught; those messages keep its key and name as text.
- **Changes** apply to the next request, with no restart.
- **Templates** are checked on save: unknown variables, unclosed `{{` and invalid JSON in a JSON body are errors; an empty value is a warning. Saves with errors are refused, as for gateways.
- **Secrets** are masked in every API answer, the UI, logs, the request log and MCP output, and are written to seed exports as `${ENV}` references.

## 6. Contract

### New types

`MessageProviderDefinition`, `MessageProviderInput` (the definition without `area` and the read-only fields), `MessageProviderCreateRequest` (`name`, `key`, `start_from`), `MessageProviderPreviewRequest` (`provider`, optional `sample_request`), `MessageProviderPreview` (`operation_kind`, `stored_message`, `response`, `problems`, `reference`), `ProviderSampleRequest`, `ProviderCredentialReveal`, and the parts (`ProviderOperation`, `ProviderFieldMapping`, `ProviderValidationRule`, `ProviderResponseTemplate`, `ProviderErrorResponse`, `ProviderCredential`, `ProviderDefinitionProblem`). Every request field has a description and an example (WS-07).

### Changed types

- `EmailSource` becomes `"smtp" | "sendmail" | "native_api" | "verify" | "simulated" | string` (a provider key), documented as such.
- `SmsApi` becomes `"native" | string`; `generic` is gone.
- The email list's `source` filter and the SMS list's `api` filter accept provider keys; the UI builds their options from the providers API.

### Operations

Nine per area, 18 in all. Email:

| REST | CLI | MCP | UI |
|------|-----|-----|----|
| `GET /api/v1/emails/providers` | `sendmock email providers list` | `sendmock_email_provider_list` | Mail > Providers |
| `POST /api/v1/emails/providers` | `sendmock email providers create` | `sendmock_email_provider_create` | Mail > Providers > Add provider |
| `GET /api/v1/emails/providers/{providerKey}` | `sendmock email providers show <providerKey>` | `sendmock_email_provider_get` | Mail > Providers > provider |
| `PATCH /api/v1/emails/providers/{providerKey}` | `sendmock email providers update <providerKey>` | `sendmock_email_provider_update` | Mail > Providers > provider > Save provider |
| `DELETE /api/v1/emails/providers/{providerKey}` | `sendmock email providers delete <providerKey>` | `sendmock_email_provider_delete` | Mail > Providers > provider > Remove or Delete |
| `POST /api/v1/emails/providers/{providerKey}/restore` | `sendmock email providers restore <providerKey>` | `sendmock_email_provider_restore` | Mail > Providers > Removed > Restore |
| `POST /api/v1/emails/providers/{providerKey}/reset` | `sendmock email providers reset <providerKey>` | `sendmock_email_provider_reset` | Mail > Providers > provider > Reset to default |
| `POST /api/v1/emails/providers/{providerKey}/preview` | `sendmock email providers preview <providerKey>` | `sendmock_email_provider_preview` | Mail > Providers > provider > Preview |
| `GET /api/v1/emails/providers/{providerKey}/credentials/{credentialName}` | `sendmock email providers credential <providerKey> <credentialName> --reveal` | none: agents never read secrets back | Mail > Providers > provider > General > Reveal |

SMS has the same nine under `/api/v1/sms/providers`, `sendmock sms providers` and `sendmock_sms_provider_*`, in SMS > Providers. `DELETE` removes a built-in (restorable) or deletes a custom provider, both `204`; `404` for an unknown key, `400` for a refused save, `409` for a key that exists or a restore or reset that does not apply.

- The surface catalogue gets the 18 entries; the MCP tools fall into the existing `email` and `sms` toolsets by their prefix.
- `bun run openapi` regenerates `docs/api/openapi.yaml`, `cli-reference.json` and `mcp-tools.json`, and the website's API, CLI and MCP references pick them up.
- The path parameter `providerKey` is documented; `credentialName` is reworded for gateways and providers.

## 7. Screens

### Sidebar and navigation

- **Mail** gets one child, **Providers** (`/mail/providers`). **SMS** gets **Providers** after Verify (`/sms/providers`). The command palette and the shortcut list follow the sidebar, as they are built from it.

### The providers list

Built like Payments > Gateways (`web/src/features/providers/`, shared by both areas through an `area` prop):

- A header with the title, a one-line description and **Add provider**.
- A table: the provider's name with its accent dot and Built-in or Custom badge, key, Modified, an enabled switch, messages in the last 24 hours, and a menu (Edit, Duplicate, Reset to default, Remove or Delete).
- A **Removed** group under the table when a built-in is removed, each row with **Restore**.
- An empty state is not needed for built-ins (the list always has them unless all are removed); when every provider is removed, a card explains how to restore them.

### Add provider

A dialog with **Name**, **Key** (filled from the name, editable until saved) and **Start from**: Blank or one of the area's providers. Saving opens the new provider's sheet on the General tab.

### The provider sheet

A sheet with a header (name, key, badges, enabled switch), tabs, and a footer (Save provider, Cancel, and Reset to default, Remove or Delete in a menu):

- **General:** name, key (read only after creation), accent, host, credentials as name / value rows with Secret and Reveal (after a confirmation), and Check credentials.
- **Requests:** the operations as rows (kind, method, path, request format; add, remove, reorder), the field mapping of the send (one row per message part, with the source path and an example of what it reads), and the validation rules (part, check, max length, error).
- **Responses:** the success response (status, headers, body template) and one card per error kind, with `{{` suggestions from the template reference, as on the gateway notification tab.
- **Callbacks:** the webhook template (a picker with a link to Webhooks > Templates), the status names, and for SMS the error code per outcome.
- **Preview:** the sample request (method, path, headers, body; filled from the kind's default, editable), and side by side the message SendMock would store and the response it would return, with problems listed under each part. It reruns as the definition changes.
- **Try it:** a ready `curl` command to the provider port, the SDK base URL, and a link to the language snippets in Settings > Connection.

Confirmations: Reset to default ("Put SendGrid back as shipped? Your changes are lost."), Remove ("Remove SendGrid? Requests to its paths get a 404 until you restore it."), Delete ("Delete SSL Wireless? Its 12 messages stay, marked deleted provider.").

### Elsewhere

- A message's detail shows its provider as a badge that opens the provider's sheet; a deleted provider shows "deleted provider".
- The Mail and SMS filters list the providers from the API, removed and deleted ones only when messages still use them.
- **Settings > Connection** builds its provider snippets from the enabled providers, custom ones included.

## 8. Mock API (Stage A)

Built like the gateways in `web/src/mocks`:

| File | Job |
|------|-----|
| `fixtures/email-provider-fixtures.ts`, `fixtures/sms-provider-fixtures.ts` | the shipped definitions and the SSL Wireless example |
| `providers/message-provider-record.ts` | the stored state: Modified (compared with the shipped definition), Removed, reset, restore, key and path checks |
| `providers/render-provider-templates.ts` | renders bodies, headers and message ids with the shared template engine, collecting problems |
| `providers/preview-message-provider.ts` | runs a sample request: matches an operation, applies the mapping and the rules, builds the stored message and the response |
| `handlers/message-provider-handlers.ts` | the 18 operations |
| `fixtures/seed-toml.ts` | exports and applies `[[email.providers]]` and `[[sms.providers]]` |

Messages in the demo data carry provider keys, a few from SSL Wireless.

## 9. Agents

- The MCP tools follow the same names and validation; `*_get` and `*_list` mask secrets; there is no reveal tool.
- The skill gets two workflows, and MCP prompts of the same names:
  - **`add-email-provider`:** read the provider's API docs, create the provider from the closest built-in or blank, map the fields, write the success and error responses, check the preview, send a test request with `curl` or the provider's SDK, and export to the seed file.
  - **`add-sms-provider`:** the same for SMS, plus the status names and the error code per outcome.

## 10. Docs

- **Menu pages:** `docs/wiki/mail/providers.md` and `docs/wiki/sms/providers.md`, with the template headings (What it solves, How it connects, Use it, Everything on this screen, Customize, From the CLI, API and AI) and a screenshot each.
- **Advanced walkthroughs:** "Create an email provider" and "Create an SMS provider" (the second adds SSL Wireless step by step), followed by Playwright tests (WS-06.4).
- **The providers page** links to both screens and drops "arriving with the provider phases" for email and SMS.
- **Settings > Connection** and the Connect your app pages mention custom providers.
- New guide screenshots for both screens (`bun run screenshots`).

## 11. Tests

| Criterion | Tests |
|-----------|-------|
| EM-18.1, SM-16.1 | e2e: the lists show the built-ins with their badges, the Removed group appears after a remove |
| EM-18.2, SM-16.2 | e2e: add from a built-in and from blank, edit every tab, save; unit: the form schema |
| EM-18.3, SM-16.3 | e2e: Modified after an edit, Reset to default, Remove and Restore, Delete with its message count; handlers: the same through REST |
| EM-18.4, SM-16.4 | unit: the preview runner (mapping, rules, responses, problems); e2e: a template error blocks Save, a path clash names the other provider |
| EM-18.5, SM-16.5 | handlers: a request at a custom provider's path is stored with its name, a removed provider's path answers `404` (in the mock, through the playground bridge) |
| EM-18.6, SM-16.6 | contract: the surface catalogue, the parity check and the reference generators cover the 18 operations; unit: secrets are masked in every answer |
| EM-18.7, SM-16.7 | unit: seed export and apply round-trip a changed built-in and a custom provider, secrets as `${ENV}` |
| EM-18.8, SM-16.8 | Stage B: the provider fixture and SDK tests run against the shipped definitions |

## 12. Build steps

Each step is one commit on `feat/landing-install-tabs`. Static checks (format, lint, typecheck, `bun run openapi`) run locally; the test suites run in CI after each push, and failures are fixed before the next step.

| Step | Delivers | Pushed |
|------|----------|--------|
| 1 | This plan and the criteria | done |
| 2 | Contract: the new and changed types, the 18 endpoints, `providerKey`, the surface catalogue, the regenerated spec and references | with step 3 (the registry test needs the handlers) |
| 3 | Mock: fixtures for the 11 built-ins and SSL Wireless, the record, renderer and preview runner, the handlers, seed TOML, demo messages with provider keys | yes |
| 4 | Screens: the two lists at `/mail/providers` and `/sms/providers`, the Removed group, Add provider, the row actions with their confirmations | yes |
| 5 | Screens: the provider sheet tabs and the preview | yes |
| 6 | Wiring: the provider badge on messages, the provider filters, Settings > Connection | yes |
| 7 | Docs and the sidebar: the two menu pages with screenshots and their links from the connection map and the problem index, the sidebar children (a menu cannot ship without its guide page, WS-06.1), the two Advanced walkthroughs, the providers page | yes |
| 8 | Tests for every criterion that is not yet covered, the walkthrough tests, criteria ticked, PROGRESS updated | yes |

## 13. Stage B

The runtime answers requests from the stored definitions: the SMS built-ins (Twilio, Twilio Verify, Vonage) in Phase 2, the email providers, Plivo, MessageBird and custom providers in Phase 4. The Rust side keeps the same rules (keys, paths, clashes, masking) and the same template engine, and runs the shipped definitions against the provider fixture and SDK tests.

## 14. Open points

- **Twilio Verify** edits responses, labels and status names, but its verification state machine stays code.
- **Signing callbacks** (Twilio's `X-Twilio-Signature`) stays in the template functions; a new scheme needs a new function.
- **Batch responses** (Postmark, Resend) answer per item; a custom provider with a batch kind uses the same per-item response template.
