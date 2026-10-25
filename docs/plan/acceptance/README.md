# Acceptance Criteria

How we know a feature is **really** complete. Every feature has a stable ID and a list of numbered, testable acceptance criteria. A feature is accepted only when every criterion is met, each one is proven by an automated test that runs in GitHub Actions, and the general Definition of Done below is satisfied.

Phase progress lives in [PROGRESS.md](../PROGRESS.md); this folder tracks feature completeness.

## Files

| File | Areas |
|------|-------|
| [01-email.md](01-email.md) | Email (EM) |
| [02-sms-verify.md](02-sms-verify.md) | SMS (SM), Verify (VF) |
| [03-webhooks.md](03-webhooks.md) | Webhooks, variables, templates (WH) |
| [04-catcher-platform.md](04-catcher-platform.md) | HTTP catcher (HC), Platform: API, realtime, test helpers, seed, settings, security, config, retention (PL) |
| [05-ai.md](05-ai.md) | CLI, MCP, scenarios, skill (AI) |
| [06-ui.md](06-ui.md) | Web UI as a whole (UI) |
| [07-distribution-website.md](07-distribution-website.md) | Distribution and releases (DS), Website and playground (WS) |
| [08-payments.md](08-payments.md) | Payment gateway emulation (PY) |

## IDs

- **Feature ID:** area prefix + number, e.g. `EM-08` (email provider HTTP send APIs).
- **Criterion ID:** feature ID + criterion number, e.g. `EM-08.3`.
- IDs never change or get reused. A dropped criterion is struck through with a reason, not deleted; new criteria get the next free number.

## Definition of Done (applies to every feature)

On top of its own criteria, a feature is done only when:

