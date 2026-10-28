# 11. Roadmap

The project runs in two stages:

1. **Stage A: UI first, with mock data.** Build the complete web UI against a realistic mock API so every screen and flow can be previewed, reviewed and refined before any backend code exists.
2. **Stage B: Backend.** Once the UI is signed off, build the Rust backend to the API contract the UI already uses, then switch the UI from mocks to the real server.

Estimates assume one developer working part-time and are rough. Each phase ends with a short demo. Day-to-day status is tracked in [PROGRESS.md](PROGRESS.md).

**Definition of done for every feature (UI and backend):** all of its acceptance criteria in [acceptance/](acceptance/README.md) proven by tests, automated tests at every layer it touches, running green in GitHub Actions (see Testing in [AGENTS.md](../../AGENTS.md#testing)). For backend features additionally: REST API + CLI command + MCP tool + skill docs, wired to the existing UI. AI integration milestones are listed in [14-ai-integration.md](14-ai-integration.md#roadmap-placement).

Feature docs (03 to 14) mention "Phase N" for when a capability lands; those refer to the **backend** phases below. The UI for all of them is built in Stage A.

---

# Stage A: UI with mock data

## How the mock layer works

- **Mock Service Worker (MSW 2)** intercepts `fetch` and WebSocket calls in the browser, so the UI code calls the real API paths from [06-api.md](06-api.md) (`/api/v1/emails`, `/api/v1/sms`, `/api/v1/webhooks/...`) and never knows it is mocked.
- **In-memory mock database** (`web/src/mocks/db.ts`) holds emails, SMS, numbers, endpoints, rules, templates, variables, deliveries and settings. Mutations (delete, mark read, create endpoint, replay) really change state, so flows feel real. Optional persistence to `localStorage` with a "Reset demo data" button.
- **Seed fixtures** (`web/src/mocks/fixtures/`), generated with `@faker-js/faker` plus handcrafted cases:
  - Emails: OTP, password reset, welcome HTML newsletter, invoice with PDF attachment, inline CID images, plain-text only, very long subject, broken HTML, non-English (Bangla, Arabic, Japanese).
  - SMS: OTP threads, Bangla text (UCS-2, multi-segment), long GSM-7 message (3 segments), failed and undelivered statuses, inbound replies ("STOP", "YES"), Twilio and Vonage API badges.
  - Emails sent via SendGrid/Resend/Postmark APIs (source badge, template data), bounced and complained emails with timelines, HTML check / link check / spam results, MIME trees.
  - Twilio Verify verifications (pending, approved, expired, max attempts), WhatsApp threads, Messaging Services.
  - HTTP catcher bins (Slack, Discord, FCM, generic) with captured requests.
  - SMTP session transcripts (successful and failed AUTH/TLS) and API request logs including rejected 4xx calls.
  - Webhooks: endpoints using native, Twilio, Postmark and Slack templates; deliveries that succeeded, failed with 500 then retried, timed out, `render_failed`; manual and replay triggers.
  - Templates: the full built-in catalogue from [13-webhook-templates.md](13-webhook-templates.md) as data, plus two custom templates.
  - Variables: one of every kind (Text, Number, Boolean, JSON, Secret, Dynamic, Random, Computed, Prompt).
- **Simulated realtime:** a mock event generator pushes new emails, SMS, status changes, opens and webhook deliveries over the mocked WebSocket every few seconds (toggle and speed control in a dev toolbar), so live updates, toasts and counters can be seen.
- **Simulated conditions:** dev toolbar toggles for network latency, API errors (500, 404), empty state (no data), and large data sets (5,000 emails) to test performance and pagination.
- **Template preview in mock mode:** rendered client-side with `nunjucks` (Jinja-compatible) plus JS versions of the custom filters and random functions. It is an approximation of the real `minijinja` renderer; the backend replaces it via `/webhooks/render` in Phase 3.
- **Types first:** TypeScript types for every API request/response are written in `web/src/lib/api/types.ts` during Stage A. At sign-off they are converted into the OpenAPI document that the backend must implement (contract freeze).
- **Switching to the real backend:** `VITE_API_MODE=mock|live`. Mock is the default until Phase 1 of Stage B, then live. Mock mode is kept permanently for UI development, demos and Storybook-like review.

## Phase U0: UI foundations (about 3-5 days)

- `web/` scaffolded: Bun, Vite, React 19, TypeScript, Tailwind v4, shadcn/ui, TanStack Router and Query, lucide, sonner.
- App shell: sidebar, three-pane layout, responsive collapse, dark/light/system theme, command palette (`Cmd/Ctrl+K`), keyboard shortcut system and `?` help dialog.
- MSW setup, mock DB, fixture generators, dev toolbar (latency, errors, empty, large data, realtime on/off).
- API types and TanStack Query hooks for all resources.
- Lint (ESLint or Biome), typecheck, Vitest, Playwright smoke test; CI for `web/` only.
- `develop` (beta line) and `main` (stable line) branches with protection; `ci.yml` for `web/` and `website/`.
- Website skeleton in `website/` (Fumadocs + shadcn + Magic UI) deployed to GitHub Pages by `website.yml`, with the mock-mode UI at `/demo/` as the shareable preview URL ([16-website-and-releases.md](16-website-and-releases.md)).

**Done when:** the shell runs with `bun run dev`, theme and shortcuts work, and a shareable preview URL shows the empty app with mock data loading.

## Phase U1: Mail, SMS, Numbers, Settings screens (about 1-2 weeks)

- **Overview** dashboard (counts, webhook success rate and latency, recent failures).
- **Mail:** list (infinite scroll, unread, tags, attachment icon, source and outcome badges), search with filter chips, detail tabs (HTML sandboxed iframe with device widths, load-images toggle and screenshot, Text, Source, Headers with List-Unsubscribe check, Attachments with thumbnails, MIME tree, Checks, Timeline, Template data), extracted OTP/links panel, opened indicator and open history, actions (read/unread, simulate open, simulate delivered/bounce/complaint/unsubscribe, tag, download, send to webhook, release, delete, bulk delete), reply / reply all / forward as recipient with an inline composer and links between originals and their replies, browser notifications.
- **SMS:** thread list, conversation bubbles (SMS and WhatsApp styling), status ticks including Read with error codes, segment/encoding/API/Messaging Service badges, per-message drawer (status timeline, request JSON, callback attempts), inbound composer, manual status buttons, simulate read.
- **Verify:** verifications table, detail timeline, force-state buttons, Verify services editor.
- **Numbers:** registry table and edit sheet, Messaging Services tab.
- **Logs:** SMTP session list and transcript viewer, HTTP API request log with rejected requests.
- **Settings:** retention, reset to seed, seed export/apply, email options (plus-address tagging, tag rules, delivery outcome profile, magic addresses, relay and allowlist, auto-forward rules, SpamAssassin), SMS simulation profile and magic numbers (Twilio table + extensions, strict mode), opened-event options, chaos toggles, OTP patterns, connection snippets per language (incl. Docker hostnames), about.
- Empty states with "how to connect" cards and "send sample" buttons (which add mock data).

**Done when:** every mail and SMS flow in [07-ui.md](07-ui.md) can be clicked through on mock data, including live arrival of new messages.

## Phase U2: Webhook screens (about 1-2 weeks)

- **Endpoints:** table with success sparkline, create/edit sheet (URL, method, headers, `whsec_` secret with rotation, retry policy, template picker, linked/detached, overrides, endpoint variables tab), "Send test".
- **Saved deliveries:** list, re-send, save as template.
- **Rules:** list and visual rule builder (fields, operators, all/any groups, opened-event fields) with "matches N of last 50" preview computed on mock data.
- **Deliveries:** live log, detail with request/response side by side, Copy as cURL, Replay / Re-render / Edit and replay, Cancel retries, `render_failed` display.
- **Templates:** gallery (categories, search, event filter), detail (required variables, docs link, live preview), editor (request editor + variables panel + sample tab), clone, save-from-endpoint, import/export (file download/upload in mock), revision history with diff.
- **Variables:** global table, create/edit per kind, masked secrets with reveal confirm, regenerate fixed random values.
- **Request editor:** CodeMirror with Jinja/JSON modes, `{{` autocomplete (variables, context fields, functions, filters), Fields / Raw / Template / None body modes, live preview panel (nunjucks), inline errors.
- **HTTP catcher:** bins, request list and detail, Slack/Discord/push previews, response rule editor, forward.
- **Payments:** list, detail with timeline, Simulate menu, hosted test checkout page with provider themes, Settings > Payments ([17-payments.md](17-payments.md)).
- **Manual send dialog and composer:** pick endpoint/template, Prompt variable form, overrides, preview, send (creates a mock delivery).
- **Replies:** Inbound routes list and editor with match preview; reply webhook result on inbound SMS bubbles, "TwiML reply" badge, and a Reply webhook tab with resend in the SMS drawer; inbound URL, method and fallback on Numbers.

**Done when:** every webhook and catcher flow in [05-webhooks.md](05-webhooks.md), [12-webhook-variables.md](12-webhook-variables.md), [13-webhook-templates.md](13-webhook-templates.md) and [15-http-catcher.md](15-http-catcher.md) can be clicked through on mock data.

## Phase U3: Polish, review and sign-off (about 1 week)

- Design review pass with the `ui-ux-pro-max` / design-critique checklists: hierarchy, spacing, consistency, microcopy, empty/loading/error states for every screen.
- Accessibility pass (keyboard-only walkthrough, focus management, contrast, screen reader labels, reduced motion).
- Performance with the large data set: list virtualisation, bundle budget (under 250 KB initial JS gzipped), lazy-loaded editors.
- Responsive check: laptop split screen, tablet, phone.
- Feedback round on the shared preview URL; iterate.
- **Website:** landing page with Magic UI (animated beam flow, terminal quick start, marquee, bento grid), docs structure, API reference and **playground in Demo mode** (in-browser mock) generated from the frozen spec.
- **Contract freeze:** convert `types.ts` and the MSW handlers into `docs/api/openapi.yaml` (or generate it), reviewed together with [06-api.md](06-api.md). This is the backend's spec.

**Done when (sign-off gate):** you approve the UI on the preview URL and the API contract is frozen. Stage B starts only after this.

---

# Stage B: Backend

The UI items listed in these phases already exist from Stage A; backend phases implement the server side and switch each screen from mock to live. From Phase 1 the binary embeds the live UI build only: an operation the running binary does not have yet shows **Not available yet** with the phase it arrives in, instead of mock data (decided 2026-10-29, [07](07-ui.md#not-available-yet-stage-b), UI-12). The mock build stays for the `/demo/` site. Which phase builds each UI operation: [24-stage-b-coverage.md](24-stage-b-coverage.md).

## Phase 0: Backend foundations (about 1 week)

- Cargo workspace and crate skeletons as in [02-architecture.md](02-architecture.md).
- `rust-embed` wiring of `web/dist`, SPA fallback, Vite dev proxy to the Rust server.
- Config (clap + env + TOML), tracing, graceful shutdown.
- SQLite setup, migrations, WAL mode.
- Release machinery: `scripts/version.ts`, `CHANGELOG.md`, `release-prepare.yml`, `beta-publish.yml`, `stable-promote.yml`, `stable-publish.yml`, `release.yml`, `docker-edge.yml`; versioned website builds (`/next/` from `develop`).
- `sendmock-ops` operation registry, CLI client skeleton (`sendmock status --json`, exit codes), parity CI check (every operation has REST + CLI + MCP).
- Seed loader skeleton (`sendmock.seed.toml` parsing, `seed validate`), extended by each later phase.
- Dockerfile (`scratch` + static musl binary, non-root, `/data` volume, `sendmock health` HEALTHCHECK) and an `edge` multi-arch image published from `develop`, so Docker users can follow along from the start.
- Contract tests: the frozen OpenAPI spec is checked against the Rust handlers (e.g. schemathesis or generated tests).
- CI: fmt, clippy, tests on Linux/macOS/Windows, plus existing `web/` checks.
- `README.md`, licence, contributing notes (`AGENTS.md` / `CLAUDE.md` already exist).

**Done when:** SendMock starts, serves the embedded UI at `:8025` (still in mock mode), `/api/v1/health` returns 200 on all three OSes.

Workstreams, order, criteria and dependencies: [23-phase-0.md](23-phase-0.md).

## Phase 1: Email backend (about 2-3 weeks)

- SMTP server: EHLO/HELO, MAIL, RCPT, DATA, RSET, NOOP, QUIT, PIPELINING, SIZE, 8BITMIME, SMTPUTF8, AUTH (accept-any), STARTTLS with self-signed cert.
- MIME parsing, storage, retention, FTS search.
- OTP and link extractors.
- REST API for emails, WebSocket events.
- Realtime: SSE `/api/v1/events` next to the WebSocket (PL-02), and `GET /events/recent` for the notification bell and `events tail`.
- `sendmail` shim and native HTTP send API (`POST /api/v1/send`).
- `POST /send/raw` (the path the `sendmail` shim and Mail > Import .eml use) and `GET /emails/latest`.
- SMTP session log (including failed sessions) and HTTP API request log.
- Plus-address auto-tagging, MIME tree, attachment thumbnails, List-Unsubscribe check.
- `wait/email`, `otp`, `links`, `reset` endpoints; `--ready-json` with port `0` for test harnesses.
- CLI `email` / `otp` / `links` commands; MCP `core`, `email`, `extract` toolsets over stdio.
- Switch Mail screens to live mode: the binary embeds the live UI build from here on, and `GET /info` lists the operations it serves (`available_operations`), so every screen and button whose operation is not built yet shows Not available yet with its phase (UI-12).
- UI and API auth: `--ui-auth user:pass` or an htpasswd file, and the API token, protecting the UI, API, WebSocket and MCP over HTTP (PL-06.2), so the first beta can be protected when Docker binds `0.0.0.0`.
- Settings: `GET` and `PATCH /settings` with the General, Email (retention) and Notifications sections; each later phase adds its own section. `GET /integrations/{stack}` and the ports from `/info` for Settings > Connection; `POST /samples/email` for the empty states (PL-03.5).
- The real update check (`GET /updates`, `sendmock update check`, Daily mode) from [16](16-website-and-releases.md#update-checker-extended-2026-10-27-owner-feedback-f15).
- Logs (SMTP sessions, API requests) and Settings switched to live mode; CLI `logs`, `settings`, `reset`, `sample`, `update`; MCP `logs` and `admin` toolsets.
- SMTP compatibility tests with real clients (Laravel, Nodemailer, Python smtplib, Go, Spring, lettre).
- CORS for the docs origin and playground **Local mode**.
- First beta release `0.1.0-beta.1` through the beta channel (GitHub pre-release with `.deb` and `.rpm`, Docker `beta`, Homebrew `sendmock-beta`).

**Done when:** a Laravel app and a Node app both send mail that appears live in the UI, and a pytest test reads an OTP via `/api/v1/otp`.

Workstreams, order and criteria: [25-phase-1.md](25-phase-1.md).

## Phase 2: SMS backend (about 2 weeks)

- Native SMS API (JSON, form, GET).
- MMS media: Twilio `MediaUrl`, native `media_urls` and inline `media`, `/sms/{smsId}/media/{mediaIndex}`.
- Twilio-compatible Messages API (create, fetch, list), Messaging Services (`MessagingServiceSid`, sender pools) and Vonage `/sms/json`.
- **Twilio Verify** emulation: services, start/check/update verifications, fixed codes, expiry and attempt limits, force-state API, codes delivered as captured SMS/email, `verify.*` events.
- Optional dedicated provider port serving root paths.
- GSM-7/UCS-2 encoding and segment calculation.
- Delivery simulation profiles (instant, realistic, manual), failure rate, magic numbers matching Twilio's official test numbers and error codes (plus SendMock after-send extensions, strict Twilio test mode), status history.
- Per-message status callbacks (Twilio and Vonage formats).
- Inbound SMS simulation API.
- Virtual numbers and Messaging Services registry (moved from Phase 4 on 2026-10-29: Messaging Services draw on number pools and the Phase 3 reply webhook reads a number's inbound URL); Numbers screen live, `POST /samples/number`, CLI and MCP `numbers` toolset.
- The SMS built-in provider definitions (Twilio, Twilio Verify, Vonage) stored and answered from the database, with SMS > Providers live for them: edit, reset, remove, restore, preview ([22](22-configurable-providers.md#13-stage-b), SM-16).
- Custom outcome numbers (`/outcome-rules/sms`, including the test endpoint).
- `wait/sms`, OTP extraction from SMS, `POST /samples/sms` and `/samples/verification`.
- CLI `sms` and `verify` commands; MCP `sms` and `verify` toolsets.
- Switch SMS screens to live mode.

**Done when:** an app using the Twilio REST shape sends an SMS, sees it in the UI, and receives `queued` / `sent` / `delivered` status callbacks; and an app using Twilio Verify completes an OTP login against SendMock.

## Phase 3: Webhooks backend (about 2-3 weeks)

- Endpoints, rules with filters, persistent delivery queue, retries with backoff, cancel.
- Native JSON format signed with **Standard Webhooks** (`webhook-id`, `webhook-timestamp`, `webhook-signature`, `whsec_` secrets, rotation with overlap).
- Email delivery outcome simulation (magic addresses incl. SES mailbox simulator, delivery profile, manual simulate) with native-format `email.delivered/deferred/bounced/complained/unsubscribed` events.
- Saved deliveries (bookmarks); `/stats` metrics for the Overview dashboard.
- `wait/webhook`; custom outcome addresses (`/outcome-rules/email`, including the test endpoint); `seed status`.
- Seed file covers endpoints, rules, templates, variables, numbers, Messaging Services, Verify services; `reset` restores seed; `seed export/apply`.
- `email.opened` and `sms.opened` events: `/open` API endpoints, open history, auto-fire and first-open settings.
- Twilio inbound + status formats with `X-Twilio-Signature`; Vonage inbound/DLR.
- SMS reply webhook (Twilio style): number and Messaging Service inbound URLs with fallback, TwiML replies recorded in the thread, Twilio error codes, resend ([04-sms.md](04-sms.md#reply-webhook-twilio-style)). Moved from Phase 4.
- Variables and templating with `minijinja`: all variable kinds, scopes, built-in context, text filters, random functions, Fields and Raw body modes, strict/lenient rendering, `/webhooks/render` (replaces the nunjucks mock preview).
- Payload templates: schema, native/generic, Twilio, Vonage, Slack, Discord; custom templates (create, clone, save from endpoint, linked/detached).
- Manual send, replay and edit-and-replay.
- CLI `webhook` commands (`send`, `tail`, endpoints, rules, templates, variables, deliveries); MCP `webhooks`, `templates`, `variables` toolsets.
- Switch Webhook screens to live mode.
- Overview switched to live mode (`/stats`, `/webhooks/metrics`); MCP `rules` toolset for the outcome rules.

**Done when:** a rule forwards every `*@inbound.local` email to a local Express handler, the delivery log shows request/response, and a failed delivery retries then succeeds after the handler is fixed and replayed.

## Phase 3P: Payment gateway (about 2 weeks)

- Native payments API and hosted checkout flow with the test checkout page.
- Gateway, method and flow configuration stored in the database: edit, reset, delete and add custom gateways, methods and flows, step types, flow variables, previews and credential reveal; a custom gateway's wire APIs are emulated from its definition ([17](17-payments.md), PY-12).
- Test cards (Stripe table) and the real-card safety rule (reject, never store).
- Stripe (Checkout Sessions, PaymentIntents, Refunds, `Stripe-Signature` webhooks), PayPal (Orders v2, webhooks, IPN with postback), SSLCommerz (init, IPN with `verify_sign`, validation API, refund, query).
- Capture, void, full and partial refunds; `payment.*` and `checkout.*` events; payment templates; `wait/payment`.
- CLI `payments` commands and MCP `payments` toolset; Payments screens switched to live mode.

**Done when:** apps using the official Stripe SDK, PayPal Orders and SSLCommerz complete a payment, receive and verify the IPN/webhook, validate the order, and handle a decline and a refund, all offline.

## Phase 4: Integrations, fidelity and AI (about 2-3 weeks)

- Email provider HTTP send APIs: SendGrid, Mailgun, Postmark, Resend, SES v2, Brevo (on the provider port), with template ID/data capture.
- The email provider definitions and custom email and SMS providers, answered from the database, with Mail > Providers live and custom providers in SMS > Providers ([22](22-configurable-providers.md#13-stage-b), EM-18, SM-16).
- Email quality checks: HTML compatibility (caniemail data), link check, optional SpamAssassin spam check.
- Release to real SMTP relay and auto-forward rules (with recipient allowlist); tag rules.
- Email inbound formats: SendGrid Inbound Parse, Mailgun routes, Postmark inbound.
- Email replies and inbound routes (Mailgun style): reply, reply all and forward as recipient, `/emails/inbound`, inbound domains, `email.inbound`, routes with `match_recipient` / `forward` / `store` / `stop` and the `/v3/routes` API ([05-webhooks.md](05-webhooks.md#email-replies-and-inbound-routes-mailgun-style)).
- Bounce/complaint/delivered provider formats: SendGrid events, Mailgun, Postmark, SES via SNS, Resend.
- Open event formats: SendGrid Event Webhook `open`, Mailgun `opened`, Postmark Open, Twilio `MessageStatus=read`.
- Fake data functions (`fake.*`, locales), Postman-style `{{$random...}}` aliases, `SENDMOCK_VAR_*` env variables.
- Remaining built-in templates (Mailgun, SendGrid, Postmark, SES, Resend, Brevo, Mandrill, SparkPost; Plivo, MessageBird, Telnyx, Sinch, Infobip, Africa's Talking; Teams, Google Chat, Telegram, n8n/Zapier/Make), template import/export, `--templates-dir`, revision history.
- More SMS providers: Plivo, MessageBird, generic configurable GET/POST vendor.
- WhatsApp via Twilio (`whatsapp:` addresses, channel badge, inbound, `read` status).
- HTTP catcher: catch path, bins, mock response rules, Slack/Discord/Telegram/FCM presets, `wait/http`.
- HTTP Catcher and Scenarios screens switched to live mode; `POST /samples/http`; CLI and MCP `http`, `rules` (tag, forward and inbound routes) and `scenario` toolsets; chaos in the `admin` toolset.
- Payments: bKash, Razorpay and Paddle emulation; subscriptions; disputes.
- Chaos toggles (SMTP rejects/latency, SMS failures).
- Verified SDK redirection recipes and `examples/` apps for PHP, Node, Python, Go, Java, Rust, Ruby, .NET, each with a CI smoke test.
- OpenAPI spec published; API docs page in the UI.
- AI: scenarios (`sendmock scenario run`), MCP resources, prompts and streamable HTTP transport, agent skill, `sendmock ai install` for Claude Code, Codex, Cursor, Gemini CLI and VS Code, `llms.txt`.

**Done when:** all eight example apps pass their smoke tests in CI, and an agent in Claude Code and Codex completes the example session in [14-ai-integration.md](14-ai-integration.md).

## Phase 5: Distribution and 1.0 polish (about 1-2 weeks)

- Release workflow for all targets, checksums, install scripts.
- Docker: stable tags (`latest`, `1`, `1.x`, `1.x.y`), `-debug` variants, SBOM, provenance and cosign signatures, published-image smoke test, Docker-aware UI hints.
- Homebrew tap, Scoop bucket, optional npm wrapper; our signed APT and YUM repository, WinGet, Chocolatey, AUR, COPR and Nixpkgs ([09](09-distribution.md#package-channels-by-stage-decided-2026-10-27)). Official distribution repositories and Homebrew core come later, with traction.
- Testcontainers modules (Java, Node, Go, Python, .NET).
- Remaining HTTP catcher presets (Teams, Google Chat, Expo, OneSignal) and dedicated catch-all port.
- Performance and size budgets enforced in CI.
- `sendmock --demo` flag that seeds the Stage A fixtures into a fresh instance (for screenshots, demos and first-run exploration).
- Claude Code plugin packaging, MCP registry listing, skill evals.
- Documentation site content complete (from `docs/wiki/`, see [16-website-and-releases.md](16-website-and-releases.md)), with the mock-mode UI embedded as a live demo.
- Final product name applied everywhere (including the website and Pages URL / custom domain).
- First stable `1.0.0`: Stable release -> Promote stable -> Publish stable; all stable channels live; `main` becomes the default branch; website `/` serves 1.0 docs.

**Done when:** `v1.0.0` installs and runs via each channel on macOS, Linux and Windows, meeting the success criteria in [01-vision.md](01-vision.md).

## After 1.0 (backlog)

- POP3 read access.
- Vonage Verify v2 and other providers' verify APIs.
- Full WhatsApp Business Cloud API emulation.
- Helm chart and Docker Desktop extension.
- Mailpit API compatibility aliases.
- `email.clicked` link-click tracking event.
- AWS SNS/SES, Infobip and other provider formats.
- WhatsApp / push notification emulation (same "catch and webhook" model).
- Multi-project "inboxes" (separate namespaces by SMTP username or API key).
- System tray app.

## Immediate next steps

1. Decide the name, ports and licence ([10-open-questions.md](10-open-questions.md)), or proceed with the placeholders.
2. Start Phase U0: scaffold `web/` with Bun, Vite, React, Tailwind and shadcn/ui, plus the MSW mock layer and fixtures.
3. Build U1 and U2 screens, share the preview URL, iterate until sign-off (U3).
