# 20. Every Feature in Every Way (Surface Parity)

SendMock promises that every feature works from the **UI**, the **REST API**, the **CLI** and the **MCP server** ([AGENTS.md](../../AGENTS.md) parity rule, [14-ai-integration.md](14-ai-integration.md)). In Stage B the `sendmock-ops` registry and its CI check enforce it. But the contract the backend will build from is being written now, in Stage A, and it already has holes:

- The frozen spec ([docs/api/openapi.yaml](../api/openapi.yaml), 169 operations) has many operations with **no CLI command or MCP tool named** anywhere: reply and forward, outcome rules, HTTP bin management, completing a checkout, template revisions, moving rules, ...
- Some features exist **only in the CLI or MCP plan, with no REST endpoint**: wait for a message, read the latest OTP or links, payment test cards, recent events, scenarios.
- The user guide's "From the CLI, API and AI" tables show these holes as empty cells, and the API cells are plain text, so a reader cannot see the parameters.

This plan closes the holes in the contract before the backend starts, so a user never has to switch tools to do something, and makes the docs and the API reference show all four ways for every operation.

Feature: **UI-11 Every feature in every way** ([criteria](acceptance/06-ui.md#ui-11-every-feature-in-every-way)). Built as **U3 W14**, inside the sign-off gate, because it changes the contract the backend implements.

**Decided (2026-10-26):** build it in U3 on `docs/user-guide-plan`, fill **every** gap below, add the REST helpers to the spec now, and keep one exemption only: agents never read a secret back.

## The rule

1. **Every REST operation has a CLI command and an MCP tool.** One operation, three names, the same input and output.
2. **Every CLI command and MCP tool has a REST operation**, so scripts in any language can do what the CLI and agents do.
3. **Every feature has a place in the UI.**
4. The only gap allowed is a **recorded exemption with a reason**, listed in the catalogue and in [Exemptions](#exemptions). There is one.

## The catalogue: one place that names all four

The endpoint registry (`web/src/lib/api/endpoint-registry/`) describes every REST operation and generates the spec. Beside it, the **surface catalogue** (`web/src/lib/api/surface-catalogue/`, one file per area, so the registry files keep one job) names the other three ways for each operation, keyed by method and path:

```ts
"POST /api/v1/emails/{emailId}/reply": {
  cli: "sendmock email reply <emailId>",
  mcp: "sendmock_email_reply",
  ui: "Mail > open email > Reply",
},
```

- `cli`: the command, with its positional arguments; flags come from the body and query fields (`--body`, `--from`, ...), as in the [CLI conventions](14-ai-integration.md#agent-friendly-conventions).
- `mcp`: the tool name, or an MCP resource (`sendmock://...`) for files and raw content. Several operations may share one tool when they are one action for an agent (`GET /health` and `GET /info` both answer `sendmock_status`).
- `ui`: where it lives in the UI, as the path a user clicks.
- `mcpExemptReason`: set, with `mcp: null`, only for the one exemption.

A scenario step names an operation by its MCP tool without the prefix, with dots: `sendmock_webhook_endpoint_create` is the step `webhook.endpoint.create` ([Scenarios](#scenarios-screen)).

`bun run openapi` writes the names into the spec as `x-sendmock-cli`, `x-sendmock-mcp` and `x-sendmock-ui` on each operation. In Stage B the Rust `sendmock-ops` registry is the source, and the parity check compares it with these names, so the CLI and MCP the backend ships are the ones the docs promised.

## Naming conventions

| Surface | Pattern | Examples |
| --- | --- | --- |
| CLI | `sendmock <area> [<sub-area>] <verb> [<id>]`; verbs `list`, `show`, `create`, `update`, `delete`, plus domain verbs (`simulate`, `replay`, `move`, `reset`, `preview`) | `sendmock email reply <emailId>`, `sendmock http bin create`, `sendmock webhook rule move <ruleId>` |
| MCP | `sendmock_<area>_[<sub_area>_]<verb>`; the same verbs (`list`, `get`, `create`, `update`, `delete`, ...) | `sendmock_email_reply`, `sendmock_http_bin_create`, `sendmock_webhook_rule_move` |
| REST | as today, under `/api/v1` | `POST /api/v1/emails/{emailId}/reply` |

Existing names in [14-ai-integration.md](14-ai-integration.md) keep their spelling unless listed under renames below.

## Gaps found (2026-10-26)

Compared: the 169 operations in the spec against the CLI command tree and MCP tool table in [14-ai-integration.md](14-ai-integration.md), and the planned helpers in [06-api.md](06-api.md#test-automation-helpers).

### REST operations without a CLI command or MCP tool

| Area | Operation | Add CLI | Add MCP |
| --- | --- | --- | --- |
| System | `GET /updates` | `sendmock update check` | `sendmock_update_check` |
| System | `POST /samples/{kind}` | `sendmock sample <email\|sms\|verification\|number\|http>` | `sendmock_sample_send` |
| System | `GET /health` | (exists: `sendmock health`) | `sendmock_status` (shared) |
| System | `GET /info` | (exists: `sendmock status`, `sendmock version`) | (exists: `sendmock_status`) |
| Seed | `GET /seed/status` | `sendmock seed status` | `sendmock_seed_status` |
| Seed | `POST /seed/validate` | (exists) | `sendmock_seed_validate` |
| Logs | `GET /logs/smtp/{sessionId}`, `GET /logs/http/{requestId}` | `sendmock logs smtp show <sessionId>`, `sendmock logs http show <requestId>` | `sendmock_logs_smtp_get`, `sendmock_logs_http_get` |
| Email | `DELETE /emails` | (exists: `delete-all`) | `sendmock_email_delete_all` |
| Email | `PATCH /emails/{emailId}` (read, unread, tags) | `sendmock email update <emailId> --read --tag ...` | `sendmock_email_update` (replaces `sendmock_email_tag`) |
| Email | `GET /emails/{emailId}/list-unsubscribe` | `sendmock email check <emailId> unsubscribe` | `sendmock_email_check` (`unsubscribe` kind) |
| Email | `GET /emails/{emailId}/attachments/{attachmentIndex}` | (exists: `attachments`) | resource `sendmock://emails/{emailId}/attachments/{attachmentIndex}` |
| Email | `GET /emails/{emailId}/parts/{attachmentIndex}/thumbnail` | `sendmock email thumbnail <emailId> <attachmentIndex>` | resource `sendmock://emails/{emailId}/parts/{attachmentIndex}/thumbnail` |
| Email | `POST /emails/{emailId}/reply`, `/forward` | `sendmock email reply <emailId>`, `sendmock email forward <emailId> --to ...` | `sendmock_email_reply`, `sendmock_email_forward` |
| Inbound routes | `PATCH`, `DELETE /inbound-routes/{routeId}` | `sendmock route update`, `sendmock route delete` | `sendmock_inbound_route_update`, `_delete` (the five route tools join the MCP table) |
| SMS | `DELETE /sms` | (exists) | `sendmock_sms_delete_all` |
| SMS | `GET /sms/{smsId}/media/{mediaIndex}` | `sendmock sms media <smsId> <mediaIndex>` | resource `sendmock://sms/{smsId}/media/{mediaIndex}` |
| SMS | `POST /sms/{smsId}/reply-webhook/resend` | `sendmock sms resend-reply-webhook <smsId>` | `sendmock_sms_reply_webhook_resend` |
| Outcome rules | all 10 (`/outcome-rules/email`, `/outcome-rules/sms`: list, create, update, delete, move) | `sendmock outcome-rule email\|sms list\|create\|update\|delete\|move` | `sendmock_outcome_rule_list`, `_create`, `_update`, `_delete`, `_move` (with `channel`) |
| Numbers | `PATCH /messaging-services/{serviceSid}` | `sendmock sms services update` | `sendmock_messaging_service_update` |
| HTTP catcher | `POST`, `PATCH`, `DELETE /http/bins` | `sendmock http bin create\|update\|delete` | `sendmock_http_bin_create`, `_update`, `_delete` |
| HTTP catcher | `GET /http/bins/{binId}/responses`, `POST .../responses/preview` | `sendmock http response list`, `... preview` | `sendmock_http_response_list`, `_preview` |
| HTTP catcher | `DELETE /http/requests` | `sendmock http clear [--bin]` | `sendmock_http_clear` |
| HTTP catcher | `GET /http/requests/{requestId}/files/{fileIndex}` | `sendmock http file <requestId> <fileIndex>` | resource `sendmock://http/requests/{requestId}/files/{fileIndex}` |
| HTTP catcher | `/catch/{binPath}` (5 methods) | `sendmock http send <bin> [--method --data]` | `sendmock_http_send` |
| Payments | `POST /payments/checkout` | `sendmock payments checkout create` | (exists) |
| Checkout | `GET /checkout-sessions/{sessionId}`, `POST .../complete` | `sendmock payments checkout show\|pay\|decline\|cancel <sessionId>` | `sendmock_checkout_get`, `sendmock_checkout_complete` (agents can finish a test checkout) |
| Payment gateways | `DELETE /payments/gateways/{gatewayKey}` | (exists) | `sendmock_payment_gateway_delete` |
| Payment gateways | `GET .../credentials/{credentialName}` | `sendmock payments gateways credential <gatewayKey> <name> --reveal` | exempt: agents never read secrets |
| Payment methods | `DELETE /payments/methods/{methodKey}` | (exists) | `sendmock_payment_method_delete` |
| Webhook endpoints | `GET .../{endpointId}/secret` | `sendmock webhook endpoint secret <name> --reveal` | exempt: agents never read secrets |
| Webhook endpoints | `POST .../{endpointId}/save-as-template` | `sendmock webhook endpoint save-as-template <name>` | `sendmock_webhook_endpoint_save_as_template` |
| Webhook rules | `POST /webhooks/rules/{ruleId}/move` | `sendmock webhook rule move <ruleId> --up\|--down` | `sendmock_webhook_rule_move` |
| Webhook deliveries | `GET /webhooks/metrics` | `sendmock webhook metrics [--range 24h\|7d]` | `sendmock_webhook_metrics` |
| Saved deliveries | `POST /webhooks/saved`, `PATCH .../{savedId}`, `POST .../{savedId}/template` | `sendmock webhook deliveries save <deliveryId> --name`, `sendmock webhook saved rename`, `... save-as-template` | `sendmock_webhook_saved_create`, `_update`, `_save_as_template` |
| Webhook templates | revisions, restore, reset | `sendmock webhook template history\|restore\|reset` | `sendmock_webhook_template_revisions`, `_restore`, `_reset` |
| Webhook templates | `GET /webhooks/template-reference` | `sendmock webhook template reference [--events ...]` | `sendmock_webhook_template_reference` (lets agents write templates without guessing) |
| Webhook variables | `POST /webhooks/variables/preview` | `sendmock webhook var preview` | `sendmock_webhook_variable_preview` |

### CLI and MCP features without a REST operation

These join the registry (and the spec) as REST operations. Long waits keep the planned long-poll behaviour (408 on timeout).

| Feature | CLI / MCP today | Add REST |
| --- | --- | --- |
| Wait for an email, SMS, HTTP request, delivery, payment | `email wait`, `sms wait`, `sendmock_*_wait` | `GET /wait/email`, `/wait/sms`, `/wait/http`, `/wait/webhook`, `/wait/payment` (planned in [06](06-api.md#test-automation-helpers), now in the spec) |
| Latest OTP, latest links | `sendmock otp`, `sendmock links`, `sendmock_otp_get`, `sendmock_links_get` | `GET /otp`, `GET /links` |
| Latest email for a recipient | `sendmock_email_get` by recipient | `GET /emails/latest` |
| Payment test cards and wallets | `sendmock payments test-cards` | `GET /payments/test-cards`, MCP `sendmock_payment_test_cards` |
| Recent events | `sendmock events tail`, `sendmock_events_recent` | `GET /events/recent` (the stream itself stays `/ws` and SSE `/events`) |
| Integration snippet | `sendmock integrate <stack>`, `sendmock_integration_snippet` | `GET /integrations/{stack}?channel=` |
| Test an outcome address or number | UI tester only | `POST /outcome-rules/email/test`, `/outcome-rules/sms/test`, CLI `sendmock outcome-rule test`, MCP `sendmock_outcome_rule_test` |
| Scenarios | `sendmock scenario run\|validate`, `sendmock_scenario_run`, `_validate` | `POST /scenarios/run`, `POST /scenarios/validate` |
| Send a test email over SMTP | `sendmock email send-test` | covered by `POST /samples/email` with optional `to`, `subject`, `html` |
| Send a raw message (the `sendmail` shim) | `sendmock sendmail` | `POST /send/raw` (`message/rfc822`), MCP `sendmock_email_send_raw`, UI **Mail > Import .eml** (sent by your app) |
| Create an incoming email | planned in [05](05-webhooks.md#simulating-replies-and-forwards), no CLI or MCP | `POST /emails/inbound` (fields or raw MIME), CLI `sendmock email inbound`, MCP `sendmock_email_inbound`, UI **Mail > Import .eml** (incoming to your app) |
| Latest email for a recipient | `sendmock email show --latest --to` | `GET /emails/latest` |
| Tag rules and auto-forward rules | `sendmock email tag-rules\|forward-rules`, `sendmock_tag_rule_*`, `sendmock_forward_rule_*` | `GET`, `POST /tag-rules`, `PATCH`, `DELETE /tag-rules/{ruleId}`, `POST /tag-rules/{ruleId}/move`, the same for `/forward-rules`; and the **UI**, which was never built (Settings > Email only linked to the webhook rules): **Tag rules** and **Auto-forward rules** cards with the same filter builder |
| Live tails | `sendmock http tail`, `sendmock webhook tail`, `sendmock events tail`, `sendmock logs ... --tail` | `GET /events/recent?since=` (polling), next to the stream (`/ws`, SSE `/events`) |
| AI agent setup | `sendmock ai install`, `sendmock ai skill` | `GET /ai/agents` (per agent: install command, MCP configuration and where it goes), `GET /ai/skill` (the skill as Markdown); MCP `sendmock_ai_agents` and resource `sendmock://docs/skill`; UI **Settings > Connection > AI agents** |
| Chaos | `sendmock chaos ...`, `sendmock_chaos_set` | covered by `PATCH /settings` (named as the same operation) |

### UI places

Every operation names its UI place. New UI built for this:

| Feature | UI |
| --- | --- |
| Scenarios | a new **Scenarios** screen in the sidebar (see [below](#scenarios-screen)) |
| Raw and incoming email | **Import .eml** in the Mail list: upload or paste a message as sent by your app (`/send/raw`) or as incoming (`/emails/inbound`) |
| Tag rules, auto-forward rules | **Tag rules** and **Auto-forward rules** cards in Settings > Email, each a list with order, an enabled switch and a sheet with the webhook rule filter builder |
| AI agent setup | **AI agents** card in Settings > Connection: pick the agent, copy the install command and the MCP configuration, download the skill |
| Outcome testers | the **Test an address** and **Test a number** boxes call the new test endpoints |

The helpers map to screens that already show the same thing: waits to the live lists (Mail, SMS, HTTP, Deliveries, Payments), the latest OTP and links to the code and links panel of a message, recent events to the notification bell, test cards to Settings > Payments, integration snippets to Settings > Connection.

### Scenarios screen

`/scenarios`, in the sidebar after Numbers (`G C`). A scenario is the TOML file from [14](14-ai-integration.md#scenarios):

- **Editor** (the shared code editor) with the scenario text, **Load example** (OTP login, reply by email, checkout), **Upload** a `.toml` file and **Download**.
- **Validate** lists problems with their step number (an unknown operation, a missing field).
- **Run** shows each step as it runs: the operation, its input, its answer or error, and the values it saved, with a pass or fail summary. Steps call the same operations as the API, so in Demo mode they are answered by the mock; `http` steps that call your app are recorded as skipped in Demo mode.
- The last run's report stays until the next run; nothing is stored on the server.

### Renames and aliases

- `sendmock_inbound_routes_*` (in [05](05-webhooks.md#inbound-routes)) becomes `sendmock_inbound_route_*`, singular like every other tool.
- Names that already existed stay as **aliases** of the operation they run, so nothing breaks: `sendmock_email_tag` and `sendmock email tag` (of `email update`), `sendmock_email_search` (of `email list`), `sendmock email send-test` and `sendmock_email_send_test` (of `sample email`), `sendmock email html` (of `email show`), `sendmock version` (of `status`), `sendmock http bins` and `sendmock_http_bins` (of `http bin list`), the `sendmock chaos ...` commands and `sendmock_chaos_set` (of `settings set`), `sendmock payments flows steps move` and `sendmock_payment_flow_step_move` (of `steps update`), and `sendmock http tail` and `sendmock webhook tail` (of `events tail`).
- Found while building: the CLI and MCP named "show" and "get" for single gateways, methods, flows, endpoints and rules, but the spec had no such operations; `GET /payments/gateways/{gatewayKey}`, `/payments/methods/{methodKey}`, `/payments/flows/{flowKey}`, `/webhooks/endpoints/{endpointId}` and `/webhooks/rules/{ruleId}` were added.

## Exemptions

| Surface left out | Of | Reason |
| --- | --- | --- |
| MCP | revealing an endpoint secret (`GET /webhooks/endpoints/{endpointId}/secret`) or a gateway credential (`GET /payments/gateways/{gatewayKey}/credentials/{credentialName}`) | agents may set secrets but never read them back ([14](14-ai-integration.md#mcp-server)); the CLI and UI reveal them after a confirmation |

`sendmock serve` and `sendmock mcp` start the server and the MCP server themselves, and `sendmock help` prints help, so they are how the other ways exist rather than features of a running instance; they are listed in the CLI tree and not counted as operations.

## The API reference and the docs

- **API reference:** each operation on `/api/<tag>/` shows its CLI command and MCP tool under the method and path (from `x-sendmock-cli` and `x-sendmock-mcp`), so one page answers "how do I do this from my script, my terminal or my agent".
- **User guide tables:** every "From the CLI, API and AI" row fills all three cells. The API cell links to the operation's reference, where its parameters, body and answers are listed:

  ```markdown
  | simulate an outcome | `sendmock email simulate <emailId> bounced` | [`POST /api/v1/emails/{emailId}/simulate`](/api/email/#postEmailsByEmailIdSimulate) | `sendmock_email_simulate` |
  ```

- **Checked:** a docs test reads every such table and fails when a cell is empty, an API link does not lead to an operation in the spec, or the CLI and MCP names differ from the catalogue for that operation. This replaces WS-06.5's later check with one that runs now.

## CI: the Surface parity workflow

`.github/workflows/parity.yml` runs on every pull request and every push to `develop` and `main`, on its own so a gap shows up as one clearly named failing check, and in about a minute (no browser, no build):

1. `bun run parity` (`web/scripts/surfaces/check-surface-parity.ts`): for every REST operation, checks it has a CLI command, an MCP tool or resource (or the recorded exemption) and a UI place, and that every catalogue entry belongs to an operation. It prints a table per area (operations, CLI, MCP, UI, gaps) and writes it to the job summary; any gap fails the job and is listed.
2. `bun run test:parity`: the catalogue tests (UI-11.1), the AI plan names (UI-11.2), the user guide tables and names (UI-11.4, WS-06.5), the mock answering every registered operation (UI-09.1) and the spec carrying the names (`openapi:check`).

The same checks also stay in the main CI job. In Stage B the workflow gains the Rust registry's parity check (AI-01.1, AI-02.1), comparing the commands and tools the binary really has with the catalogue.

## Acceptance criteria

In [acceptance/06-ui.md](acceptance/06-ui.md#ui-11-every-feature-in-every-way) (UI-11.1 to UI-11.7). The tag and auto-forward rule screens also prove EM-12.3 and EM-14.3 on the UI side.

## Order of work

On `docs/user-guide-plan`, one commit per step:

1. Plan updates: this document, [06-api.md](06-api.md) (new endpoints), [14-ai-integration.md](14-ai-integration.md) (the full CLI tree and MCP table, renames), [05-webhooks.md](05-webhooks.md) (route tool names), [07-ui.md](07-ui.md) (Scenarios, Import .eml, tag and forward rules, AI agents); acceptance criteria.
2. Contract: the new types, registry entries and mock handlers; the surface catalogue; `x-sendmock-*` in the spec; UI-11.1, UI-11.2 and UI-11.5 tests.
3. UI: Scenarios screen, Import .eml, tag and auto-forward rules, AI agents card, testers on the API; their tests.
4. API reference: the CLI and MCP names per operation (UI-11.3).
5. User guide: every table filled and linked, a Scenarios page, the new UI described; the UI-11.4 test.
6. PROGRESS and as-built notes.

## As built (2026-10-26)

- **Contract:** 203 operations (169 before): the wait helpers, `/otp`, `/links`, `/events/recent`, `/integrations/{stack}`, `/scenarios/validate` and `/run`, `/ai/agents` and `/ai/skill` (tags Test helpers and Automation), `/emails/latest`, `/emails/inbound`, `/send/raw`, `/tag-rules` and `/forward-rules` (5 each), the two outcome tests, `/payments/test-cards`, and single gateways, methods, flows, endpoints and rules. The surface catalogue (`web/src/lib/api/surface-catalogue`, one file per area) names every operation's CLI command, MCP tool or resource and UI place; `bun run openapi` writes them as `x-sendmock-*` and fails on an operation without an entry.
- **Mock:** handlers for every new operation. Waits poll the mock and give up after at most 3 s. Scenarios are read with `smol-toml` (mock only, so the live build does not ship it) and each step is answered by the mock handlers directly (MSW `getResponse`), so a run is the same operations the UI calls. Tag and auto-forward rules apply to every `email.received`. The outcome testers moved to `lib/outcomes` so the mock's test endpoints answer with the testers' exact text; the testers now call the API.
- **UI:** Scenarios screen (`G C`), Import .eml in the Mail toolbar, Tag rules and Auto-forward rules cards in Settings > Email, the AI agents card and Send this request in Settings > Connection.
- **Docs:** the CLI tree and MCP table in [14](14-ai-integration.md) are generated from the catalogue (`bun scripts/surfaces/print-surface-lists.ts`); every "From the CLI, API and AI" row in the user guide was rewritten from the spec, with the API cell linking to its operation; a Scenarios menu page with a screenshot.
- **Tests:** UI-11.1 (Vitest, catalogue against registry), UI-11.2 (contract test reading the AI plan), UI-11.3 (website, every reference operation), UI-11.4 (website guide test reading every table), UI-11.5 (mock handler tests for every new operation, the scenario examples, and the playground sweep counting operations from the spec), UI-11.6 (Playwright: Scenarios, Import .eml, tag and forward rules, AI agents and Send this request). EM-12.3 and EM-14.3 are also named by the rule tests.

