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

### Command tree

```
sendmock serve                                   # run the servers
sendmock status                                  # running? version, ports, counts
sendmock sendmail ...                            # sendmail shim

sendmock email list|show|raw|html|attachments|open|tag|delete|delete-all
sendmock email send-test [--to --subject --html --attach]   # sends a real SMTP message to sendmock
sendmock email send --via native|sendgrid|resend|... [...]   # send through an HTTP send API
sendmock email simulate <emailId> delivered|bounced|complained|unsubscribed [--bounce-type hard|soft]
sendmock email check <emailId> html|links|spam
sendmock email mime|timeline <emailId>
sendmock email release <emailId> [--to ...]
sendmock email tag-rules|forward-rules list|create|delete
sendmock email wait --to user@x.test [--subject ...] [--timeout 10s]

sendmock sms send --from --to --body [--api native|twilio|vonage]
sendmock sms list|show|threads|status <smsId> <status>|open|delete|delete-all
sendmock sms inbound --from --to --body [--template twilio.inbound_sms]
sendmock sms wait --to +8801700000000 [--timeout 10s]
sendmock sms services list|create|delete                     # Messaging Services

sendmock verify list|show|force <verificationId> approved|canceled|expired|max_attempts
sendmock verify services list|create|update|delete

sendmock http bins|list|show|tail|forward                   # HTTP catcher
sendmock http response set --bin slack --status 200 --body '...'

sendmock logs smtp|http [--failed] [--tail]

sendmock payments list|show|simulate <paymentId> succeed|decline|refund|dispute|notify|test-cards
sendmock payments gateways list|show|create|update|reset|delete|preview   # gateway definitions (JSON in / out)
sendmock payments methods list|show|create|update|reset|delete
sendmock payments flows list|show|create|update|reset|delete   # flows built step by step from the step catalogue
sendmock payments flows steps add|move|remove|update            # edit one step of a flow (type, position, labels)
sendmock payments flows step-types                             # the step catalogue with each step's fields
sendmock payments flows variables                              # the label variables ({method}, {amount}, ...) with what each becomes

sendmock otp --to <address|number> [--channel email|sms] [--wait 10s]
sendmock links --to <address>

sendmock numbers list|add|update|remove

sendmock webhook endpoint list|show|create|update|delete|test
sendmock webhook rule list|show|create|update|delete|preview
sendmock webhook template list|show|create|clone|update|delete|render|export|import
sendmock webhook var list|set|unset|regenerate [--endpoint <name>] [--secret]
sendmock webhook send --endpoint <name> (--email <id>|--sms <id>|--data ...) [--var k=v]
sendmock webhook render --endpoint <name> --email <id>
sendmock webhook deliveries list|show|replay [--rerender]|cancel
sendmock webhook tail                            # live stream of deliveries
sendmock webhook saved list|send|delete
sendmock webhook endpoint rotate-secret <name>

sendmock settings get|set <key> <value>
sendmock chaos smtp-reject|smtp-latency|sms-failure-rate|clear
sendmock events tail [--type email.received]     # live event stream (SSE)
sendmock reset [--yes]                           # wipe traffic, restore seed state
sendmock seed export|apply|validate [file]
sendmock stats

sendmock scenario run <file.toml>                # scripted simulation (see below)
sendmock integrate <stack>                       # print config snippet: laravel, django, express, spring, ...

sendmock mcp [--toolsets ...] [--read-only]      # MCP server over stdio
sendmock ai install --target claude-code|codex|cursor|gemini|vscode [--scope user|project]
sendmock ai skill [--print|--write <dir>]        # output the agent skill
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
run = "webhook.deliveries.wait"
with = { endpoint = "app-sms-status", status = "succeeded", count = 3, timeout = "15s" }
```

Steps are operation names from the registry, plus `http`, `assert`, `sleep`. Output is a step-by-step report (`--json` for agents). Scenarios are also exposed as an MCP tool.

## MCP server

### Transports

- **stdio:** `sendmock mcp`. Spawned by the harness. Connects to a running instance; with `--embedded` it starts an in-process server if none is running, so `claude mcp add` alone is enough to get going.
- **Streamable HTTP:** `http://127.0.0.1:8025/mcp` on the running server, for harnesses that prefer a URL. Protected by the same token as the API when auth is enabled.

