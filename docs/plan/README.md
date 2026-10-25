# Project Plan

Product name: **SendMock**: "send it to the mock". Your app sends email, SMS, payments and webhooks to SendMock instead of the real services. Binary and package name `sendmock`; published from the `shibbirweb` GitHub account. How the name was chosen: [10-open-questions.md](10-open-questions.md#1-product-name-decided-2026-10-25-sendmock).

## One-line pitch

A single, lightweight, cross-platform binary (or Docker image) that catches **email (SMTP and provider HTTP APIs)** and **SMS (provider-compatible HTTP APIs)** from any app on your machine, shows them in a clean web UI, and forwards them to your app through **automatic or manual webhooks**.

Think "Mailpit, plus a fake SMS gateway, plus a webhook workbench", in one Rust binary with an embedded Bun + shadcn/ui frontend.

**Where are we?** See [PROGRESS.md](PROGRESS.md) for the current phase, completed and remaining work, and decisions. **Is a feature really done?** See [acceptance/](acceptance/README.md) for each feature's acceptance criteria and status.

## Documents

| # | Document | What it covers |
|---|----------|----------------|
| 01 | [Vision and scope](01-vision.md) | Problem, target users, goals, non-goals |
| 02 | [Architecture](02-architecture.md) | Components, tech stack, repo layout, data model |
| 03 | [Email (SMTP)](03-email.md) | SMTP server, MIME parsing, storage, sendmail shim |
| 04 | [SMS gateway](04-sms.md) | Native API, provider emulation, delivery simulation |
| 05 | [Webhooks](05-webhooks.md) | Auto rules, manual send, payload formats, retries, signing |
| 06 | [HTTP API](06-api.md) | REST API, realtime stream, test helpers |
| 07 | [Web UI](07-ui.md) | Screens, UX principles, frontend stack |
| 08 | [Language integrations](08-integrations.md) | PHP, Node, Python, Go, Java, Rust, Ruby, .NET |
| 09 | [Build and distribution](09-distribution.md) | Single binary, cross-compile, Docker, package managers |
| 10 | [Open questions](10-open-questions.md) | Decisions still to make, including the name |
| 11 | [Roadmap](11-roadmap.md) | Stage A (UI with mock data) then Stage B (backend); phases and acceptance criteria |
| 12 | [Webhook variables](12-webhook-variables.md) | Static, secret, dynamic, random, computed and prompt variables; text filters; body modes |
| 13 | [Webhook templates](13-webhook-templates.md) | Built-in templates for Twilio, Mailgun, SendGrid, Slack and more; custom templates, import/export |
| 14 | [AI integration](14-ai-integration.md) | Full CLI, MCP server and agent skill so Claude Code, Codex and others can drive every feature |
| 15 | [HTTP catcher](15-http-catcher.md) | Request bin for any other outbound HTTP (Slack, Discord, push, Telegram) with mock responses |
| 16 | [Website and releases](16-website-and-releases.md) | GitHub Pages docs site with Magic UI and an API playground; `develop` = beta, `main` = stable release workflows |
| 17 | [Payment gateway emulation](17-payments.md) | Stripe, PayPal, SSLCommerz, bKash, Razorpay compatible APIs, test checkout page, IPN and payment webhooks |
| 18 | [Phase U3](18-phase-u3.md) | Polish, website, contract freeze and sign-off: workstreams in order, design review checklist and table, notifications, accessibility, responsive, performance, OpenAPI freeze, landing page, docs, playground |

## Headline decisions

- **UI first:** the complete UI is built and signed off on mock data (MSW mock API, realistic fixtures, simulated realtime) before backend work starts. See [11-roadmap.md](11-roadmap.md).
- **Backend:** Rust (tokio + axum), custom SMTP receiver, SQLite storage.
- **Frontend:** React + TypeScript + Tailwind + shadcn/ui, built with Bun and Vite, embedded into the binary at compile time.
- **Delivery:** one static binary per platform (macOS, Linux, Windows; x64 and arm64), plus a first-class multi-arch Docker image (Compose, CI service containers, Testcontainers).
- **Broad capture:** SMTP and email provider HTTP APIs (SendGrid, Mailgun, Postmark, Resend, SES, Brevo); SMS provider APIs incl. Twilio Verify; a fake payment gateway (Stripe, PayPal, SSLCommerz, bKash, Razorpay) with test checkout and IPN; an HTTP catcher for everything else.
- **Standards over custom:** webhooks signed with Standard Webhooks; SMS magic numbers match Twilio's official test numbers.
- **Language agnostic by design:** apps talk to it over SMTP and HTTP only, so any language works without an SDK.
- **Website and releases:** docs and API playground on GitHub Pages built with Fumadocs + Magic UI; `develop` ships betas, `main` ships stables, all cut by workflows (same model as the phpdebugger repo).
- **AI native:** every feature is reachable from the UI, REST API, CLI and an MCP server, with an agent skill so AI harnesses can set up and simulate everything.
