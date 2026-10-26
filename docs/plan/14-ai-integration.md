# 14. AI Integration (CLI, MCP, Skill)

Every feature of SendMock must be operable by an AI harness (Claude Code, Codex, Cursor, Gemini CLI, VS Code agents, ...) as well as by a human. A user should be able to say:

> "Set up my Laravel app to receive inbound email in Postmark format, then simulate a customer replying and check my handler works."

and the agent does it end to end: configure the app, create the endpoint and rule, send a test email, read the delivery log, fix the handler, replay.

Three surfaces make that possible:

| Surface | Best for |
|---------|----------|
| **CLI** | any agent with a shell; scripts and CI; humans |
| **MCP server** | agents that support the Model Context Protocol; typed tools, no shell parsing |
| **Agent skill** | teaching the agent *when* and *how* to use SendMock (workflows, safety rules) |

## Parity rule: one operation registry

All features are implemented once as **operations** in a shared `sendmock-ops` crate (input type, output type, handler, description, read-only/destructive flag). Each surface is a thin adapter over the same registry:

```
             ┌──────────── sendmock-ops (operations registry) ────────────┐
             │ email.list  sms.send  webhook.endpoint.create  ...    │
             └───────┬──────────┬──────────┬──────────┬──────────────┘
                     │          │          │          │
                 REST API     CLI       MCP tools   Web UI (via REST)
```

- Input/output types derive `serde` + `schemars`, so REST (OpenAPI), CLI flags/help and MCP tool schemas are generated from the same source.
- A CI test enumerates the registry and fails if any operation lacks a REST route, a CLI command or an MCP tool (unless explicitly marked UI-only).
- **Definition of done for every feature** in every phase: UI + REST + CLI + MCP + skill docs updated.

## CLI

The single binary is also the client. Commands talk to a running instance over HTTP (`--url`, `SENDMOCK_URL`, default `http://127.0.0.1:8025`, with `--token` / `SENDMOCK_TOKEN` when auth is on).

### Agent-friendly conventions

- `--json` on every command for machine-readable output (stable schemas, documented); human tables otherwise. `--json` is the default when stdout is not a TTY.
- Non-interactive by default: no prompts unless `--interactive`; destructive commands need `--yes`.
- Meaningful exit codes: `0` ok, `1` error, `2` usage, `3` not found, `4` timeout (for `wait`), `5` assertion failed.
- `sendmock <command> --help` includes examples; `sendmock help --all --json` dumps the whole command tree for agents.
- Inputs accept flags, `--data '<json>'`, or `--file payload.json|toml` (stdin with `-`).

### Flags and tool inputs

A command's flags and a tool's inputs are derived from the operation's inputs by fixed rules, so the docs, the playground and the binary agree. The full rules and examples are in [21-reference-and-examples.md](21-reference-and-examples.md#2-one-rule-set-for-cli-flags-and-mcp-inputs); in short:

- **CLI:** path parameters are positional arguments in path order; query parameters and top-level body fields are `--kebab-case` flags; booleans are `--name` / `--no-name` without an `is_` or `has_` prefix; lists of scalars repeat the flag in the singular (`--tag a --tag b`); objects take JSON or come from `--data` / `--file`; allowed values are validated (exit 2). Global flags: `--json`, `--url`, `--token`, `--data`, `--file`, `--help`, and `--yes` on destructive commands.
- **MCP:** one `inputSchema` with the path, query and top-level body inputs as snake_case properties, the success response as `outputSchema`, annotations from the method (GET read only, DELETE destructive, PUT, PATCH and DELETE idempotent), and a selector property (`kind`, ...) when several operations share one tool.
- Exceptions to a rule are overrides in the surface catalogue (`cliFlags`, `mcpSelector`, annotations), never hand-written lists. `bun run openapi` writes the result to `docs/api/cli-reference.json` and `docs/api/mcp-tools.json`, which the website's [CLI and MCP reference](21-reference-and-examples.md#3-the-cli-and-mcp-reference-pages) is built from and the Stage B binary is checked against.

### Command tree

Generated from the surface catalogue (`web/src/lib/api/surface-catalogue`, see [20-surface-parity.md](20-surface-parity.md)) with `bun scripts/surfaces/print-surface-lists.ts`: every command runs one REST operation, and every REST operation has a command. Arguments in `<>` are positional; the operation's body and query fields are flags (`--to`, `--subject`, ...), or `--data '<json>'` / `--file`.

