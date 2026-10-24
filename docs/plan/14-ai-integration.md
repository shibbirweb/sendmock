# 14. AI Integration (CLI, MCP, Skill)

Every feature of `mss` must be operable by an AI harness (Claude Code, Codex, Cursor, Gemini CLI, VS Code agents, ...) as well as by a human. A user should be able to say:

> "Set up my Laravel app to receive inbound email in Postmark format, then simulate a customer replying and check my handler works."

and the agent does it end to end: configure the app, create the endpoint and rule, send a test email, read the delivery log, fix the handler, replay.

Three surfaces make that possible:

| Surface | Best for |
|---------|----------|
| **CLI** | any agent with a shell; scripts and CI; humans |
| **MCP server** | agents that support the Model Context Protocol; typed tools, no shell parsing |
| **Agent skill** | teaching the agent *when* and *how* to use `mss` (workflows, safety rules) |

## Parity rule: one operation registry

All features are implemented once as **operations** in a shared `mss-ops` crate (input type, output type, handler, description, read-only/destructive flag). Each surface is a thin adapter over the same registry:

```
             ┌──────────── mss-ops (operations registry) ────────────┐
             │ email.list  sms.send  webhook.endpoint.create  ...    │
             └───────┬──────────┬──────────┬──────────┬──────────────┘
                     │          │          │          │
                 REST API     CLI       MCP tools   Web UI (via REST)
```

- Input/output types derive `serde` + `schemars`, so REST (OpenAPI), CLI flags/help and MCP tool schemas are generated from the same source.
- A CI test enumerates the registry and fails if any operation lacks a REST route, a CLI command or an MCP tool (unless explicitly marked UI-only).
- **Definition of done for every feature** in every phase: UI + REST + CLI + MCP + skill docs updated.

## CLI

The single binary is also the client. Commands talk to a running instance over HTTP (`--url`, `MSS_URL`, default `http://127.0.0.1:8025`, with `--token` / `MSS_TOKEN` when auth is on).

### Agent-friendly conventions

- `--json` on every command for machine-readable output (stable schemas, documented); human tables otherwise. `--json` is the default when stdout is not a TTY.
- Non-interactive by default: no prompts unless `--interactive`; destructive commands need `--yes`.
- Meaningful exit codes: `0` ok, `1` error, `2` usage, `3` not found, `4` timeout (for `wait`), `5` assertion failed.
- `mss <command> --help` includes examples; `mss help --all --json` dumps the whole command tree for agents.
- Inputs accept flags, `--data '<json>'`, or `--file payload.json|toml` (stdin with `-`).

### Command tree