Built with `rmcp` (the official Rust MCP SDK).

### Tools

Tool names are prefixed `sendmock_` and generated from the registry. Each carries MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`) so harnesses can auto-approve reads and ask before destructive actions.

| Toolset | Tools |
|---------|-------|
| `core` | `sendmock_status`, `sendmock_stats`, `sendmock_integration_snippet`, `sendmock_events_recent` |
| `email` | `sendmock_email_list`, `sendmock_email_get`, `sendmock_email_search`, `sendmock_email_wait`, `sendmock_email_send_test`, `sendmock_email_send` (HTTP APIs), `sendmock_email_open`, `sendmock_email_simulate` (delivered/bounce/complaint/unsubscribe), `sendmock_email_check` (html/links/spam), `sendmock_email_mime`, `sendmock_email_timeline`, `sendmock_email_tag`, `sendmock_email_delete` |
| `email_relay` | `sendmock_email_release`, `sendmock_forward_rule_{list,create,delete}`, `sendmock_tag_rule_{list,create,delete}` |
| `sms` | `sendmock_sms_send`, `sendmock_sms_list`, `sendmock_sms_get`, `sendmock_sms_threads`, `sendmock_sms_wait`, `sendmock_sms_set_status`, `sendmock_sms_open`, `sendmock_sms_simulate_inbound`, `sendmock_sms_delete`, `sendmock_messaging_service_{list,create,delete}` |
| `verify` | `sendmock_verify_list`, `sendmock_verify_get`, `sendmock_verify_force`, `sendmock_verify_service_{list,create,update,delete}` |
| `http` | `sendmock_http_bins`, `sendmock_http_list`, `sendmock_http_get`, `sendmock_http_wait`, `sendmock_http_forward`, `sendmock_http_response_set` |
| `logs` | `sendmock_logs_smtp`, `sendmock_logs_http` |
| `payments` | `sendmock_payment_create_checkout`, `sendmock_payment_list`, `sendmock_payment_get`, `sendmock_payment_simulate`, `sendmock_payment_notify`, `sendmock_payment_wait`, `sendmock_payment_gateway_list`, `sendmock_payment_gateway_get`, `sendmock_payment_gateway_create`, `sendmock_payment_gateway_update`, `sendmock_payment_gateway_preview`, `sendmock_payment_gateway_reset`, `sendmock_payment_method_list`, `sendmock_payment_method_get`, `sendmock_payment_method_create`, `sendmock_payment_method_update`, `sendmock_payment_method_reset`, `sendmock_payment_flow_list`, `sendmock_payment_flow_get`, `sendmock_payment_flow_create`, `sendmock_payment_flow_update`, `sendmock_payment_flow_reset`, `sendmock_payment_flow_delete`, `sendmock_payment_flow_step_add`, `sendmock_payment_flow_step_move`, `sendmock_payment_flow_step_remove`, `sendmock_payment_flow_step_update`, `sendmock_payment_step_type_list`, `sendmock_payment_flow_variable_list` (create and update take the same definition as the UI and are checked by the same validation; reset and delete are marked destructive and ask first) |
| `extract` | `sendmock_otp_get`, `sendmock_links_get` |
| `numbers` | `sendmock_number_list`, `sendmock_number_upsert`, `sendmock_number_delete` |
| `webhooks` | `sendmock_webhook_endpoint_{list,get,create,update,delete,test,rotate_secret}`, `sendmock_webhook_saved_{list,send,delete}`, `sendmock_webhook_rule_{list,create,update,delete,preview}`, `sendmock_webhook_send`, `sendmock_webhook_render`, `sendmock_webhook_delivery_{list,get,replay,cancel,wait}` |
| `templates` | `sendmock_webhook_template_{list,get,create,clone,update,delete,render,export,import}` |
| `variables` | `sendmock_webhook_variable_{list,set,unset,regenerate}` |
| `admin` | `sendmock_settings_get`, `sendmock_settings_update`, `sendmock_chaos_set`, `sendmock_reset`, `sendmock_seed_export`, `sendmock_seed_apply` |
| `scenario` | `sendmock_scenario_run`, `sendmock_scenario_validate` |

- **Toolsets** keep the tool list small for the model: default is `core,email,sms,verify,extract,webhooks`; `--toolsets all` or a custom list enables more.
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
