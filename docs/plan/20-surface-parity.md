# 20. Every Feature in Every Way (Surface Parity)

SendMock promises that every feature works from the **UI**, the **REST API**, the **CLI** and the **MCP server** ([AGENTS.md](../../AGENTS.md) parity rule, [14-ai-integration.md](14-ai-integration.md)). In Stage B the `sendmock-ops` registry and its CI check enforce it. But the contract the backend will build from is being written now, in Stage A, and it already has holes:

- The frozen spec ([docs/api/openapi.yaml](../api/openapi.yaml), 169 operations) has many operations with **no CLI command or MCP tool named** anywhere: reply and forward, outcome rules, HTTP bin management, completing a checkout, template revisions, moving rules, ...
- Some features exist **only in the CLI or MCP plan, with no REST endpoint**: wait for a message, read the latest OTP or links, payment test cards, recent events, scenarios.
- The user guide's "From the CLI, API and AI" tables show these holes as empty cells, and the API cells are plain text, so a reader cannot see the parameters.

This plan closes the holes in the contract before the backend starts, so a user never has to switch tools to do something, and makes the docs and the API reference show all four ways for every operation.

Feature: **UI-11 Every feature in every way** (criteria below). Proposed as **U3 W14**, part of the sign-off gate, because it changes the contract the backend implements.

## The rule

1. **Every REST operation has a CLI command and an MCP tool.** One operation, three names, the same input and output.
2. **Every CLI command and MCP tool has a REST operation**, so scripts in any language can do what the CLI and agents do. The only exceptions are commands that manage the local process (below).
3. **Every user-facing feature has a place in the UI**, or a recorded reason why not.
4. A gap is allowed only as a **recorded exemption with a reason**, listed in the catalogue and in this document. Today's exemptions are in [Exemptions](#exemptions).

## The catalogue: one place that names all four

The endpoint registry (`web/src/lib/api/endpoint-registry/`) already describes every REST operation and generates the spec. Each entry gains the other names:

```ts
{
  method: "POST",
  path: "/api/v1/emails/{emailId}/reply",
  summary: "Reply to an email as its recipient.",
  requestBody: typeRef("EmailReplyRequest"),
  response: typeRef("EmailDetail"),
  cli: "sendmock email reply <emailId>",
  mcp: "sendmock_email_reply",
  ui: "Mail > email > Reply",
}
```

