# 29. Phase 4: Integrations, fidelity and AI

Phase 4 makes SendMock a drop-in for the providers apps already use and gives agents a first-class way in: the email providers' HTTP send APIs and their webhook formats, configurable and custom email and SMS providers, email quality checks, release and forwarding, inbound email and Mailgun-style routes, the rest of the webhook templating (fake data, aliases, environment variables, multipart bodies, the remaining built-in templates), more SMS providers and WhatsApp, the HTTP catcher backend, chaos and scenarios, more payment gateways with subscriptions and disputes, the published OpenAPI spec, the AI integration (MCP resources and prompts, streamable HTTP, the agent skill, `sendmock ai install`, `llms.txt`) and example apps in eight languages ([11](11-roadmap.md#phase-4-integrations-fidelity-and-ai-about-2-3-weeks)).

## Goal and done-when

**Done when** (from [11](11-roadmap.md#phase-4-integrations-fidelity-and-ai-about-2-3-weeks)): all eight example apps pass their smoke tests in CI, and an agent in Claude Code and Codex completes the example session in [14](14-ai-integration.md#example-what-an-agent-session-looks-like). In full:

- every Phase 4 item in [PROGRESS.md](PROGRESS.md) is ticked and the Phase 4 criteria of the features below have passing tests that name them;
- the `examples/` apps for PHP, Node, Python, Go, Java, Rust, Ruby and .NET run in CI against a release binary;
- the HTTP Catcher, Scenarios and Mail > Providers screens run in the live UI suite with real data and no failing calls;
- the agent session runs through the MCP server and the skill, recorded as a scripted MCP client test in CI (a real agent run in Claude Code and Codex is checked by hand before the release).

## Workstreams and order

All on `feat/phase-0` in #48, a commit per workstream, as for Phases 1 to 3P. Large workstreams are split (W1a, W1b, ...) when they are started, and each gets its design note below before any code.

| # | Workstream | Features (Phase 4 criteria) | Depends on |
|---|------------|-----------------------------|------------|
| W1 | Email provider HTTP send APIs on the provider port: SendGrid v3 mail send, Mailgun messages, Postmark email and batch, Resend emails, SES v2 `SendEmail`, Brevo SMTP API; template ID and data captured; each provider's real answer and error shapes; an SDK compatibility test per provider with an official SDK | EM-08 | |
| W2 | Webhook templating, the rest: `fake.*` functions with locales, Postman-style `{{$random...}}` aliases, `SENDMOCK_VAR_*` variables, multipart Fields bodies with file fields, template import and export, `--templates-dir`, template revisions | WH-07 (Phase 4), WH-09 (Phase 4) | |
| W3 | The remaining built-in templates (Mailgun, SendGrid, Postmark, SES, Resend, Brevo, Mandrill, SparkPost; Plivo, MessageBird, Telnyx, Sinch, Infobip, Africa's Talking; Teams, Google Chat, Telegram, n8n, Zapier, Make) with provider fixture tests; the email providers' event formats for delivered, bounce, complaint and open, and Twilio `MessageStatus=read` | WH-08, WH-06 (email providers), EM-10 (provider formats), EM-11, SM-10 | W2 |
| W4 | Email provider definitions answered from the database, custom email and SMS providers, Mail > Providers live, custom providers in SMS > Providers, the `add-sms-provider` CLI and MCP surfaces | EM-18, SM-16 | W1 |
| W5 | Email quality checks: HTML compatibility from caniemail data, the link check, the optional SpamAssassin check | EM-13 (HTML, link, spam) | |
| W6 | Release to a real SMTP relay and auto-forward rules behind the recipient allowlist; tag rules | EM-14, EM-12 (tag rules) | |
| W7 | Replies and inbound email: reply, reply all and forward as the recipient, `POST /emails/inbound`, inbound domains, `email.inbound`, Mailgun-style routes (`match_recipient`, `forward`, `store`, `stop`) and the `/v3/routes` API; SendGrid Inbound Parse, Mailgun routes and Postmark inbound formats | EM-17, WH-12 | W2, W3 |
| W8 | More SMS providers (Plivo, MessageBird, the generic GET or POST vendor) and WhatsApp via Twilio (`whatsapp:` addresses, the channel badge, inbound, `read` status) | SM-05, SM-11 | W4 |
| W9 | HTTP catcher backend: catch path, bins, mock response rules, the Slack, Discord, Telegram and FCM presets, `wait/http`, `POST /samples/http`; HTTP Catcher screens live; CLI and MCP `http` toolset | HC-01, HC-02, HC-03 (Phase 4), PL-03 (HTTP) | |
| W10 | Chaos and scenarios: SMTP rejects and latency, SMS failures, chaos in the `admin` toolset; scenarios (`sendmock scenario run`), the Scenarios screen live, the `scenario` and `rules` toolsets | EM-15, AI-04 | W6, W7, W9 |
| W11 | Payments: bKash tokenized checkout, Razorpay orders and signatures, Paddle transactions and signatures; subscriptions and the `subscription.*` events; answering disputes | PY-10, PY-07.3, PY-08.1 | |
| W12 | OpenAPI published with the binary and the site, and the API docs page in the UI | PL-01 | |
| W13 | AI: MCP resources and prompts, streamable HTTP transport, the agent skill (with the `add-payment-gateway`, `add-payment-flow` and `add-sms-provider` workflows), `sendmock ai install` for Claude Code, Codex, Cursor, Gemini CLI and VS Code, `llms.txt` | AI-03, AI-05 (Phase 4), AI-06, PY-12.5 (skill), SM-16.6 (skill) | W1 to W12 |
| W14 | Examples: verified SDK redirection recipes and `examples/` apps for PHP, Node, Python, Go, Java, Rust, Ruby and .NET, each with a CI smoke test against a release binary | WS-08 (examples), Phase 4 done-when | W1, W8 |
| W15 | Done-when: the eight example apps green in CI, the scripted agent session over MCP with the skill, and the live UI suite covering the Phase 4 screens | Phase 4 done-when | W1 to W14 |

## As built

## Design notes

- **Same patterns as before:** every provider emulation is an Adapter registered in the provider runtime beside Twilio, Vonage, Stripe, PayPal and SSLCommerz, answering at the provider's real paths on the provider port and under `/providers/<key>/...`, with the provider's real answer and error shapes and a fixture test built from its docs; every new operation comes with REST, CLI, MCP and skill docs from the `sendmock-ops` registry; every new screen or tab joins the live UI suite.
- **Outbound traffic stays off by default:** release, auto-forward and HTTP catcher forwarding only reach the network when an allowlist is configured ([AGENTS.md](../../AGENTS.md#project-rules)); everything else keeps working with outbound traffic blocked, as the Payment apps workflow proves for payments.
- **Official SDKs where they exist:** each provider emulation is checked with the provider's official SDK in CI, pointed at the provider port by its base URL setting, or through the provider port as a plain HTTP proxy when the SDK has no base URL setting (as for PayPal in Phase 3P W12b).
