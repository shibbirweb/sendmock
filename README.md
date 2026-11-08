# SendMock

[![CI](https://github.com/shibbirweb/sendmock/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/shibbirweb/sendmock/actions/workflows/ci.yml?query=branch%3Adevelop)
[![Release](https://img.shields.io/github/v/release/shibbirweb/sendmock?include_prereleases&sort=semver&label=release)](https://github.com/shibbirweb/sendmock/releases)
[![npm](https://img.shields.io/npm/v/sendmock?label=npm)](https://www.npmjs.com/package/sendmock)
[![crates.io](https://img.shields.io/crates/v/sendmock?label=crates.io)](https://crates.io/crates/sendmock)
[![Docker pulls](https://img.shields.io/docker/pulls/shibbirweb/sendmock?label=docker%20pulls)](https://hub.docker.com/r/shibbirweb/sendmock)
[![License: MIT OR Apache-2.0](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)](#license)
[![Docs](https://img.shields.io/badge/docs-shibbirweb.github.io%2Fsendmock-informational)](https://shibbirweb.github.io/sendmock/docs/)
[![Live demo](https://img.shields.io/badge/demo-try%20it%20in%20your%20browser-success)](https://shibbirweb.github.io/sendmock/demo/)

SendMock catches the email, SMS, push notifications, payments and webhooks your app sends while you develop and test, and shows them in a web UI on your machine. Your app talks to SendMock over SMTP and the providers' own HTTP APIs, so nothing reaches a real inbox, phone or payment provider.

![The SendMock overview: latest emails and SMS, webhook deliveries and payments](docs/wiki/images/overview.jpg)

## What it catches

- **Email** over SMTP (and POP3 to read it back), with HTML, text and source previews, link and spam checks, one-time code extraction, and a Mailpit-compatible API.
- **SMS and verification codes** through the APIs of Twilio, Vonage and other providers, with conversation threads and replies.
- **Push notifications** sent through FCM, Expo and OneSignal.
- **Payments** through Stripe, PayPal, Razorpay, Paddle, bKash, SSLCommerz and your own gateways, with checkout pages and simulated outcomes.
- **Webhooks** sent back to your app, in Standard Webhooks or each provider's own format, with rules, templates and delivery logs.
- **Any HTTP request** sent to a catcher bin, with mock responses.

Everything works from the web UI, the REST API, the `sendmock` CLI and an MCP server for AI agents.

## Install

| System | Command |
| --- | --- |
| macOS, Linux (Homebrew) | `brew install shibbirweb/tap/sendmock` |
| macOS, Linux (script) | `curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh \| sh` |
| Windows (PowerShell) | `irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1 \| iex` |
| Windows (Scoop) | `scoop bucket add shibbirweb https://github.com/shibbirweb/scoop-bucket`, then `scoop install shibbirweb/sendmock` |
| Any system with Node.js | `npx sendmock` (no install) |
| Docker | `docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock` |

WinGet, Chocolatey, apt, dnf, the AUR, Nix, Cargo, the beta of each channel, plain binaries, a Helm chart, a Docker Desktop extension and a menu bar app are on the [install page](https://shibbirweb.github.io/sendmock/docs/install/).

The first beta is being prepared. Until it is published, try the [live demo](https://shibbirweb.github.io/sendmock/demo/) or [run SendMock from source](#run-it-from-source).

## Quick start

1. Start SendMock:

   ```bash
   sendmock
   ```

2. Open the web UI at http://127.0.0.1:8025.

3. Point your app's SMTP settings at host `127.0.0.1`, port `1025`. [Connect your app](https://shibbirweb.github.io/sendmock/docs/connect/) has the settings for PHP, Node.js, Python, Go, Java, Rust, Ruby and .NET.

SendMock listens on `127.0.0.1` only, so nothing outside your machine can reach it. `sendmock --demo` starts it with sample data to look around, `sendmock --help` lists the flags, and `sendmock help --all` every command.

## Use it from an AI agent

SendMock ships an MCP server and a skill, so an agent in Claude Code, Codex, Cursor, Gemini CLI or VS Code can read the codes your app sent, set up webhooks and check what happened:

```bash
sendmock ai install --target claude-code
```

[Use SendMock from AI agents](https://shibbirweb.github.io/sendmock/docs/ai/) covers each agent.

## Run it from source

You need [Rust](https://rustup.rs) and [Bun](https://bun.sh).

1. Build the web UI:

   ```bash
   cd web
   ```

   ```bash
   bun install --frozen-lockfile
   ```

   ```bash
   bun run build
   ```

2. Start SendMock from the repository root:

   ```bash
   cd ..
   ```

   ```bash
   cargo run -p sendmock
   ```

3. Open <http://127.0.0.1:8025>.

## Project status

Every feature planned for 1.0 is built and tested in CI; the first beta and then 1.0 follow the [release runbook](docs/plan/31-release-runbook.md). Progress is tracked in [docs/plan/PROGRESS.md](docs/plan/PROGRESS.md) and on the [roadmap](https://github.com/shibbirweb/sendmock/issues/170).

## Contributing

Read [CONTRIBUTING.md](.github/CONTRIBUTING.md) to set up and make a change, and [AGENTS.md](AGENTS.md) for the rules every change follows. Report security problems privately as described in [SECURITY.md](.github/SECURITY.md).

## License

SendMock is licensed under either of

- the Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE)), or
- the MIT license ([LICENSE-MIT](LICENSE-MIT)),

at your option.