- `cli`: the command, with its positional arguments; flags come from the body and query fields (`--body`, `--from`, ...), as in the [CLI conventions](14-ai-integration.md#agent-friendly-conventions).
- `mcp`: the tool name. Several operations may share one tool when they are one action for an agent (for example `getHealth` and `getInfo` both answer `sendmock_status`).
- `ui`: where it lives in the UI, or `null` with an exemption reason.
- `exempt`: `{ surface: "mcp", reason: "..." }` when a surface is deliberately left out.

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
| Seed | `GET /seed/status` | `sendmock seed status` | `sendmock_seed_status` |
| Seed | `POST /seed/validate` | (exists) | `sendmock_seed_validate` |
| Logs | `GET /logs/smtp/{sessionId}`, `GET /logs/http/{requestId}` | `sendmock logs smtp show <sessionId>`, `sendmock logs http show <requestId>` | `sendmock_logs_smtp_get`, `sendmock_logs_http_get` |
| Email | `DELETE /emails` | (exists: `delete-all`) | `sendmock_email_delete_all` |
| Email | `PATCH /emails/{emailId}` (read, unread, tags) | `sendmock email update <emailId> --read --tag ...` | `sendmock_email_update` (replaces `sendmock_email_tag`) |
| Email | `GET /emails/{emailId}/list-unsubscribe` | `sendmock email check <emailId> unsubscribe` | `sendmock_email_check` (`unsubscribe` kind) |
| Email | `GET /emails/{emailId}/attachments/{attachmentIndex}` | (exists: `attachments`) | resource `sendmock://emails/{emailId}/attachments/{attachmentIndex}` |
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
| Payment gateways | `GET .../credentials/{credentialName}` | `sendmock payments gateways credential <gatewayKey> <name> --reveal` | exempt (agents never read secrets) |
| Payment methods | `DELETE /payments/methods/{methodKey}` | (exists) | `sendmock_payment_method_delete` |
| Webhook endpoints | `GET .../{endpointId}/secret` | `sendmock webhook endpoint secret <name> --reveal` | exempt (agents never read secrets) |
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
| Chaos | `sendmock chaos ...`, `sendmock_chaos_set` | covered by `PATCH /settings` (named as the same operation) |

### UI places to check

Every feature above already has a screen except these, which need a decision:

| Feature | Proposal |
| --- | --- |
| Scenarios | a **Scenarios** screen is not planned; the website playground has scenario mode. Proposal: exempt in Stage A, revisit in Phase 4 when scenarios ship. |
| Wait helpers, latest OTP and links | exempt: the UI shows messages live and puts codes and links beside them. |
| Recent events | covered by the live lists and the notification bell. |

### Renames

`sendmock_email_tag` becomes `sendmock_email_update` (it also marks read and unread). `sendmock_inbound_routes_*` (in [05](05-webhooks.md#inbound-routes)) becomes `sendmock_inbound_route_*` to match the singular naming of every other tool.

## Exemptions

| Surface left out | Of | Reason |
| --- | --- | --- |
| MCP | revealing an endpoint secret or a gateway credential | agents may set secrets but never read them back ([14](14-ai-integration.md#mcp-server)) |
| CLI and MCP | `GET /emails/{emailId}/parts/{attachmentIndex}/thumbnail` | a UI image helper; the attachment itself is available everywhere |
| REST and MCP | `sendmock serve`, `sendmock mcp`, `sendmock sendmail`, `sendmock ai install`, `sendmock ai skill`, `sendmock version` | they start or set up the local process, not a feature of a running instance |
| UI | wait helpers, latest OTP and links, scenarios (until Phase 4) | see [UI places to check](#ui-places-to-check) |

## The API reference and the docs

- **API reference:** each operation on `/api/<tag>/` shows its CLI command and MCP tool under the method and path (from `x-sendmock-cli` and `x-sendmock-mcp`), so one page answers "how do I do this from my script, my terminal or my agent".
- **User guide tables:** every "From the CLI, API and AI" row fills all three cells. The API cell links to the operation's reference, where its parameters, body and answers are listed:

  ```markdown
  | simulate an outcome | `sendmock email simulate <emailId> bounced` | [`POST /api/v1/emails/{emailId}/simulate`](/api/email/#postEmailsByEmailIdSimulate) | `sendmock_email_simulate` |
  ```

- **Checked:** a docs test reads every such table and fails when a cell is empty, an API link does not lead to an operation in the spec, or the CLI and MCP names differ from the catalogue for that operation. This replaces WS-06.5's later check with one that runs now.

## Acceptance criteria: UI-11 Every feature in every way

To be added to [acceptance/06-ui.md](acceptance/06-ui.md) once this plan is approved:

- UI-11.1 Every operation in the endpoint registry names its CLI command, MCP tool and UI place, or a recorded exemption with a reason; a test fails on a missing name or an unknown exemption.
- UI-11.2 Every CLI command and MCP tool in [14-ai-integration.md](14-ai-integration.md) maps to an operation in the registry, except the local process commands listed as exempt; a test reads both and fails on an unmapped name.
- UI-11.3 The spec carries `x-sendmock-cli`, `x-sendmock-mcp` and `x-sendmock-ui` on every operation, and the API reference shows the CLI command and MCP tool on every operation.
- UI-11.4 Every "From the CLI, API and AI" row in the user guide has all three cells, its API cell links to an operation in the spec, and its CLI and MCP names match the catalogue.
- UI-11.5 The new REST operations (wait helpers, `/otp`, `/links`, `/emails/latest`, `/events/recent`, `/integrations/{stack}`, payment test cards, outcome tests, scenarios) are in the registry and the spec, answered by the mock in Demo mode and callable from the playground.

## Order of work

On a new branch from `docs/user-guide-plan` (or from `develop` once that is merged):

1. Plan updates: this document, then [06-api.md](06-api.md) (new endpoints), [14-ai-integration.md](14-ai-integration.md) (the full CLI tree and MCP table, renames), [05-webhooks.md](05-webhooks.md) (route tool names); acceptance criteria.
2. Registry: `cli`, `mcp`, `ui` and `exempt` on every endpoint; the new endpoints with their types and mock handlers; `bun run openapi`; UI-11.1, UI-11.2, UI-11.5 tests.
3. API reference: show the CLI and MCP names per operation (UI-11.3).
4. User guide: fill every table and link every API cell; the UI-11.4 test.
5. PROGRESS, as-built notes.

## Decisions for the owner

1. **Placement:** W14 in U3, inside the sign-off gate (the contract changes), or after sign-off as a contract amendment.
2. **Scenarios UI:** exempt until Phase 4 (proposed), or plan a Scenarios screen now.
3. **New REST helpers in the spec now** (wait, otp, links, events, integrations, scenarios), as proposed, or only after their backend phase.
