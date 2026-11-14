# 01. Vision and Scope

## The problem

Almost every app sends email and SMS: sign-up verification, OTP codes, password resets, notifications, receipts. Testing these flows locally is painful:

1. **Email:** you need a fake SMTP server so real mail never leaves your machine. Tools like Mailpit and MailHog solve this well, but only for email.
2. **SMS:** there is no common equivalent. Developers either burn real SMS credits on a vendor sandbox, write ad-hoc mocks per project, or log OTPs to the console and copy-paste them.
3. **Inbound flows and webhooks:** many apps also *receive* email and SMS (reply-by-email, inbound SMS commands, delivery status callbacks). Testing that means exposing localhost through a tunnel and waiting on a real vendor to call you back. It is slow, flaky and needs internet.
4. **Per-language tooling:** existing mocks are often tied to one ecosystem (a PHP package, an npm library). Polyglot teams end up maintaining several.

## The solution

SendMock is a local "communications sandbox" that:

- **Acts as a mail server and email provider.** Accepts any email over SMTP or through SendGrid / Mailgun / Postmark / Resend / SES / Brevo compatible HTTP APIs, stores it, shows it in the browser, and simulates delivery outcomes (delivered, bounced, complained).
- **Acts as an SMS vendor.** Exposes an HTTP API that looks like popular SMS providers, including Twilio Verify for OTP flows (plus a simple native API), stores every message, and simulates delivery status with Twilio's real test numbers.
- **Acts as a payment gateway.** Stripe, PayPal, SSLCommerz, bKash and Razorpay compatible APIs, a test checkout page with success, decline, cancel and 3-D Secure, and signed IPN / webhook events, refunds and disputes. Only test cards are accepted; no real money ever moves.
- **Catches any other outbound HTTP.** Slack, Discord, push notifications and other API calls land in an HTTP catcher with mock responses.
- **Calls your webhooks.** Automatically (rules that fire on events) or manually (a button or API call), with payloads in a native JSON format or in the shape real providers use.
- **Works with any language.** Integration is a config change (SMTP host/port, SMS API base URL), not a library.
- **Ships as one small binary or a Docker image.** Download, run, open `http://localhost:8025`. No runtime, no database server; Docker is supported (multi-arch image, Compose, CI service containers) but never required.

## Landscape

Closest tools (October 2026) and where SendMock differs:

| Tool | What it covers | Gap SendMock fills |
|------|----------------|-----------------------|
| Mailpit, MailHog, smtp4dev, Sendria | Local email capture | SMS, payments, provider APIs, webhook workbench |
| Mailtrap (cloud) and Mailtrap Local (open source, July 2026) | Email sandbox, now also self-hosted | SMS, payments, provider emulation, one binary for all |
| MockPost (Python) | Email, SMS, chat and push capture with MCP | Single binary, provider-accurate emulation, payments, webhook templates |
| vercel-labs/emulate | Stateful emulators for Twilio, Stripe, Resend and others | Unified UI, mail server, regional SMS and payment gateways (SSLCommerz, bKash) |
| Stripe CLI, Webhook.site, Hookdeck | Webhook triggering and inspection | Capturing what your app sends, not only what it receives |

## Target users

| User | What they need |
|------|----------------|
| Backend developer (PHP, Node, Python, Go, Java, Rust, ...) | See outgoing email/SMS instantly, grab OTP codes, test inbound webhook handlers without a tunnel |
| QA / E2E test author | An API to wait for and assert on messages in CI (Playwright, Cypress, PHPUnit, pytest) |
| Frontend / mobile developer | A shared dev environment where SMS OTP login works without real phone numbers |
| Team / CI pipeline | A Docker image or binary that boots in milliseconds inside CI |
| AI coding agent (on behalf of any of the above) | Typed tools (MCP) or a scriptable CLI to configure apps, simulate traffic and verify results |

## Goals

1. **Super lightweight.** Target: release binary under 20 MB, idle memory under 30 MB, cold start under 200 ms.
2. **Zero config to start.** `sendmock` with no flags works with sensible defaults.
3. **Cross platform.** macOS (Apple Silicon and Intel), Linux (x64, arm64, static musl), Windows (x64, arm64).
4. **Excellent UI.** Fast, keyboard friendly, dark/light mode, realtime updates, built with shadcn/ui.
5. **First-class webhooks.** Auto and manual triggers, delivery logs, retries, replay, signing, provider-shaped payloads.
6. **Test-automation friendly.** Stable REST API, "wait for message" endpoints, OTP extraction helper, OpenAPI spec.
7. **Drop-in where possible.** Same default SMTP/HTTP ports as Mailpit/MailHog, Twilio-compatible SMS endpoints.
8. **AI native.** Every feature is operable from a CLI, an MCP server and an agent skill, so Claude Code, Codex and other harnesses can set up and simulate everything for the user.

## Non-goals

- **Not a production mail server.** It does not relay to the internet by default, does not do MX/DKIM/SPF validation for real-world delivery, and should not be exposed publicly. (Release and auto-forward to a real SMTP relay exist, but are off by default and require an explicit recipient allowlist.)
- **Not a real SMS gateway.** It never contacts carriers.
- **Not a full provider clone.** Provider emulation covers the endpoints apps actually use for sending and status callbacks, not entire vendor APIs.
- **No multi-tenant SaaS** in v1. It is a local or self-hosted dev tool.

## Success criteria for v1.0

- A developer in any of the 8 listed languages can point their app at SendMock and see email and SMS in under 5 minutes, following [08-integrations.md](08-integrations.md).
- Webhook rules can forward every received email/SMS to a local URL, with full request/response logs and one-click replay.
- One binary per platform is published on GitHub Releases, Homebrew, Scoop and Docker Hub / GHCR.