```
sendmock serve                                   # run the servers
sendmock mcp [--toolsets ...] [--read-only]      # MCP server over stdio
sendmock ai install --target <agent>
sendmock ai skill
sendmock chaos clear
sendmock chaos sms-failure-rate
sendmock chaos smtp-latency
sendmock chaos smtp-reject
sendmock email attachments <emailId> <attachmentIndex>
sendmock email check <emailId> html
sendmock email check <emailId> links
sendmock email check <emailId> spam
sendmock email check <emailId> unsubscribe
sendmock email delete <emailId>
sendmock email delete-all --yes
sendmock email forward <emailId>
sendmock email forward-rules create
sendmock email forward-rules delete <ruleId>
sendmock email forward-rules list
sendmock email forward-rules move <ruleId>
sendmock email forward-rules update <ruleId>
sendmock email html <emailId>
sendmock email inbound
sendmock email latest --to <address>
sendmock email list
sendmock email mime <emailId>
sendmock email open <emailId>
sendmock email raw <emailId>
sendmock email release <emailId>
sendmock email reply <emailId>
sendmock email send
sendmock email send-test
sendmock email show <emailId>
sendmock email simulate <emailId> <event>
sendmock email tag <emailId>
sendmock email tag-rules create
sendmock email tag-rules delete <ruleId>
sendmock email tag-rules list
sendmock email tag-rules move <ruleId>
sendmock email tag-rules update <ruleId>
sendmock email thumbnail <emailId> <attachmentIndex>
sendmock email timeline <emailId>
sendmock email update <emailId>
sendmock email wait
sendmock events tail
sendmock health
sendmock http bin create
sendmock http bin delete <binId>
sendmock http bin list
sendmock http bin update <binId>
sendmock http bins
sendmock http clear
sendmock http file <requestId> <fileIndex>
sendmock http forward <requestId>
sendmock http list
sendmock http response list <binId>
sendmock http response preview <binId>
sendmock http response set <binId>
sendmock http send <bin>
sendmock http show <requestId>
sendmock http tail
sendmock http wait
sendmock integrate <stack>
sendmock links --to <recipient>
sendmock logs http
sendmock logs http show <requestId>
sendmock logs smtp
sendmock logs smtp show <sessionId>
sendmock numbers add
sendmock numbers list
sendmock numbers remove <numberId>
sendmock numbers update <numberId>
sendmock otp --to <recipient>
sendmock outcome-rule email create
sendmock outcome-rule email delete <ruleId>
sendmock outcome-rule email list
sendmock outcome-rule email move <ruleId>
sendmock outcome-rule email test <address>
sendmock outcome-rule email update <ruleId>
sendmock outcome-rule sms create
sendmock outcome-rule sms delete <ruleId>
sendmock outcome-rule sms list
sendmock outcome-rule sms move <ruleId>
sendmock outcome-rule sms test <number>
sendmock outcome-rule sms update <ruleId>
sendmock payments checkout complete <sessionId> <action>
sendmock payments checkout create
sendmock payments checkout show <sessionId>
sendmock payments flows create
sendmock payments flows delete <flowKey>
sendmock payments flows list
sendmock payments flows reset <flowKey>
sendmock payments flows show <flowKey>
sendmock payments flows step-types
sendmock payments flows steps add <flowKey>
sendmock payments flows steps move <flowKey> <stepIndex>
sendmock payments flows steps remove <flowKey> <stepIndex>
sendmock payments flows steps update <flowKey> <stepIndex>
sendmock payments flows update <flowKey>
sendmock payments flows variables
sendmock payments gateways create
sendmock payments gateways credential <gatewayKey> <credentialName> --reveal
sendmock payments gateways delete <gatewayKey>
sendmock payments gateways list
sendmock payments gateways preview <gatewayKey>
sendmock payments gateways reset <gatewayKey>
sendmock payments gateways show <gatewayKey>
sendmock payments gateways update <gatewayKey>
sendmock payments list
sendmock payments methods create
sendmock payments methods delete <methodKey>
sendmock payments methods list
sendmock payments methods reset <methodKey>
sendmock payments methods show <methodKey>
sendmock payments methods update <methodKey>
sendmock payments notify <paymentId>
sendmock payments show <paymentId>
sendmock payments simulate <paymentId> <action>
sendmock payments test-cards
sendmock payments wait
sendmock reset --yes
sendmock route create
sendmock route delete <routeId>
sendmock route list
sendmock route test
sendmock route update <routeId>
sendmock sample <kind>
sendmock scenario run <file>
sendmock scenario validate <file>
sendmock seed apply <file>
sendmock seed export
sendmock seed status
sendmock seed validate <file>
sendmock sendmail
sendmock settings get
sendmock settings set <key> <value>
sendmock sms delete <smsId>
sendmock sms delete-all --yes
sendmock sms inbound
sendmock sms list
sendmock sms media <smsId> <mediaIndex>
sendmock sms open <smsId>
sendmock sms resend-reply-webhook <smsId>
sendmock sms send
sendmock sms services create
sendmock sms services delete <serviceSid>
sendmock sms services list
sendmock sms services update <serviceSid>
sendmock sms show <smsId>
sendmock sms status <smsId> <status>
sendmock sms threads
sendmock sms wait
sendmock stats
sendmock status
sendmock update check
sendmock verify force <verificationSid> <status>
sendmock verify list
sendmock verify services create
sendmock verify services delete <serviceSid>
sendmock verify services list
sendmock verify services update <serviceSid>
sendmock verify show <verificationSid>
sendmock version
sendmock webhook deliveries cancel <deliveryId>
sendmock webhook deliveries list
sendmock webhook deliveries replay <deliveryId>
sendmock webhook deliveries show <deliveryId>
sendmock webhook deliveries wait
sendmock webhook endpoint create
sendmock webhook endpoint delete <endpointId>
sendmock webhook endpoint list
sendmock webhook endpoint rotate-secret <endpointId>
sendmock webhook endpoint save-as-template <endpointId>
sendmock webhook endpoint secret <endpointId> --reveal
sendmock webhook endpoint show <endpointId>
sendmock webhook endpoint test <endpointId>
sendmock webhook endpoint update <endpointId>
sendmock webhook metrics
sendmock webhook render --endpoint <endpointId>
sendmock webhook rule create
sendmock webhook rule delete <ruleId>
sendmock webhook rule list
sendmock webhook rule move <ruleId>
sendmock webhook rule preview
sendmock webhook rule show <ruleId>
sendmock webhook rule update <ruleId>
sendmock webhook saved create --delivery <deliveryId>
sendmock webhook saved delete <savedId>
sendmock webhook saved list
sendmock webhook saved rename <savedId>
sendmock webhook saved save-as-template <savedId>
sendmock webhook saved send <savedId>
sendmock webhook send --endpoint <endpointId>
sendmock webhook tail
sendmock webhook template clone <templateId>
sendmock webhook template create
sendmock webhook template delete <templateId>
sendmock webhook template export <templateId>
sendmock webhook template history <templateId>
sendmock webhook template import <file>
sendmock webhook template list
sendmock webhook template reference
sendmock webhook template render <templateId>
sendmock webhook template reset <templateId>
sendmock webhook template restore <templateId> <revision>
sendmock webhook template show <templateId>
sendmock webhook template update <templateId>
sendmock webhook var list
sendmock webhook var preview
sendmock webhook var regenerate <variableId>
sendmock webhook var set <name> <value>
sendmock webhook var unset <variableId>
sendmock webhook var update <variableId>
```