1. Every acceptance criterion is ticked (each has a passing automated test, see below).
2. The UI works in mock mode (Stage A) and live mode (Stage B).
3. Backend features are reachable through REST, CLI and MCP (parity check passes) and the agent skill docs mention them.
4. Tests cover the main path, edge cases and errors at every layer touched, and coverage thresholds hold (see Testing in [AGENTS.md](../../../AGENTS.md#testing)).
5. User docs (`docs/wiki/`) and generated references are updated; `CHANGELOG.md` has an entry.
6. Security defaults hold (no secrets exposed, localhost binding, allowlists respected).
7. Size, memory and bundle budgets still pass.
8. Accessibility checks pass for any UI it adds.
9. It has been shipped in at least one beta release and no open bug blocks it.

## Proving criteria with tests (traceability)

- Every test that proves a criterion names its ID:
  - Rust: a comment directly above the test, `// AC: EM-01.3`.
  - Vitest and Playwright: the ID at the start of the test title, `test("EM-04.2 blocks remote images by default", ...)`.
  - Cross-language example apps: the ID in the test name or a comment.
- `bun scripts/acceptance.ts` (added in Phase U0) reads this folder and the test suites and reports, per feature, which criteria have tests.
- CI runs it on every pull request and **fails when a feature marked `Accepted` has a criterion without a passing test**, or when a test references an ID that does not exist.

## How to tick

- Tick a criterion (`- [x] EM-01.3 ...`) in the pull request that adds its passing test, and add the PR number at the end: `(#42)`.
- When all criteria of a feature are ticked and the Definition of Done holds, set its status below to `Accepted` and add the date.
- Status values: `Not started`, `In progress`, `UI done` (Stage A screens and mock behaviour accepted), `Accepted`, `Dropped`.
- A scope change updates the plan doc first, then the criteria here, then [PROGRESS.md](../PROGRESS.md).

## Status

**Accepted: 0 / 95 features, 10 / 376 criteria ticked.**

| Feature | Name | Phase | Criteria | Status |
|---------|------|-------|----------|--------|
| [EM-01](01-email.md#em-01-smtp-receive) | SMTP receive | Phase 1 | 6 | Not started |
| [EM-02](01-email.md#em-02-smtp-tls-and-auth) | SMTP TLS and AUTH | Phase 1 | 5 | Not started |
| [EM-03](01-email.md#em-03-storage-retention-and-search) | Storage, retention and search | Phase 1 | 5 | Not started |
| [EM-04](01-email.md#em-04-email-viewer) | Email viewer | UI in U1, live in Phase 1 | 8 | In progress |
| [EM-05](01-email.md#em-05-otp-and-link-extraction) | OTP and link extraction | UI in U1, backend Phase 1 | 5 | In progress |
| [EM-06](01-email.md#em-06-sendmail-shim) | sendmail shim | Phase 1 | 3 | Not started |
| [EM-07](01-email.md#em-07-native-http-send-api) | Native HTTP send API | Phase 1 (mock in U1) | 5 | In progress |
| [EM-08](01-email.md#em-08-email-provider-http-send-apis) | Email provider HTTP send APIs | Phase 4 | 5 | Not started |
| [EM-09](01-email.md#em-09-smtp-session-log) | SMTP session log | UI in U1, backend Phase 1 | 5 | In progress |
| [EM-10](01-email.md#em-10-delivery-outcome-simulation) | Delivery outcome simulation | UI in U1, native events Phase 3, provider formats Phase 4 | 6 | In progress |
| [EM-11](01-email.md#em-11-email-opened-events) | Email opened events | Phase 3 | 5 | Not started |
| [EM-12](01-email.md#em-12-tags) | Tags | Phase 1 (X-Tags, plus addressing), Phase 4 (tag rules) | 4 | Not started |
| [EM-13](01-email.md#em-13-quality-checks) | Quality checks | Phase 1 (List-Unsubscribe), Phase 4 (HTML, link, spam) | 4 | Not started |
| [EM-14](01-email.md#em-14-release-and-auto-forward) | Release and auto-forward | Phase 4 | 4 | Not started |
| [EM-15](01-email.md#em-15-smtp-chaos) | SMTP chaos | Phase 4 | 3 | Not started |
| [EM-16](01-email.md#em-16-browser-notifications) | Browser notifications | UI in U1, live in Phase 1 | 2 | In progress |
| [EM-17](01-email.md#em-17-simulated-replies-and-inbound-email) | Simulated replies and inbound email | UI in U1, backend Phase 4 | 5 | In progress |
| [SM-01](02-sms-verify.md#sm-01-native-sms-api) | Native SMS API | Phase 2 | 5 | Not started |
| [SM-02](02-sms-verify.md#sm-02-twilio-messages-api) | Twilio Messages API | Phase 2 | 4 | Not started |
| [SM-03](02-sms-verify.md#sm-03-twilio-messaging-services) | Twilio Messaging Services | UI in U1, backend Phase 2 | 4 | In progress |
| [SM-04](02-sms-verify.md#sm-04-vonage-sms-api) | Vonage SMS API | Phase 2 | 3 | Not started |
| [SM-05](02-sms-verify.md#sm-05-other-sms-providers-and-generic-vendor) | Other SMS providers and generic vendor | Phase 4 | 2 | Not started |
| [SM-06](02-sms-verify.md#sm-06-encoding-and-segments) | Encoding and segments | Phase 2 | 3 | Not started |
| [SM-07](02-sms-verify.md#sm-07-delivery-simulation-and-magic-numbers) | Delivery simulation and magic numbers | UI in U1, backend Phase 2 | 9 | In progress |
| [SM-08](02-sms-verify.md#sm-08-status-callbacks) | Status callbacks | Phase 2 | 3 | Not started |
| [SM-09](02-sms-verify.md#sm-09-inbound-sms-and-two-way-conversations) | Inbound SMS and two-way conversations | Phase 2 (inbound), Phase 3 (reply webhook and TwiML) | 7 | Not started |
| [SM-10](02-sms-verify.md#sm-10-sms-opened-read-events) | SMS opened (read) events | Phase 3 | 3 | Not started |
| [SM-11](02-sms-verify.md#sm-11-whatsapp-via-twilio) | WhatsApp via Twilio | Phase 4 | 3 | Not started |
| [SM-12](02-sms-verify.md#sm-12-virtual-numbers) | Virtual numbers | UI in U1, backend Phase 4 | 3 | In progress |
| [SM-13](02-sms-verify.md#sm-13-api-request-log) | API request log | UI in U1, backend Phase 1 and 2 | 5 | In progress |
| [SM-14](02-sms-verify.md#sm-14-provider-port) | Provider port | Phase 2 | 3 | Not started |
| [SM-15](02-sms-verify.md#sm-15-mms-and-media) | MMS and media | UI in U1, backend Phase 2 and 4 | 5 | In progress |
| [VF-01](02-sms-verify.md#vf-01-verify-services) | Verify services | UI in U1, backend Phase 2 | 3 | In progress |
| [VF-02](02-sms-verify.md#vf-02-start-a-verification-and-deliver-the-code) | Start a verification and deliver the code | Phase 2 | 5 | Not started |
| [VF-03](02-sms-verify.md#vf-03-check-a-verification) | Check a verification | Phase 2 | 4 | Not started |
| [VF-04](02-sms-verify.md#vf-04-force-state-and-events) | Force state and events | UI in U1, backend Phase 2 | 4 | In progress |
| [WH-01](03-webhooks.md#wh-01-endpoints) | Endpoints | UI in U2, backend Phase 3 | 4 | Not started |
| [WH-02](03-webhooks.md#wh-02-rules-and-filters) | Rules and filters | UI in U2, backend Phase 3 | 4 | Not started |
| [WH-03](03-webhooks.md#wh-03-delivery-engine-and-retries) | Delivery engine and retries | Phase 3 | 6 | Not started |
| [WH-04](03-webhooks.md#wh-04-standard-webhooks-signing) | Standard Webhooks signing | Phase 3 | 3 | Not started |
| [WH-05](03-webhooks.md#wh-05-manual-send-and-replay) | Manual send and replay | UI in U2, backend Phase 3 | 4 | Not started |
| [WH-06](03-webhooks.md#wh-06-provider-formats-and-signatures) | Provider formats and signatures | Phase 3 (Twilio, Vonage), Phase 4 (email providers) | 3 | Not started |
| [WH-07](03-webhooks.md#wh-07-variables-and-templating) | Variables and templating | UI in U2 (nunjucks preview), backend Phase 3 (`minijinja`), Phase 4 (fake data, aliases, env) | 8 | Not started |
| [WH-08](03-webhooks.md#wh-08-built-in-payload-templates) | Built-in payload templates | Phase 3 (Twilio, Vonage, Slack, Discord, native), Phase 4 (the rest) | 3 | Not started |
| [WH-09](03-webhooks.md#wh-09-custom-templates) | Custom templates | UI in U2, backend Phase 3 (create, clone, linked/detached), Phase 4 (import/export, directory, revisions) | 6 | Not started |
| [WH-10](03-webhooks.md#wh-10-saved-deliveries) | Saved deliveries | Phase 3 | 3 | Not started |
| [WH-11](03-webhooks.md#wh-11-webhook-metrics) | Webhook metrics | UI in U1/U2, backend Phase 3 | 2 | Not started |
| [WH-12](03-webhooks.md#wh-12-inbound-routes-mailgun-style) | Inbound routes (Mailgun style) | UI in U2, backend Phase 4 | 6 | Not started |
| [HC-01](04-catcher-platform.md#hc-01-capture-requests) | Capture requests | UI in U2, backend Phase 4 | 5 | Not started |
| [HC-02](04-catcher-platform.md#hc-02-mock-responses) | Mock responses | Phase 4 | 3 | Not started |
| [HC-03](04-catcher-platform.md#hc-03-presets) | Presets | Phase 4 (Slack, Discord, Telegram, FCM), Phase 5 (Teams, Google Chat, Expo, OneSignal) | 2 | Not started |
| [PL-01](04-catcher-platform.md#pl-01-rest-api-and-openapi) | REST API and OpenAPI | Phase 0 onwards | 3 | Not started |
| [PL-02](04-catcher-platform.md#pl-02-realtime) | Realtime | Phase 1 | 2 | Not started |
| [PL-03](04-catcher-platform.md#pl-03-test-helpers) | Test helpers | Phase 1 (email), Phase 2 (SMS, Verify), Phase 4 (HTTP), Phase 3 (webhook wait) | 4 | Not started |
| [PL-04](04-catcher-platform.md#pl-04-seed-file-and-reset) | Seed file and reset | UI in U1, backend Phase 0 (parse, validate) and Phase 3 (full coverage) | 6 | In progress |
| [PL-05](04-catcher-platform.md#pl-05-settings) | Settings | UI in U1, backend per feature phase | 9 | In progress |
| [PL-06](04-catcher-platform.md#pl-06-security-defaults) | Security defaults | Phase 0 onwards | 4 | Not started |
| [PL-07](04-catcher-platform.md#pl-07-configuration) | Configuration | Phase 0 | 3 | Not started |
| [PL-08](04-catcher-platform.md#pl-08-retention) | Retention | Phase 1 | 2 | Not started |
| [AI-01](05-ai.md#ai-01-cli) | CLI | Phase 0 (skeleton), then every phase for its commands | 5 | Not started |
| [AI-02](05-ai.md#ai-02-mcp-server-tools) | MCP server tools | Phase 1 onwards | 5 | Not started |
| [AI-03](05-ai.md#ai-03-mcp-resources-and-prompts) | MCP resources and prompts | Phase 4 | 3 | Not started |
| [AI-04](05-ai.md#ai-04-scenarios) | Scenarios | Phase 4 | 3 | Not started |
| [AI-05](05-ai.md#ai-05-agent-skill-and-sendmock-ai-install) | Agent skill and `sendmock ai install` | Phase 4 (skill, install), Phase 5 (plugin, evals) | 4 | Not started |
| [AI-06](05-ai.md#ai-06-llmstxt) | llms.txt | Phase 4 | 1 | Not started |
| [UI-01](06-ui.md#ui-01-app-shell) | App shell | Phase U0 | 4 | In progress |
| [UI-02](06-ui.md#ui-02-mock-layer) | Mock layer | Phase U0 | 5 | In progress |
| [UI-03](06-ui.md#ui-03-overview-dashboard) | Overview dashboard | Phase U1 | 5 | In progress |
| [UI-04](06-ui.md#ui-04-empty-states-and-onboarding) | Empty states and onboarding | Phase U1 | 2 | Not started |
| [UI-05](06-ui.md#ui-05-accessibility) | Accessibility | Phase U3 | 4 | Not started |
| [UI-06](06-ui.md#ui-06-performance) | Performance | Phase U3 | 3 | Not started |
| [UI-07](06-ui.md#ui-07-design-consistency) | Design consistency | Phase U3 | 3 | Not started |
| [DS-01](07-distribution-website.md#ds-01-single-binary) | Single binary | Phase 0 (build), Phase 5 (all targets) | 3 | Not started |
| [DS-02](07-distribution-website.md#ds-02-docker-image) | Docker image | Phase 0 (`edge`), Phase 1 (`beta`), Phase 5 (stable tags, hardening) | 6 | Not started |
| [DS-03](07-distribution-website.md#ds-03-package-managers-and-install-scripts) | Package managers and install scripts | Phase 1 (beta Homebrew), Phase 5 (all) | 2 | Not started |
| [DS-04](07-distribution-website.md#ds-04-release-workflows) | Release workflows | Phase 0 | 5 | Not started |
| [DS-05](07-distribution-website.md#ds-05-version-management) | Version management | Phase 0 | 2 | Not started |
| [DS-06](07-distribution-website.md#ds-06-test-harness-integration) | Test harness integration | Phase 1 (`--ready-json`), Phase 5 (Testcontainers) | 2 | Not started |
| [DS-07](07-distribution-website.md#ds-07-performance-budgets) | Performance budgets | Phase 5 (enforced in CI) | 2 | Not started |
| [WS-01](07-distribution-website.md#ws-01-site-and-deployment) | Site and deployment | Phase U0 | 2 | Not started |
| [WS-02](07-distribution-website.md#ws-02-landing-page) | Landing page | Phase U3 | 3 | Not started |
| [WS-03](07-distribution-website.md#ws-03-docs-and-versions) | Docs and versions | Phase 0 (`/next/`), Phase 5 (complete, versioned) | 3 | Not started |
| [WS-04](07-distribution-website.md#ws-04-api-playground-demo-mode) | API playground: Demo mode | Phase U3 | 3 | Not started |
| [WS-05](07-distribution-website.md#ws-05-api-playground-local-mode) | API playground: Local mode | Phase 1 | 3 | Not started |
| [PY-01](08-payments.md#py-01-safety) | Safety | Phase 3P | 4 | Not started |
| [PY-02](08-payments.md#py-02-native-payments-api) | Native payments API | Phase 3P | 3 | Not started |
| [PY-03](08-payments.md#py-03-hosted-test-checkout-page) | Hosted test checkout page | UI in U2, live in Phase 3P | 4 | Not started |
| [PY-04](08-payments.md#py-04-stripe-emulation) | Stripe emulation | Phase 3P | 4 | Not started |
| [PY-05](08-payments.md#py-05-paypal-emulation) | PayPal emulation | Phase 3P | 3 | Not started |
| [PY-06](08-payments.md#py-06-sslcommerz-emulation) | SSLCommerz emulation | Phase 3P | 5 | Not started |
| [PY-07](08-payments.md#py-07-after-payment-operations) | After-payment operations | Phase 3P (capture, void, refund), Phase 4 (disputes, subscriptions) | 4 | Not started |
| [PY-08](08-payments.md#py-08-events-templates-and-delivery) | Events, templates and delivery | Phase 3P | 3 | Not started |
| [PY-09](08-payments.md#py-09-payments-ui) | Payments UI | UI in U2, live in Phase 3P | 4 | Not started |
| [PY-10](08-payments.md#py-10-more-gateways) | More gateways | Phase 4 (bKash, Razorpay, Paddle), later (others) | 3 | Not started |
| [PY-11](08-payments.md#py-11-cli-mcp-and-test-helpers) | CLI, MCP and test helpers | Phase 3P | 3 | Not started |