```
mss serve                                   # run the servers
mss status                                  # running? version, ports, counts
mss sendmail ...                            # sendmail shim

mss email list|show|raw|html|attachments|open|tag|delete|delete-all
mss email send-test [--to --subject --html --attach]   # sends a real SMTP message to mss
mss email send --via native|sendgrid|resend|... [...]   # send through an HTTP send API
mss email simulate <emailId> delivered|bounced|complained|unsubscribed [--bounce-type hard|soft]
mss email check <emailId> html|links|spam
mss email mime|timeline <emailId>
mss email release <emailId> [--to ...]
mss email tag-rules|forward-rules list|create|delete
mss email wait --to user@x.test [--subject ...] [--timeout 10s]

mss sms send --from --to --body [--api native|twilio|vonage]
mss sms list|show|threads|status <smsId> <status>|open|delete|delete-all
mss sms inbound --from --to --body [--template twilio.inbound_sms]
mss sms wait --to +8801700000000 [--timeout 10s]
mss sms services list|create|delete                     # Messaging Services

mss verify list|show|force <verificationId> approved|canceled|expired|max_attempts
mss verify services list|create|update|delete

mss http bins|list|show|tail|forward                   # HTTP catcher
mss http response set --bin slack --status 200 --body '...'

mss logs smtp|http [--failed] [--tail]

mss payments list|show|simulate <paymentId> succeed|decline|refund|dispute|notify|test-cards

mss otp --to <address|number> [--channel email|sms] [--wait 10s]
mss links --to <address>

mss numbers list|add|update|remove

mss webhook endpoint list|show|create|update|delete|test
mss webhook rule list|show|create|update|delete|preview
mss webhook template list|show|create|clone|update|delete|render|export|import
mss webhook var list|set|unset|regenerate [--endpoint <name>] [--secret]
mss webhook send --endpoint <name> (--email <id>|--sms <id>|--data ...) [--var k=v]
mss webhook render --endpoint <name> --email <id>
mss webhook deliveries list|show|replay [--rerender]|cancel
mss webhook tail                            # live stream of deliveries
mss webhook saved list|send|delete
mss webhook endpoint rotate-secret <name>

mss settings get|set <key> <value>
mss chaos smtp-reject|smtp-latency|sms-failure-rate|clear
mss events tail [--type email.received]     # live event stream (SSE)
mss reset [--yes]                           # wipe traffic, restore seed state
mss seed export|apply|validate [file]
mss stats

mss scenario run <file.toml>                # scripted simulation (see below)
mss integrate <stack>                       # print config snippet: laravel, django, express, spring, ...

mss mcp [--toolsets ...] [--read-only]      # MCP server over stdio
mss ai install --target claude-code|codex|cursor|gemini|vscode [--scope user|project]
mss ai skill [--print|--write <dir>]        # output the agent skill
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

- **stdio:** `mss mcp`. Spawned by the harness. Connects to a running instance; with `--embedded` it starts an in-process server if none is running, so `claude mcp add` alone is enough to get going.
- **Streamable HTTP:** `http://127.0.0.1:8025/mcp` on the running server, for harnesses that prefer a URL. Protected by the same token as the API when auth is enabled.

Built with `rmcp` (the official Rust MCP SDK).

### Tools

Tool names are prefixed `mss_` and generated from the registry. Each carries MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`) so harnesses can auto-approve reads and ask before destructive actions.

| Toolset | Tools |
|---------|-------|
| `core` | `mss_status`, `mss_stats`, `mss_integration_snippet`, `mss_events_recent` |
| `email` | `mss_email_list`, `mss_email_get`, `mss_email_search`, `mss_email_wait`, `mss_email_send_test`, `mss_email_send` (HTTP APIs), `mss_email_open`, `mss_email_simulate` (delivered/bounce/complaint/unsubscribe), `mss_email_check` (html/links/spam), `mss_email_mime`, `mss_email_timeline`, `mss_email_tag`, `mss_email_delete` |
| `email_relay` | `mss_email_release`, `mss_forward_rule_{list,create,delete}`, `mss_tag_rule_{list,create,delete}` |
| `sms` | `mss_sms_send`, `mss_sms_list`, `mss_sms_get`, `mss_sms_threads`, `mss_sms_wait`, `mss_sms_set_status`, `mss_sms_open`, `mss_sms_simulate_inbound`, `mss_sms_delete`, `mss_messaging_service_{list,create,delete}` |
| `verify` | `mss_verify_list`, `mss_verify_get`, `mss_verify_force`, `mss_verify_service_{list,create,update,delete}` |
| `http` | `mss_http_bins`, `mss_http_list`, `mss_http_get`, `mss_http_wait`, `mss_http_forward`, `mss_http_response_set` |
| `logs` | `mss_logs_smtp`, `mss_logs_http` |
| `payments` | `mss_payment_create_checkout`, `mss_payment_list`, `mss_payment_get`, `mss_payment_simulate`, `mss_payment_notify`, `mss_payment_wait` |
| `extract` | `mss_otp_get`, `mss_links_get` |
| `numbers` | `mss_number_list`, `mss_number_upsert`, `mss_number_delete` |
| `webhooks` | `mss_webhook_endpoint_{list,get,create,update,delete,test,rotate_secret}`, `mss_webhook_saved_{list,send,delete}`, `mss_webhook_rule_{list,create,update,delete,preview}`, `mss_webhook_send`, `mss_webhook_render`, `mss_webhook_delivery_{list,get,replay,cancel,wait}` |
| `templates` | `mss_webhook_template_{list,get,create,clone,update,delete,render,export,import}` |
| `variables` | `mss_webhook_variable_{list,set,unset,regenerate}` |
| `admin` | `mss_settings_get`, `mss_settings_update`, `mss_chaos_set`, `mss_reset`, `mss_seed_export`, `mss_seed_apply` |
| `scenario` | `mss_scenario_run`, `mss_scenario_validate` |

- **Toolsets** keep the tool list small for the model: default is `core,email,sms,verify,extract,webhooks`; `--toolsets all` or a custom list enables more.
- **`--read-only`** exposes only read tools (safe for exploratory sessions).
- Tool results return compact JSON plus a one-line human summary. Large content (HTML bodies, raw source, attachments) is returned as MCP **resources** links instead of inline text, to protect the model's context window.
- **Secrets never leave as plain text**: variable and endpoint secrets are always masked in tool output. Agents can set secrets but not read them back.

### Resources

| URI | Content |
|-----|---------|
| `mss://emails/{emailId}` | parsed email (text body, headers summary) |
| `mss://emails/{emailId}/raw` | original `.eml` |
| `mss://sms/{smsId}` | SMS with status history |
| `mss://webhooks/deliveries/{deliveryId}` | full request/response |
| `mss://webhooks/templates/{templateId}` | template definition |
| `mss://docs/{topic}` | built-in docs: integrations per stack, template reference, filters, scenarios |