### Scenarios

A declarative file an agent (or human) can write once and replay, ideal for "simulate everything" requests and CI:

```toml
name = "otp-login-and-status"

[[steps]]
run = "webhook.endpoint.create"
with = { name = "app-sms-status", url = "http://localhost:8000/sms/status", template = "twilio.status_callback" }

[[steps]]
run = "webhook.rule.create"
with = { endpoint = "app-sms-status", events = ["sms.status"] }

[[steps]]
run = "http"                       # trigger the user's app
with = { method = "POST", url = "http://localhost:8000/login/otp", json = { phone = "+8801700000000" } }

[[steps]]
run = "sms.wait"
with = { to = "+8801700000000", timeout = "10s" }
save = "otp_sms"

[[steps]]
run = "assert"
with = { that = "{{ otp_sms.extracted.otp | length }} > 0" }

[[steps]]
run = "sms.open"
with = { id = "{{ otp_sms.id }}" }

[[steps]]
run = "webhook.delivery.wait"
with = { endpoint = "app-sms-status", status = "succeeded", count = 3, timeout = "15s" }
```

Steps are operation names, plus `http`, `assert` and `sleep`: an operation's step name is its MCP tool without the `sendmock_` prefix, with dots (`sendmock_webhook_endpoint_create` is `webhook.endpoint.create`). `with` holds the operation's input: path parameters by name, the rest as the query or body. The **Scenarios** screen and `POST /scenarios/run` run the same files. Output is a step-by-step report (`--json` for agents). Scenarios are also exposed as an MCP tool.

