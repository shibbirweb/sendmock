# Progress Tracker

Where the project stands, what is done, and what is left. The plan itself is in [README.md](README.md) and the phase details in [11-roadmap.md](11-roadmap.md); this file only tracks status.

**Last updated:** 2026-10-25

## Current position

| | |
|---|---|
| **Stage** | Stage A: UI with mock data |
| **Current phase** | **Phase U0: UI foundations** (14 / 15 done; only the required CI checks in the rulesets remain) |
| **Latest release** | none yet (first beta `0.1.0-beta.1` is planned for Phase 1) |
| **Blockers** | none |
| **Live preview** | https://shibbirweb.github.io/sendmock/ (demo at `/demo/`), published from `develop` |
| **Feature acceptance** | 0 / 92 accepted, 5 / 329 criteria ticked; UI-01 and UI-02 in progress ([acceptance/](acceptance/README.md)) |

**Next up:**

1. Add the required status checks (Web UI, Acceptance traceability, Website) to the `develop` and `main` rulesets.
2. Start Phase U1: Mail, SMS, Verify, Numbers, Logs and Settings screens.

## How to update this file

- Feature completeness is tracked separately in [acceptance/](acceptance/README.md): a phase is only `Done` when the features it delivers are `Accepted` (or `UI done` for Stage A phases).
- An item is only ticked when its tests are merged and green in GitHub Actions (see Testing in [AGENTS.md](../../AGENTS.md#testing)).
- Tick an item when its pull request is **merged into `develop`**, and add the PR number: `- [x] App shell (#12)`.
- Change a phase's status in the overview table when it starts or finishes, and move "Current position" along.
- Add a line to the [Update log](#update-log) for anything notable (phase done, scope change, release).
- Status values: `Done`, `In progress`, `Not started`, `Blocked`, `Dropped`.
- Scope changes go into the relevant plan doc first, then here.

## Overview

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| P | Planning | In progress | 12 / 13 |
| U0 | UI foundations | In progress | 14 / 15 |
| U1 | Mail, SMS, Verify, Numbers, Logs, Settings screens | Not started | 0 / 15 |
| U2 | Webhook, HTTP catcher and payment screens | Not started | 0 / 12 |
| U3 | Polish, website, contract freeze, **sign-off gate** | Not started | 0 / 10 |
| 0 | Backend foundations | Not started | 0 / 14 |
| 1 | Email backend + first beta | Not started | 0 / 15 |
| 2 | SMS and Verify backend | Not started | 0 / 11 |
| 3 | Webhooks backend | Not started | 0 / 14 |
| 3P | Payment gateway backend | Not started | 0 / 6 |
| 4 | Integrations, fidelity and AI | Not started | 0 / 18 |
| 5 | Distribution and 1.0 stable | Not started | 0 / 13 |

---

## Phase P: Planning

- [x] Vision, scope, non-goals ([01](01-vision.md))
- [x] Architecture, tech stack, data model ([02](02-architecture.md))
- [x] Email, SMS, webhooks, API, UI, integrations, distribution plans ([03](03-email.md) to [09](09-distribution.md))
- [x] Webhook variables, templates, AI integration, HTTP catcher ([12](12-webhook-variables.md) to [15](15-http-catcher.md))
- [x] Competitor research and gap analysis (Mailpit, Mailtrap, smtp4dev, Twilio test mode, emulate, MockPost, Standard Webhooks, Hookdeck, Webhook.site) folded into the plan
- [x] UI-first roadmap with mock data ([11](11-roadmap.md))
- [x] Docker as a first-class channel ([09](09-distribution.md#docker))
- [x] Website, API playground and beta/stable release model ([16](16-website-and-releases.md))
- [x] Plan moved to `docs/plan/`, progress tracker added
- [x] `AGENTS.md` with the common rules, imported by `CLAUDE.md`
- [x] Acceptance criteria for every feature (81 features, 289 criteria) in [acceptance/](acceptance/README.md)
- [x] Plan committed to the repository on `develop`
- [ ] Placeholder decisions confirmed or deferred (name, ports, licence)

## Stage A: UI with mock data

### Phase U0: UI foundations

- [x] `develop` and `main` branches, branch protection, PRs target `develop` (rulesets on both: pull request required, no force push, no deletion; default branch `develop`) (#1)
- [x] `web/` scaffold: Bun, Vite, React 19, TypeScript, Tailwind v4, shadcn/ui (044db8b)
- [x] TanStack Router and Query, lucide, sonner (044db8b)
- [x] App shell: sidebar, three-pane layout, responsive collapse (044db8b; the three-pane list/detail layout arrives with the U1 screens)
- [x] Theme: dark / light / system (044db8b)
- [x] Command palette and keyboard shortcut system with `?` help (044db8b)
- [x] MSW setup (HTTP + WebSocket) and in-memory mock DB (f8209c5)
- [x] Fixture generators (emails, SMS, Verify, catcher, logs, webhooks, templates, variables) (f8209c5)
- [x] Dev toolbar (latency, errors, empty, large data, realtime on/off) (f8209c5)
- [x] API types (`web/src/lib/api/types/`) and query hooks for all resources (f8209c5)
- [x] Lint (incl. `max-lines` 500 and `max-lines-per-function` limits from `AGENTS.md`), typecheck, Vitest, Playwright smoke test; `ci.yml` for `web/` and `website/` (f7dca57, 4f8d212, 3ae88c2; first GitHub run passed on #1)
- [x] Website skeleton in `website/` (Fumadocs + shadcn + Magic UI, Magic UI MCP in `.mcp.json`) (3ae88c2)
- [x] `website.yml` deploys GitHub Pages with the mock UI at `/demo/` (shareable preview URL): https://shibbirweb.github.io/sendmock/ (#1)
- [ ] Test setup: Vitest + React Testing Library + Playwright in CI, coverage report on PRs, required checks on `develop` and `main` (set up and passing in CI with an 80% gate on `src/lib`; still open: add Web UI, Acceptance traceability and Website as required checks in the rulesets)
- [x] `scripts/acceptance.ts` traceability check (criterion IDs in tests vs `docs/plan/acceptance/`) running in CI (4f8d212)

### Phase U1: Mail, SMS, Verify, Numbers, Logs, Settings screens

- [ ] Overview dashboard
- [ ] Mail list, search and filter chips, source and outcome badges
- [ ] Mail detail: HTML (devices, images toggle, screenshot), Text, Source, Headers
- [ ] Mail detail: Attachments with thumbnails, MIME tree, Checks, Timeline, Template data
- [ ] Mail actions: read/unread, simulate open, simulate delivered/bounce/complaint/unsubscribe, tag, download, send to webhook, release, delete, bulk delete
- [ ] Extracted OTP/links panel, opened indicator and history, browser notifications
- [ ] SMS threads and conversation view (SMS and WhatsApp styling, status ticks, badges)
- [ ] SMS message drawer, inbound composer, manual status, simulate read
- [ ] Verify tab: verifications, timeline, force-state buttons, Verify services editor
- [ ] Numbers registry and Messaging Services tab
- [ ] Logs: SMTP sessions and transcript viewer
- [ ] Logs: HTTP API request log with rejected requests
- [ ] Settings: retention, reset to seed, seed export/apply, email and SMS options, opened events, chaos, OTP patterns
- [ ] Settings: connection snippets per language (incl. Docker hostnames), about and update channel
- [ ] Empty states with "how to connect" and "send sample"

### Phase U2: Webhook, HTTP catcher and payment screens

- [ ] Endpoints table and edit sheet (`whsec_` secret and rotation, retry policy, template picker, overrides, endpoint variables)
- [ ] Rules list and visual rule builder with match preview
- [ ] Deliveries live log and detail (cURL, replay, re-render, edit and replay, cancel, `render_failed`)
- [ ] Saved deliveries (bookmarks)
- [ ] Templates gallery and detail
- [ ] Template editor (clone, save from endpoint, import/export, revisions with diff)
- [ ] Variables (all kinds, masked secrets, regenerate)
- [ ] Request editor: CodeMirror, `{{` autocomplete, body modes, live nunjucks preview, inline errors
- [ ] Manual send dialog and composer (Prompt variables, overrides)
- [ ] HTTP catcher: bins, requests, Slack/Discord/push previews, response rules, forward
- [ ] Webhooks overview metrics
- [ ] Payments list, detail and Simulate menu; hosted test checkout page with provider themes; Settings > Payments

### Phase U3: Polish, website, contract freeze, sign-off gate

- [ ] Design review pass on every screen (hierarchy, spacing, microcopy, empty/loading/error states)
- [ ] Accessibility pass (keyboard-only, focus, contrast, labels, reduced motion)
- [ ] Performance with large data (virtualised lists, bundle under 250 KB gzipped, lazy editors)
- [ ] Responsive check (split screen, tablet, phone)
- [ ] Feedback round on the preview URL, iterations done
- [ ] Website landing page with Magic UI (animated beam, terminal, marquee, bento grid, number ticker)
- [ ] Website docs structure drafted (`docs/wiki/`)
- [ ] API reference and playground in Demo mode
- [ ] OpenAPI contract frozen at `docs/api/openapi.yaml`
- [ ] **Sign-off: UI approved, Stage B may start**

## Stage B: Backend

### Phase 0: Backend foundations

- [ ] Cargo workspace and crate skeletons
- [ ] `rust-embed` UI embedding, SPA fallback, dev proxy
- [ ] Config (clap, env, `sendmock.toml`), tracing, graceful shutdown
- [ ] SQLite, migrations, WAL mode
- [ ] `sendmock-ops` registry, CLI skeleton (`sendmock status --json`, exit codes), parity CI check
- [ ] Seed loader skeleton (`seed validate`)
- [ ] OpenAPI contract tests against handlers
- [ ] Rust CI on Linux, macOS, Windows (incl. Clippy `too_many_lines` and a 500-line file check)
- [ ] Rust test setup: nextest, `insta` snapshots, `cargo llvm-cov` coverage gate (80% overall, 90% domain/operations), test fakes for `Clock`, `IdGenerator`, random source
- [ ] `scripts/version.ts`, `CHANGELOG.md`
- [ ] Release workflows: `beta.yml`, `beta-publish.yml`, `stable.yml`, `stable-promote.yml`, `stable-publish.yml`, `release.yml`
- [ ] Dockerfile and `docker-edge.yml` (`edge` image from `develop`)
- [ ] Versioned website builds (`/next/` from `develop`)
- [ ] Repo `README.md`, licence, `CONTRIBUTING.md`

### Phase 1: Email backend and first beta

- [ ] SMTP server (EHLO, MAIL, RCPT, DATA, PIPELINING, SIZE, 8BITMIME, SMTPUTF8, AUTH, STARTTLS)
- [ ] MIME parsing, storage, retention, FTS search
- [ ] OTP and link extractors
- [ ] Email REST API and WebSocket events
- [ ] `sendmail` shim
- [ ] Native HTTP send API (`POST /api/v1/send`)
- [ ] SMTP session log and HTTP API request log
- [ ] Plus-address tagging, MIME tree, thumbnails, List-Unsubscribe check
- [ ] `wait/email`, `otp`, `links`, `reset`; `--ready-json`
- [ ] CLI `email` / `otp` / `links`; MCP `core`, `email`, `extract` toolsets
- [ ] Mail screens switched to live mode
- [ ] SMTP compatibility tests with real clients
- [ ] CORS for the docs origin; playground Local mode
- [ ] Done-when check: Laravel and Node mail appear live; pytest reads an OTP
- [ ] **Release `0.1.0-beta.1`** (GitHub pre-release, Docker `beta`, Homebrew `sendmock-beta`)

### Phase 2: SMS and Verify backend

- [ ] Native SMS API (JSON, form, GET)
- [ ] Twilio Messages API and Messaging Services
- [ ] Vonage `/sms/json`
- [ ] Twilio Verify emulation (services, start/check/update, fixed codes, limits, force state)
- [ ] Provider port serving real provider paths
- [ ] GSM-7/UCS-2 encoding and segments
- [ ] Delivery simulation (profiles, failure rate, Twilio magic numbers, extensions, strict mode)
- [ ] Status callbacks (Twilio, Vonage) and inbound SMS simulation
- [ ] CLI `sms` / `verify`; MCP `sms`, `verify` toolsets
- [ ] SMS and Verify screens switched to live mode
- [ ] Done-when check: Twilio-shaped send with callbacks; Verify OTP login works; beta released

### Phase 3: Webhooks backend

- [ ] Endpoints, rules, persistent queue, retries, cancel
- [ ] Standard Webhooks signing and secret rotation
- [ ] Email delivery outcome simulation and events
- [ ] Opened events and `/open` endpoints
- [ ] Twilio and Vonage inbound/status formats with signatures
- [ ] Variables and `minijinja` templating, `/webhooks/render`
- [ ] Payload templates (native, Twilio, Vonage, Slack, Discord) and custom templates
- [ ] Manual send, replay, edit-and-replay
- [ ] Saved deliveries and `/stats`
- [ ] Seed file covers all configuration; `reset` restores seed; `seed export/apply`
- [ ] CLI `webhook`; MCP `webhooks`, `templates`, `variables` toolsets
- [ ] Webhook screens switched to live mode
- [ ] Done-when check: inbound email rule to Express handler, retry then replay succeeds
- [ ] Beta released

### Phase 3P: Payment gateway backend

- [ ] Native payments API and hosted checkout flow
- [ ] Test cards and the real-card safety rule
- [ ] Stripe emulation with `Stripe-Signature` webhooks
- [ ] PayPal emulation (Orders v2, webhooks, IPN postback)
- [ ] SSLCommerz emulation (init, IPN, validation, refund, query)
- [ ] Done-when check: Stripe, PayPal and SSLCommerz flows end to end offline; beta released

### Phase 4: Integrations, fidelity and AI

- [ ] Email provider send APIs (SendGrid, Mailgun, Postmark, Resend, SES v2, Brevo)
- [ ] HTML compatibility, link check, SpamAssassin check
- [ ] Release to real SMTP, auto-forward, tag rules
- [ ] Inbound email formats (SendGrid Parse, Mailgun routes, Postmark)
- [ ] Bounce/complaint/delivered and open provider formats
- [ ] Fake data functions, Postman aliases, `SENDMOCK_VAR_*`
- [ ] Remaining built-in templates, import/export, `--templates-dir`, revisions
- [ ] More SMS providers (Plivo, MessageBird, generic GET/POST)
- [ ] TwiML reply parsing
- [ ] WhatsApp via Twilio
- [ ] HTTP catcher backend (bins, mock responses, core presets, `wait/http`)
- [ ] Virtual numbers backend and chaos toggles
- [ ] SDK redirection recipes verified per SDK
- [ ] `examples/` apps for 8 languages with CI smoke tests
- [ ] OpenAPI published, API docs page in UI
- [ ] AI: scenarios, MCP resources/prompts, streamable HTTP, agent skill, `sendmock ai install`, `llms.txt`
- [ ] Done-when check: example apps pass; agent session works in Claude Code and Codex
- [ ] Beta released

### Phase 5: Distribution and 1.0 stable

- [ ] Release builds for all 6 targets, checksums, install scripts with `--channel`
- [ ] Docker stable tags, `-debug` variants, SBOM, provenance, cosign, image smoke test
- [ ] Homebrew tap (`sendmock`, `sendmock-beta`), Scoop bucket, npm wrapper
- [ ] Testcontainers modules
- [ ] Remaining catcher presets and catch-all port
- [ ] Performance and size budgets enforced in CI
- [ ] `sendmock --demo`
- [ ] Claude Code plugin, MCP registry listing, skill evals
- [ ] Website docs complete, versioned (`/`, `/next/`, `/v0.x/`)
- [ ] Final product name applied everywhere
- [ ] **Release `1.0.0`** (Stable release, Promote stable, Publish stable)
- [ ] `main` set as default branch
- [ ] Done-when check: installs and runs via every channel on macOS, Linux, Windows

---

## Decisions

### Made

| Date | Decision | Where |
|------|----------|-------|
| 2026-10-24 | Rust backend, single binary, SQLite; Bun + Vite + React + shadcn/ui frontend embedded | [02](02-architecture.md) |
| 2026-10-24 | UI first with mock data (MSW); backend starts only after UI sign-off | [11](11-roadmap.md) |
| 2026-10-24 | Every feature reachable from UI, REST, CLI, MCP and agent skill (one operation registry) | [14](14-ai-integration.md) |
| 2026-10-24 | Webhooks signed with Standard Webhooks, not a custom scheme | [05](05-webhooks.md#signing) |
| 2026-10-24 | SMS magic numbers match Twilio's official test numbers and error codes | [04](04-sms.md#delivery-simulation) |
| 2026-10-24 | Email accepted via SMTP and provider HTTP APIs; Twilio Verify emulated | [03](03-email.md), [04](04-sms.md) |
| 2026-10-24 | Docker is a first-class release channel | [09](09-distribution.md#docker) |
| 2026-10-24 | `develop` = beta, `main` = stable, releases cut by workflows (phpdebugger model) | [16](16-website-and-releases.md) |
| 2026-10-24 | Website on GitHub Pages with Fumadocs + Magic UI, API playground with in-browser demo mode | [16](16-website-and-releases.md) |
| 2026-10-25 | Add a fake payment gateway (Stripe, PayPal, SSLCommerz first; bKash, Razorpay, Paddle next) with test checkout and IPN; only test cards accepted | [17](17-payments.md) |
| 2026-10-25 | Publish from the `shibbirweb` GitHub account | [10](10-open-questions.md) |
| 2026-10-25 | Commits authored as `MD. Shibbir Ahmed <shibbirweb@gmail.com>` (rule in `AGENTS.md`); existing local commits rewritten before the first push | [AGENTS.md](../../AGENTS.md#commits-and-pull-requests) |
| 2026-10-25 | Product name **SendMock** (binary and packages `sendmock`) | [10](10-open-questions.md#1-product-name-decided-2026-10-25-sendmock) |

### Open

See [10-open-questions.md](10-open-questions.md). Summary:

| Question | Recommendation | Status |
|----------|----------------|--------|
| Trademark check for "SendMock" | search USPTO, EUIPO, WIPO before branding | Open |
| Default ports | 1025 / 8025 (Mailpit compatible) | Open (using recommendation) |
| Licence | dual MIT / Apache-2.0 | Open |
| Provider emulation priority | Twilio, Vonage, generic, then others | Open (using recommendation) |
| SDK redirection per SDK | verify in Phase 4 | Open |
| Attachment storage | inside SQLite | Open (using recommendation) |
| Telemetry | none, opt-in update check | Open (using recommendation) |
| Mailpit API aliases | after 1.0 if demanded | Open |
| Persistence default | on-disk, `--db memory` for CI | Open (using recommendation) |
| caniemail data licence | confirm before shipping | Open |
| Lenient vs strict provider emulation | lenient default, strict mode per provider | Open (using recommendation) |
| Docs-site CORS default for local playground | allow docs origin, connect on click | Open |
| Fumadocs static export and search on Pages | confirm in U0 | Open |
| Magic UI MCP command for Claude Code | confirm in U0 | Open |

## Update log

| Date | Update |
|------|--------|
| 2026-10-24 | Plan written (docs 01 to 16), competitor research folded in, plan moved to `docs/plan/`, progress tracker created, `AGENTS.md` / `CLAUDE.md` added, acceptance criteria written for all features. |
| 2026-10-25 | Phase U0 started on `feat/u0-ui-foundations`: web app shell, mock API with realtime events and demo controls, tests (27 unit, 7 end-to-end), CI and Pages workflows, website skeleton with Magic UI. Waiting on the GitHub repository for the remaining four items. Note: the demo-only mock chunk is 308 KB gzipped (faker data); the app bundle is 172 KB, inside budget. |
| 2026-10-25 | PR #1 merged into `develop`: CI (Web UI, Acceptance traceability, Website) green on the PR and on `develop`; site live at https://shibbirweb.github.io/sendmock/ with the demo at `/demo/`. Rulesets protect `develop` and `main`; required status checks still to be added. |