Resource subscriptions notify the agent when new emails/SMS/deliveries arrive (where the harness supports it).

### Prompts

Ready-made prompts the user can pick in the harness:

| Prompt | Does |
|--------|------|
| `setup-email-capture` | detect the app's stack in the repo, update its mail config to point at `mss`, send a test |
| `setup-sms-capture` | find the SMS sending code, switch it to `mss` (native or provider-compatible), send a test |
| `setup-inbound-webhook` | choose a provider template, create endpoint + rule, simulate, check delivery log |
| `test-otp-flow` | trigger the app's OTP flow, wait for the SMS/email, return the code |
| `simulate-sms-conversation` | run a scripted two-way SMS exchange against the app's inbound handler |
| `debug-failed-webhook` | inspect the latest failed delivery, explain the error, suggest a fix, replay |

## Agent skill

A skill teaches the agent the workflows and guardrails, so it uses `mss` well instead of guessing.

- Format: the **Agent Skills** layout (`SKILL.md` with `name` / `description` frontmatter plus reference files). Claude Code and other harnesses that support skills load it directly. For harnesses without skill support, `mss ai install` writes an equivalent section into `AGENTS.md` (Codex and others) or the harness's rules file.
- Shipped inside the binary and printed or written with `mss ai skill`, so the skill version always matches the binary version.

```
mss-skill/
├── SKILL.md                    # when to use mss, how to check it is running, core workflows, safety rules
├── reference/
│   ├── cli.md                  # generated from the operation registry
│   ├── mcp-tools.md            # generated
│   ├── integrations.md         # per-stack config (Laravel, Django, Express, Spring, Go, Rails, .NET, Rust)
│   ├── templates.md            # built-in template catalogue
│   ├── variables-and-filters.md
│   └── scenarios.md
└── examples/
    ├── otp-login.toml
    ├── inbound-email-postmark.toml
    └── two-way-sms-twilio.toml
```

`SKILL.md` core content (draft outline):

1. **When to use:** testing or debugging anything that sends email/SMS or receives provider webhooks locally.
2. **First step:** `mss status --json` (or `mss_status`). If not running, start it (`mss serve` in the background) or ask the user.
3. **Prefer MCP tools when available, otherwise the CLI with `--json`.**
4. **Workflows:** connect an app, read an OTP, set up inbound email/SMS webhooks with the right template, simulate opens and status callbacks, debug failed deliveries (check Logs > SMTP/HTTP first), complete Twilio Verify flows, simulate bounces and complaints, capture Slack/push calls with the HTTP catcher, write a scenario for repeatable tests, and export the final setup with `mss seed export` so it can be committed.
5. **Safety rules:** never run `reset` or delete-all without the user's confirmation; never print secret values; do not point webhooks at non-local URLs unless the user asks; prefer creating new endpoints over modifying ones the user made.