## MCP server

### Transports

- **stdio:** `sendmock mcp`. Spawned by the harness. Connects to a running instance; with `--embedded` it starts an in-process server if none is running, so `claude mcp add` alone is enough to get going.
- **Streamable HTTP:** `http://127.0.0.1:8025/mcp` on the running server, for harnesses that prefer a URL. Protected by the same token as the API when auth is enabled.

Built with `rmcp` (the official Rust MCP SDK).

### Tools

Tool names are prefixed `sendmock_` and generated from the registry. Each carries MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`) so harnesses can auto-approve reads and ask before destructive actions.

Generated from the surface catalogue like the command tree; every tool runs one REST operation (a few run several, such as `sendmock_email_check` for the four checks). Revealing an endpoint secret or a gateway credential has no tool on purpose: agents may set secrets but never read them back.

| Toolset | Tools |
|---------|-------|
| `admin` | `sendmock_chaos_set`, `sendmock_reset`, `sendmock_sample_send`, `sendmock_seed_apply`, `sendmock_seed_export`, `sendmock_seed_status`, `sendmock_seed_validate`, `sendmock_settings_get`, `sendmock_settings_update`, `sendmock_update_check` |
| `core` | `sendmock_ai_agents`, `sendmock_events_recent`, `sendmock_integration_snippet`, `sendmock_stats`, `sendmock_status` |
| `email` | `sendmock_email_check`, `sendmock_email_delete`, `sendmock_email_delete_all`, `sendmock_email_forward`, `sendmock_email_get`, `sendmock_email_inbound`, `sendmock_email_latest`, `sendmock_email_list`, `sendmock_email_mime`, `sendmock_email_open`, `sendmock_email_release`, `sendmock_email_reply`, `sendmock_email_search`, `sendmock_email_send`, `sendmock_email_send_raw`, `sendmock_email_send_test`, `sendmock_email_simulate`, `sendmock_email_tag`, `sendmock_email_timeline`, `sendmock_email_update`, `sendmock_email_wait` |
| `extract` | `sendmock_links_get`, `sendmock_otp_get` |
| `http` | `sendmock_http_bin_create`, `sendmock_http_bin_delete`, `sendmock_http_bin_list`, `sendmock_http_bin_update`, `sendmock_http_bins`, `sendmock_http_clear`, `sendmock_http_forward`, `sendmock_http_get`, `sendmock_http_list`, `sendmock_http_response_list`, `sendmock_http_response_preview`, `sendmock_http_response_set`, `sendmock_http_send`, `sendmock_http_wait` |
| `logs` | `sendmock_logs_http`, `sendmock_logs_http_get`, `sendmock_logs_smtp`, `sendmock_logs_smtp_get` |
| `numbers` | `sendmock_messaging_service_create`, `sendmock_messaging_service_delete`, `sendmock_messaging_service_list`, `sendmock_messaging_service_update`, `sendmock_number_delete`, `sendmock_number_list`, `sendmock_number_upsert` |
| `payments` | `sendmock_checkout_complete`, `sendmock_checkout_get`, `sendmock_payment_create_checkout`, `sendmock_payment_flow_create`, `sendmock_payment_flow_delete`, `sendmock_payment_flow_get`, `sendmock_payment_flow_list`, `sendmock_payment_flow_reset`, `sendmock_payment_flow_step_add`, `sendmock_payment_flow_step_move`, `sendmock_payment_flow_step_remove`, `sendmock_payment_flow_step_update`, `sendmock_payment_flow_update`, `sendmock_payment_flow_variable_list`, `sendmock_payment_gateway_create`, `sendmock_payment_gateway_delete`, `sendmock_payment_gateway_get`, `sendmock_payment_gateway_list`, `sendmock_payment_gateway_preview`, `sendmock_payment_gateway_reset`, `sendmock_payment_gateway_update`, `sendmock_payment_get`, `sendmock_payment_list`, `sendmock_payment_method_create`, `sendmock_payment_method_delete`, `sendmock_payment_method_get`, `sendmock_payment_method_list`, `sendmock_payment_method_reset`, `sendmock_payment_method_update`, `sendmock_payment_notify`, `sendmock_payment_simulate`, `sendmock_payment_step_type_list`, `sendmock_payment_test_cards`, `sendmock_payment_wait` |
| `rules` | `sendmock_forward_rule_create`, `sendmock_forward_rule_delete`, `sendmock_forward_rule_list`, `sendmock_forward_rule_move`, `sendmock_forward_rule_update`, `sendmock_inbound_route_create`, `sendmock_inbound_route_delete`, `sendmock_inbound_route_list`, `sendmock_inbound_route_test`, `sendmock_inbound_route_update`, `sendmock_outcome_rule_create`, `sendmock_outcome_rule_delete`, `sendmock_outcome_rule_list`, `sendmock_outcome_rule_move`, `sendmock_outcome_rule_test`, `sendmock_outcome_rule_update`, `sendmock_tag_rule_create`, `sendmock_tag_rule_delete`, `sendmock_tag_rule_list`, `sendmock_tag_rule_move`, `sendmock_tag_rule_update` |
| `scenario` | `sendmock_scenario_run`, `sendmock_scenario_validate` |
| `sms` | `sendmock_sms_delete`, `sendmock_sms_delete_all`, `sendmock_sms_get`, `sendmock_sms_list`, `sendmock_sms_open`, `sendmock_sms_reply_webhook_resend`, `sendmock_sms_send`, `sendmock_sms_set_status`, `sendmock_sms_simulate_inbound`, `sendmock_sms_threads`, `sendmock_sms_wait` |
| `templates` | `sendmock_webhook_template_clone`, `sendmock_webhook_template_create`, `sendmock_webhook_template_delete`, `sendmock_webhook_template_export`, `sendmock_webhook_template_get`, `sendmock_webhook_template_import`, `sendmock_webhook_template_list`, `sendmock_webhook_template_reference`, `sendmock_webhook_template_render`, `sendmock_webhook_template_reset`, `sendmock_webhook_template_restore`, `sendmock_webhook_template_revisions`, `sendmock_webhook_template_update` |
| `variables` | `sendmock_webhook_variable_list`, `sendmock_webhook_variable_preview`, `sendmock_webhook_variable_regenerate`, `sendmock_webhook_variable_set`, `sendmock_webhook_variable_unset`, `sendmock_webhook_variable_update` |
| `verify` | `sendmock_verify_force`, `sendmock_verify_get`, `sendmock_verify_list`, `sendmock_verify_service_create`, `sendmock_verify_service_delete`, `sendmock_verify_service_list`, `sendmock_verify_service_update` |
| `webhooks` | `sendmock_webhook_delivery_cancel`, `sendmock_webhook_delivery_get`, `sendmock_webhook_delivery_list`, `sendmock_webhook_delivery_replay`, `sendmock_webhook_delivery_wait`, `sendmock_webhook_endpoint_create`, `sendmock_webhook_endpoint_delete`, `sendmock_webhook_endpoint_get`, `sendmock_webhook_endpoint_list`, `sendmock_webhook_endpoint_rotate_secret`, `sendmock_webhook_endpoint_save_as_template`, `sendmock_webhook_endpoint_test`, `sendmock_webhook_endpoint_update`, `sendmock_webhook_metrics`, `sendmock_webhook_render`, `sendmock_webhook_rule_create`, `sendmock_webhook_rule_delete`, `sendmock_webhook_rule_get`, `sendmock_webhook_rule_list`, `sendmock_webhook_rule_move`, `sendmock_webhook_rule_preview`, `sendmock_webhook_rule_update`, `sendmock_webhook_saved_create`, `sendmock_webhook_saved_delete`, `sendmock_webhook_saved_list`, `sendmock_webhook_saved_save_as_template`, `sendmock_webhook_saved_send`, `sendmock_webhook_saved_update`, `sendmock_webhook_send` |

Resources: `sendmock://docs/skill`, `sendmock://emails/{emailId}/attachments/{attachmentIndex}`, `sendmock://emails/{emailId}/parts/{attachmentIndex}/thumbnail`, `sendmock://emails/{emailId}/raw`, `sendmock://http/requests/{requestId}/files/{fileIndex}`, `sendmock://sms/{smsId}/media/{mediaIndex}`

