# Changelog

All notable changes to SendMock are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/).

Write every user-visible change under **Unreleased** in the same pull request that makes it. The Prepare release workflow publishes those notes as they are with each beta, and dates them into a `## [x.y.z] - YYYY-MM-DD` section for a stable release. That section becomes the GitHub release notes and the website's changelog.

## [Unreleased]

### Added

- SendMock catches the email, SMS, push notifications, payments and webhooks your app sends while you develop and test, and shows them in a web UI at http://127.0.0.1:8025. Your app talks to it over SMTP and the providers' own HTTP APIs, so nothing reaches a real inbox, phone or payment provider. `sendmock --demo` starts it with sample data to look around.
- **Email:** an SMTP server on port 1025 (with STARTTLS, AUTH and a size limit), the send APIs of SendGrid, Mailgun, Postmark, Resend, Amazon SES and Brevo, a native `POST /api/v1/send`, a `sendmail` shim and a Mailpit-compatible API. Each email shows its HTML, text, source, headers and attachments, with link and spam checks, and one-time codes and links pulled out for your tests.
- **Email outcomes:** simulate delivered, bounced, deferred, spam complaint and unsubscribe, by hand or with outcome addresses and rules, and send the matching webhooks in each provider's own format. Reply, reply all or forward as the recipient to test inbound mail, and read the mailbox over POP3 (`--pop3-addr`).
- **Release to a real inbox:** send one real copy of a caught email through your SMTP relay, or forward arriving emails with auto-forward rules, only to the recipients you allow.
- **SMS and verification codes:** the APIs of Twilio (Messages, Messaging Services and Verify), Vonage (SMS and Verify v2), AWS SNS, Infobip, Sinch, Africa's Talking, MessageBird and Telnyx, shown as conversations with delivery status, status callbacks and replies. Twilio's official test numbers fail exactly as on Twilio, and WhatsApp Business Cloud API messages, media and webhooks work too.
- **Push notifications:** FCM HTTP v1, Expo and OneSignal sends, with an iOS and Android lock screen preview and magic tokens for each provider's failures.
- **Payments:** Stripe, PayPal, Razorpay, Paddle, bKash, SSLCommerz and your own gateways, with a hosted test checkout page, subscriptions, refunds and disputes, and simulated outcomes that send the provider's webhooks.
- **Webhooks back to your app:** rules that send Standard Webhooks or a provider's own format on any event, with templates, variables, signing secrets, retries with backoff, a delivery log, replay and saved deliveries, and inbound routes like Mailgun's.
- **HTTP catcher:** bins that capture any request your app sends (Slack, Discord, Teams, Telegram and more), with previews and mock responses, and a catch-all port (`--catcher-addr`).
- **Projects:** keep the mail, SMS and codes of several apps apart in one SendMock, picked by the SMTP username, a header or a URL prefix.
- **For tests and CI:** wait for the next email or SMS and read its code or link over the REST API, the CLI or MCP; reset to a seed file (`sendmock.seed.toml`) before each run; and script whole flows as scenarios. Testcontainers modules for Node.js, Python, Go, Java and .NET start SendMock inside your tests.
- **Every feature in four ways:** the web UI, a REST API described by OpenAPI, the `sendmock` CLI with `--json` output, and an MCP server for AI agents. `sendmock ai install` sets SendMock up in Claude Code, Codex, Cursor, Gemini CLI or VS Code with its agent skill, and Claude Code users can install it as a plugin.
- **Retention:** keep the newest 1,000 emails and 1,000 SMS by default, change the limits with `--max-emails`, `--max-sms` or `--max-age`, or set a limit to 0 to keep everything (with a warning, since the database then grows until the disk is full).
- **Safe by default:** SendMock listens on 127.0.0.1 only, can require a login (`--ui-auth`) or an API token (`--api-token`), and masks secrets in the UI, API answers, logs and seed exports.
- **Install your way:** `npx sendmock` or `bunx sendmock` with nothing installed, Docker (GHCR and Docker Hub, signed, with an SBOM), Homebrew, Scoop, WinGet, Chocolatey, apt, dnf, Nix, Cargo, an install script or a plain binary for macOS, Linux and Windows on x64 and Arm. A Helm chart, a Docker Desktop extension and a menu bar app are there too.
- **Docs:** a guide for every screen and setting, a page that explains every control, recipes in nine languages, the API, CLI and MCP references and a live demo, at https://shibbirweb.github.io/sendmock/.

### Fixed

- **Live updates under load:** the mail list keeps showing new mail while an app sends thousands of emails, and toasts and browser notifications show at most one every 2 seconds, saying how many more arrived.
- **Package repository:** the APT and YUM repository at https://shibbirweb.github.io/sendmock/packages/ is now published with each release, so `apt install sendmock` and `dnf install sendmock` with the beta component work as the [install page](https://shibbirweb.github.io/sendmock/docs/install/) shows.
- **npm and Maven Central:** the `sendmock` package on npm (for `npx sendmock@beta` and `bunx sendmock@beta`) and the Java Testcontainers module `io.github.shibbirweb:sendmock-testcontainers` on Maven Central are published with each release.
- **`npx sendmock` with no tag:** until 1.0.0, each beta is also npm's `latest` version, so `npx sendmock` and `bunx sendmock` run the newest beta instead of an empty placeholder package.