## One-command setup per harness

`mss ai install --target <harness>` registers the MCP server and installs the skill/instructions:

| Target | MCP registration | Skill / instructions |
|--------|------------------|----------------------|
| `claude-code` | runs `claude mcp add mss -- mss mcp` (user or project scope) | writes skill to `~/.claude/skills/mss/` or `.claude/skills/mss/` |
| `codex` | adds `[mcp_servers.mss]` with `command = "mss"`, `args = ["mcp"]` to `~/.codex/config.toml` | skill folder where supported, otherwise appends to `AGENTS.md` |
| `cursor` | `.cursor/mcp.json` | `.cursor/rules/mss.mdc` |
| `gemini` | Gemini CLI `settings.json` `mcpServers` | `GEMINI.md` section |
| `vscode` | `.vscode/mcp.json` | `.github/copilot-instructions.md` section |
| `print` | prints the JSON/TOML snippets for any other harness | prints the skill |

Each target shows a diff and asks before writing unless `--yes`. Exact config file locations and formats per harness are verified at implementation time, since they change between harness versions.

Later: publish `mss` as a **Claude Code plugin** (skill + MCP server bundled) and list it in MCP registries.

## Docs for agents

- `/llms.txt` and `/llms-full.txt` are also published on the docs website for each version ([16-website-and-releases.md](16-website-and-releases.md)).
- `GET /llms.txt` and `/llms-full.txt` on the running server: concise markdown index of features, CLI and API, for agents that browse.
- Every CLI `--help` and MCP tool description is written for models: what it does, when to use it, an example, and what it returns.

## Example: what an agent session looks like

User: "Make my Express app send OTP SMS through mss and verify the login flow."

1. `mss_status` -> running on `:8025`.
2. `mss_integration_snippet { stack: "express", channel: "sms" }` -> agent edits `.env` and the SMS client to use `http://127.0.0.1:8025/api/v1/sms`.
3. Agent calls the app's `/login/otp` endpoint (or runs the app's tests).
4. `mss_sms_wait { to: "+8801700000000" }` -> message arrives.
5. `mss_otp_get` -> `482913`; agent submits it to `/login/verify` and confirms success.
6. Agent writes `mss-scenarios/otp-login.toml` so the flow can be re-run in CI with `mss scenario run`.

## Security considerations

- MCP over HTTP and the API share auth; binding beyond localhost without a token prints a warning and disables destructive MCP tools.
- Destructive tools are annotated and also gated by the `--read-only` flag and a `ai.allow_destructive` setting (default true locally, false when bound publicly).
- Webhook targets created via AI are logged with `created_by: "mcp"` / `"cli"` so users can audit what an agent set up (shown in the UI with a small badge).
- Rate limits on MCP tool calls that send webhooks, to stop a looping agent from flooding a local app.

## Roadmap placement

Backend phases (Stage B in [11-roadmap.md](11-roadmap.md)); the UI is finished on mock data first.

- **Phase 0:** `mss-ops` registry, CLI client skeleton (`status`, `--json`, exit codes), parity CI check.
- **Phase 1:** email CLI commands and MCP `core`/`email`/`extract` toolsets over stdio.
- **Phase 2:** SMS commands and tools.
- **Phase 3:** webhook, template and variable commands and tools; `webhook tail`, `events tail`.
- **Phase 4:** scenarios, MCP resources and prompts, streamable HTTP transport, agent skill, `mss ai install` for all targets, `llms.txt`.
- **Phase 5:** Claude Code plugin packaging, MCP registry listing, skill evals (does an agent complete the example tasks reliably).