- **Toolsets** keep the tool list small for the model: default is `core,email,sms,verify,extract,webhooks`; `--toolsets all` or a custom list enables more (`rules`, `http`, `logs`, `numbers`, `payments`, `templates`, `variables`, `admin`, `scenario`).
- **`--read-only`** exposes only read tools (safe for exploratory sessions).
- Tool results return compact JSON plus a one-line human summary. Large content (HTML bodies, raw source, attachments) is returned as MCP **resources** links instead of inline text, to protect the model's context window.
- **Secrets never leave as plain text**: variable and endpoint secrets are always masked in tool output. Agents can set secrets but not read them back.

### Resources

| URI | Content |
|-----|---------|
| `sendmock://emails/{emailId}` | parsed email (text body, headers summary) |
| `sendmock://emails/{emailId}/raw` | original `.eml` |
| `sendmock://sms/{smsId}` | SMS with status history |
| `sendmock://webhooks/deliveries/{deliveryId}` | full request/response |
| `sendmock://webhooks/templates/{templateId}` | template definition |
| `sendmock://docs/{topic}` | built-in docs: integrations per stack, template reference, filters, scenarios |

Resource subscriptions notify the agent when new emails/SMS/deliveries arrive (where the harness supports it).

### Prompts

Ready-made prompts the user can pick in the harness:

| Prompt | Does |
|--------|------|
| `setup-email-capture` | detect the app's stack in the repo, update its mail config to point at SendMock, send a test |
| `setup-sms-capture` | find the SMS sending code, switch it to SendMock (native or provider-compatible), send a test |
| `setup-inbound-webhook` | choose a provider template, create endpoint + rule, simulate, check delivery log |
| `test-otp-flow` | trigger the app's OTP flow, wait for the SMS/email, return the code |
| `simulate-sms-conversation` | run a scripted two-way SMS exchange against the app's inbound handler |
| `debug-failed-webhook` | inspect the latest failed delivery, explain the error, suggest a fix, replay |
| `add-payment-flow` | compose a checkout flow step by step from the provider's docs (for example "Upay: wallet number, OTP, then PIN" or "a QR wallet"): list the step catalogue, add each step in order with its labels, check the flow is valid, attach it to a method and run a test checkout |
| `add-payment-gateway` | add a gateway SendMock does not ship (or a new method such as a wallet): read the provider's docs the user points to, map them to a gateway, method and (when the provider's checkout steps differ from the built-in flows) flow definition (methods offered, redirect fields, notification event names, body and signature templates), create them, check the preview, run a test checkout and confirm the app receives the redirect and notification |

## Agent skill

A skill teaches the agent the workflows and guardrails, so it uses SendMock well instead of guessing.

- Format: the **Agent Skills** layout (`SKILL.md` with `name` / `description` frontmatter plus reference files). Claude Code and other harnesses that support skills load it directly. For harnesses without skill support, `sendmock ai install` writes an equivalent section into `AGENTS.md` (Codex and others) or the harness's rules file.
- Shipped inside the binary and printed or written with `sendmock ai skill`, so the skill version always matches the binary version.

```
sendmock-skill/
├── SKILL.md                    # when to use sendmock, how to check it is running, core workflows, safety rules
├── reference/
│   ├── cli.md                  # generated from the operation registry
│   ├── mcp-tools.md            # generated
│   ├── integrations.md         # per-stack config (Laravel, Django, Express, Spring, Go, Rails, .NET, Rust)
│   ├── templates.md            # built-in template catalogue
│   ├── payment-gateways.md     # gateway, method and flow definition reference, step catalogue, template values, worked examples (adding Nagad; composing a QR wallet flow)
│   ├── variables-and-filters.md
│   └── scenarios.md
└── examples/
    ├── otp-login.toml
    ├── inbound-email-postmark.toml
    └── two-way-sms-twilio.toml
```

`SKILL.md` core content (draft outline):

1. **When to use:** testing or debugging anything that sends email/SMS or receives provider webhooks locally.
2. **First step:** `sendmock status --json` (or `sendmock_status`). If not running, start it (`sendmock serve` in the background) or ask the user.
3. **Prefer MCP tools when available, otherwise the CLI with `--json`.**
4. **Workflows:** connect an app, read an OTP, set up inbound email/SMS webhooks with the right template, simulate opens and status callbacks, debug failed deliveries (check Logs > SMTP/HTTP first), complete Twilio Verify flows, simulate bounces and complaints, add a payment gateway or method from the provider's docs (definition, preview, test checkout, then export), compose a payment flow step by step, capture Slack/push calls with the HTTP catcher, write a scenario for repeatable tests, and export the final setup with `sendmock seed export` so it can be committed.
5. **Safety rules:** never run `reset` or delete-all without the user's confirmation; never print secret values; do not point webhooks at non-local URLs unless the user asks; prefer creating new endpoints over modifying ones the user made.

## One-command setup per harness

`sendmock ai install --target <harness>` registers the MCP server and installs the skill/instructions:

| Target | MCP registration | Skill / instructions |
|--------|------------------|----------------------|
| `claude-code` | runs `claude mcp add sendmock -- sendmock mcp` (user or project scope) | writes skill to `~/.claude/skills/sendmock/` or `.claude/skills/sendmock/` |
| `codex` | adds `[mcp_servers.sendmock]` with `command = "sendmock"`, `args = ["mcp"]` to `~/.codex/config.toml` | skill folder where supported, otherwise appends to `AGENTS.md` |
| `cursor` | `.cursor/mcp.json` | `.cursor/rules/sendmock.mdc` |
| `gemini` | Gemini CLI `settings.json` `mcpServers` | `GEMINI.md` section |
| `vscode` | `.vscode/mcp.json` | `.github/copilot-instructions.md` section |
| `print` | prints the JSON/TOML snippets for any other harness | prints the skill |

Each target shows a diff and asks before writing unless `--yes`. Exact config file locations and formats per harness are verified at implementation time, since they change between harness versions.

Later: publish SendMock as a **Claude Code plugin** (skill + MCP server bundled) and list it in MCP registries.

## Docs for agents

- `/llms.txt` and `/llms-full.txt` are also published on the docs website for each version ([16-website-and-releases.md](16-website-and-releases.md)).
- `GET /llms.txt` and `/llms-full.txt` on the running server: concise markdown index of features, CLI and API, for agents that browse.
- Every CLI `--help` and MCP tool description is written for models: what it does, when to use it, an example, and what it returns.

## Example: what an agent session looks like

User: "Make my Express app send OTP SMS through SendMock and verify the login flow."

1. `sendmock_status` -> running on `:8025`.
2. `sendmock_integration_snippet { stack: "express", channel: "sms" }` -> agent edits `.env` and the SMS client to use `http://127.0.0.1:8025/api/v1/sms`.
3. Agent calls the app's `/login/otp` endpoint (or runs the app's tests).
4. `sendmock_sms_wait { to: "+8801700000000" }` -> message arrives.
5. `sendmock_otp_get` -> `482913`; agent submits it to `/login/verify` and confirms success.
6. Agent writes `sendmock-scenarios/otp-login.toml` so the flow can be re-run in CI with `sendmock scenario run`.

## Security considerations

- MCP over HTTP and the API share auth; binding beyond localhost without a token prints a warning and disables destructive MCP tools.
- Destructive tools are annotated and also gated by the `--read-only` flag and a `ai.allow_destructive` setting (default true locally, false when bound publicly).
- Webhook targets created via AI are logged with `created_by: "mcp"` / `"cli"` so users can audit what an agent set up (shown in the UI with a small badge).
- Rate limits on MCP tool calls that send webhooks, to stop a looping agent from flooding a local app.

## Roadmap placement

Backend phases (Stage B in [11-roadmap.md](11-roadmap.md)); the UI is finished on mock data first.

- **Phase 0:** `sendmock-ops` registry, CLI client skeleton (`status`, `--json`, exit codes), parity CI check.
- **Phase 1:** email CLI commands and MCP `core`/`email`/`extract` toolsets over stdio.
- **Phase 2:** SMS commands and tools.
- **Phase 3:** webhook, template and variable commands and tools; `webhook tail`, `events tail`.
- **Phase 4:** scenarios, MCP resources and prompts, streamable HTTP transport, agent skill, `sendmock ai install` for all targets, `llms.txt`.
- **Phase 5:** Claude Code plugin packaging, MCP registry listing, skill evals (does an agent complete the example tasks reliably).
