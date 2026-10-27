# 19. User Guide

The user docs in `docs/wiki/` (published at `/docs/`) describe each feature in a short page. SendMock has grown many connected parts: a captured email can fire a rule, which renders a template with variables, which posts to an endpoint, which shows in the delivery log and on two dashboards. A new user cannot see those links from short feature pages, and cannot tell which part solves the problem they came with.

This plan turns the docs into a **user guide** that:

1. walks the sidebar **menu by menu**, in the order the app shows it, and explains every part of each screen (A to Z);
2. says **which real-life problem** each feature solves;
3. shows **how the menus connect** (what feeds a screen and what it feeds);
4. gives a **basic way to use the built-in features** right after install;
5. has an **Advanced** part on customizing each feature and creating new ones (gateways, methods, flows, templates, rules, routes, outcome rules, catcher responses);
6. has an **AI** part showing how an agent creates the same things, including a complete payment gateway, from one prompt.

Feature: **WS-06 User guide** (criteria below). Scheduled as **U3 W13**; it does not block the U3 sign-off, and pages grow with each backend phase.

## Readers and what they need

| Reader | Arrives with | Needs |
|--------|--------------|-------|
| New user | "I need to test my password reset email" | the problem index, then one recipe |
| Daily user | a screen open, unsure what a button does | the menu page for that screen |
| Power user | "our gateway is not built in" | the Advanced pages |
| AI-first user | an agent in the terminal | the AI pages: setup, prompts, what the agent does |

## Writing rules

- Plain, concrete English: say what a thing does and how to use it. Short sentences, second person ("you"), present tense.
- Every page names the **real situation** before the feature ("Your app emails a reset link. You want to click it without a real inbox.").
- Use the exact labels from the UI in **bold** (**Simulate**, **Send to webhook**) so a reader can find them on screen.
- Every page says honestly what works today: a status line under the title, "Try it in the [demo](/demo/...). Works in your install from Phase N." Pages never describe a backend feature as available before its phase.
- One screenshot per screen, captured from the mock app (no hand-made images), light theme.
- No em-dash characters; plain Markdown that reads well on GitHub and on the site (as today).
- Pages stay focused: a page that passes about 250 lines is split into sub-pages.

## Site structure

The docs sidebar follows the app sidebar, so a reader moves between the two without a map.

```
docs/wiki/
├── index.md                    Introduction (rewritten around problems, see below)
├── getting-started.md          First run with built-ins only, about 10 minutes
├── install.md                  (as today)
├── connect/                    one page per language, plus Docker (Compose, CI, webhooks)
│
├── ---Guide---
├── tour.md                     Tour of the app: sidebar, header, keys
├── how-it-connects.md          The event model and the connection map
├── use-cases.md                What can I test? Problem to feature index
│
├── ---Menus---                 One page or folder per sidebar item, in sidebar order
├── overview.md
├── mail/                       index, reading-and-checks, outcomes, replies-and-forwards, release
├── sms/                        index, delivery-and-test-numbers, replies-and-whatsapp, verify
├── http/                       index, responses
├── webhooks/                   index, endpoints, rules, inbound-routes, deliveries,
│                               composer-and-saved, templates, variables
├── payments/                   index, checkout-page, gateways, methods, flows
├── numbers.md
├── logs.md
├── settings.md                 One section per Settings section
│
├── ---Recipes---               Basic use with built-ins, one task per page
├── recipes/
│
├── ---Advanced---              Customize and create
├── advanced/
│
├── ---AI---
├── ai/                         setup, build-with-ai, payment-gateway-with-ai, prompts
│
├── ---Tools---
├── cli.md
├── configuration.md
└── troubleshooting.md
```

- Today's `email.md`, `sms.md`, `verify.md`, `webhooks.md`, `templates.md`, `variables.md`, `http-catcher.md`, `payments.md` and `mcp-and-ai.md` move into the folders above and are expanded; nothing in the app or website links to their old paths (checked), and the docs link test catches any missed link.
- Fumadocs `meta.json` files order each folder; separators name the groups.

## Page template (menu pages)

Every menu page uses the same headings, in this order, so readers learn the shape once:

```markdown
# <Menu name>

> Try it in the [demo](/demo/<path>). Works in your install from Phase <N>.

One sentence: what this screen is.

![<Menu name> screen](../images/<menu>.jpg)

## What it solves
2 to 4 real situations, each one line, each linking to a recipe when one exists.

## How it connects
| Gets from | Sends to |
A small table: which menus, events or settings feed this screen, and where its
output goes (events, deliveries, other screens), with links.

## Use it
Numbered steps with the built-in setup only (no customizing), ending in a
visible result ("the email shows **Bounced** and a delivery appears in
**Webhooks > Deliveries**").

## Everything on this screen
One short sub-heading per part, top to bottom, left to right: lists, filters,
tabs, buttons, menus, drawers, keyboard keys. This is the A to Z.

## Customize
What can be changed here, one line each, linking to the Advanced page.

## From your code
The screen's most common task in your app or test, as tabs: CLI, PHP
(Laravel), JavaScript, Python, Go, Java, Rust, Ruby, C# (added in W15, plan 21).

## From the CLI, API and AI
| Do this | CLI | API | MCP tool |
The same actions without the UI, with their phase; every cell links to its
entry in the CLI, API or MCP reference.

## Related
Links to the connected menus and recipes.
```

Sub-pages (for example `mail/outcomes.md`) use the same headings and skip any that would be empty.

## Guide pages

### Tour of the app (`tour.md`)

- The sidebar, item by item, one line each with its keyboard key (`g m` Mail, `g s` SMS, `g v` Verify, `g h` HTTP, `g w` Webhooks, `g d` Deliveries, `g p` Payments, `g n` Numbers, `g l` Logs, `g ,` Settings, `g o` Overview) and a link to its page.
- The header: command palette (`Cmd/Ctrl+K`), search, notification bell and toasts, Help menu, theme switch, the live connection dot and version.
- Shortcuts help (`?`), empty states with **how to connect** cards and sample buttons, and the demo toolbar (demo only).

### How it all connects (`how-it-connects.md`)

The one idea that explains the app: **everything your app sends becomes a message and an event; everything SendMock sends back is a delivery.**

```
                     ┌──────────── Settings change how capture behaves ────────────┐
                     │ outcome rules, profiles, chaos, OTP patterns, retention     │
                     ▼                                                             │
Your app ──SMTP, provider APIs, HTTP──►  CAPTURE                                   │
                                         Mail · SMS · Verify · HTTP · Payments     │
                                         (Logs keep the raw SMTP sessions and      │
                                          API requests behind each one)            │
                                              │                                    │
          Simulate buttons, Reply as          │ events: email.received,           │
          recipient, Verify force,  ─────────►│ sms.status, verify.started,       │
          payment Simulate, checkout page     │ http.captured, payment.succeeded  │
                                              ▼                                    │
                                         DELIVER                                   │
                Webhooks > Rules ──► Endpoint (Template + Variables + Secret) ─┐   │
                Inbound routes (incoming email) ───────────────────────────────┤   │
                Number reply webhook (incoming SMS, TwiML back) ───────────────┤   │
                SMS status callback (per message) ─────────────────────────────┤   │
                Gateway notification (IPN, payment webhook) ───────────────────┤   │
                Send to webhook, Composer, Saved (by hand) ────────────────────┘   │
                                              │                                    │
                                              ▼                                    │
                              Webhooks > Deliveries (log, retry, replay) ──► Your app
                                              │
                                              ▼
                              Overview and Webhooks > Overview (health), bell (alerts)
```

The page then has the **connection table**, one row per menu:

| Menu | Gets from | Sends to |
|------|-----------|----------|
| Overview | counts and health from every menu | links into each menu |
| Mail | your app over SMTP or an email API; Reply as recipient | `email.*` events to Rules; incoming mail to Inbound routes; Release to a real SMTP relay; Logs > SMTP |
| SMS | your app over the native, Twilio or Vonage API; replies typed in a conversation | `sms.*` events to Rules; status callbacks; the number's reply webhook (from Numbers); Logs > API requests |
| Verify | your app over the Twilio Verify API | the code as an SMS (shows in SMS) or email; `verify.*` events to Rules |
| HTTP | any HTTP call your app makes to `/catch/<bin>` | the reply your bin's rules choose; `http.captured` to Rules; Forward to URL |
| Webhooks | events from every capture menu; payments' gateway notifications | requests to your app, logged in Deliveries |
| Payments | your app over a gateway API; the test checkout page | redirects to your app; notifications through the gateway's endpoint into Deliveries; `payment.*` events to Rules |
| Numbers | your setup (like a provider console) | where inbound SMS go; which sender pool a message uses |
| Logs | the raw traffic behind Mail and SMS | links to the message each request created |
| Settings | your choices | behaviour of every capture menu; seed file for teams and CI |

Three short worked traces follow, each naming every screen it passes through:

1. **Password reset:** app sends over SMTP → Logs > SMTP session → Mail (link and code extracted) → rule on `email.received` → Endpoint with the Postmark template → Deliveries → your app.
2. **OTP login by SMS:** app calls Twilio Verify → Verify (code, countdown) → SMS conversation → status callbacks → Deliveries.
3. **Checkout:** app creates an SSLCommerz session → Payments → test checkout page → redirect back to your app → IPN through the gateway's endpoint → Deliveries → **Simulate > Refund** → a second IPN.

### What can I test? (`use-cases.md`)

A problem-first index. Each row: the situation in the reader's words, the feature, the page and recipe. Grouped by area:

| I want to... | Use | Read |
|--------------|-----|------|
| see the emails my app sends without real inboxes | Mail | [Mail](mail/index.md), recipe 1 |
| click the reset or magic link, read the code | Mail extracted codes and links | recipe 1, 2 |
| check my HTML in Outlook, Gmail and phones | Mail > Checks, device widths | [Reading and checks](mail/reading-and-checks.md) |
| handle bounces and spam complaints | magic addresses, Simulate, outcome rules | recipe 3 |
| let users reply to a notification email | Reply as recipient, Inbound routes | recipe 7 |
| receive inbound email the way Postmark, SendGrid or Mailgun sends it | built-in templates, rules | recipe 8 |
| send a real copy to a colleague, safely | Release with an allowlist | [Release](mail/release.md) |
| test SMS login without a phone or credits | SMS, Verify | recipe 2, 5 |
| handle SMS that fail with real Twilio error codes | Twilio test numbers, outcome rules | recipe 4 |
| handle STOP and two-way replies | Numbers, reply webhook, TwiML | recipe 6 |
| test a Twilio Verify login, including expiry and too many attempts | Verify, force outcome | recipe 5 |
| take test payments without a sandbox account, internet or tunnel | Payments, checkout page | recipe 9, 10 |
| test declines, 3-D Secure, refunds and disputes | test cards, Simulate | [Payments](payments/index.md) |
| test a gateway SendMock does not ship | Gateways, Methods, Flows | [Advanced: create a gateway](advanced/payment-gateway.md) |
| stop Slack, Discord or push alerts reaching real people | HTTP catcher presets | recipe 11 |
| see how my app copes when an API is slow or fails | catcher response rules (delay, failure rate) | [Advanced: catcher responses](advanced/catcher-responses.md) |
| find out why my webhook handler fails, fix it, try again | Deliveries, Replay, Edit and replay | recipe 12 |
| check my handler verifies signatures | endpoint secret, Rotate secret | [Endpoints](webhooks/endpoints.md) |
| find out why my app's email or SMS never arrived | Logs | [Logs](logs.md) |
| see how my app copes when the mail server fails | Settings > Chaos | [Advanced: chaos](advanced/chaos.md) |
| give my team and CI the same setup | seed file | recipe 13 |
| let an AI agent set all this up | MCP, CLI, skill | [AI](ai/index.md) |

### Introduction and Getting started

- **Introduction** opens with the problem ("your app sends email, SMS, payments and webhooks; testing them for real is slow, costly and risky") and the three-step idea (point your app at SendMock, see everything, send events back), then links to the problem index and the tour.
- **Getting started** becomes a 10-minute first run using built-ins only: install, open the UI, press **Send a sample email** and **Send a sample SMS**, connect your app with **Settings > Connection**, send one real message, then add one endpoint and rule with **Add a catcher endpoint** so the first delivery lands in the HTTP catcher without touching your app.

## Menu pages: content outline

Each outline lists what the page's **What it solves**, **How it connects**, **Use it** and **Everything on this screen** cover. The detail comes from [07-ui.md](07-ui.md) and the feature plans; the page explains it for users.

### Overview

- **Solves:** "did my last test send anything?", "which webhook is failing?", "where do I point my app?".
- **Connects:** reads counts from Mail, SMS, Verify, HTTP, Payments and Webhooks; every tile and row links to its screen.
- **Use it:** open the app, read the KPI row, click a failure to open its delivery, copy the SMTP and API addresses from **Connect your app**.
- **A to Z:** KPI tiles, Activity chart (and **Show as table**), Webhooks by endpoint, Recent failures, Latest messages, Connect your app card.

### Mail

- **Solves:** testing every email without real inboxes or spamming users; reading codes and links in tests; checking HTML across clients; bounce, complaint and unsubscribe handling; reply-by-email features; sending one real copy safely.
- **Connects:** gets mail over SMTP (Logs > SMTP), provider APIs and the native API (Logs > API requests); fires `email.*` events to Webhooks > Rules; incoming mail goes to Inbound routes; outcome rules and the delivery profile come from Settings > Email; OTP patterns from Settings > OTP patterns; Release uses the relay and allowlist in Settings > Email.
- **Use it:** send a sample, open it, copy the code, press **Simulate > Bounce (hard)** and watch the timeline.
- **A to Z (split over sub-pages):**
  - `index`: list, search prefixes (`from:`, `to:`, `tag:`, `is:unread`, `is:inbound`, `has:attachment`, `source:`), chips, bulk select, Delete all, keys `j` `k` `Enter` `d` `/`.
  - `reading-and-checks`: HTML (device widths, load images, Screenshot), Text, Source, Headers (List-Unsubscribe warnings), Attachments, MIME, Checks (client support, links, spam score), Timeline, Template data, extracted codes and links, opened indicator.
  - `outcomes`: Simulate menu, magic addresses table, delivery profile, custom outcome addresses (link to Advanced), the events and provider formats each outcome sends.
  - `replies-and-forwards`: Reply, Reply all, Forward as recipient, what the incoming email looks like, inbound domains, how Inbound routes deliver it.
  - `release`: relay SMTP, allowlist, why it is off by default.
  - Plus **Send to webhook** (shared with SMS, explained once in Webhooks and linked).

### SMS (with Verify)

- **Solves:** OTP and alert SMS without a phone or provider credits; Twilio error codes and failed deliveries; status callback handling; STOP and two-way conversations; WhatsApp and MMS media; long or Unicode messages that split into segments.
- **Connects:** gets messages over the native, Twilio and Vonage APIs (Logs > API requests); fires `sms.*` events to Rules; calls each message's status callback; replies typed in a conversation go to the number's reply webhook set in Numbers, and TwiML answers come back into the conversation; simulation profile, failure rate and outcome numbers come from Settings > SMS.
- **Use it:** send a sample SMS, open the conversation, watch the ticks change, reply "YES" as the contact.
- **A to Z:**
  - `index`: thread list, channel badges, conversation bubbles, ticks, segment and encoding badges, Messaging Service badge, message drawer (status timeline, request JSON, callback attempts, media), Simulate read, set status by hand.
  - `delivery-and-test-numbers`: profiles (instant, realistic, manual), failure rate, Twilio `To` and `From` test numbers with their codes, SendMock after-send numbers, strict Twilio test mode, custom outcome numbers (link to Advanced).
  - `replies-and-whatsapp`: reply composer, format picker, media, reply webhook result line, Reply webhook tab, fallback URL, TwiML replies, Resend reply webhook.
  - `verify`: Verifications tab (code, countdown, attempts), detail drawer and force buttons, Services tab (code length, fixed code for automated tests, lifetime), Start a sample verification.

### HTTP Catcher

- **Solves:** Slack, Discord, Teams, Telegram and push notifications going to real people during development; seeing exactly what your app sent to a third-party API; testing how your app handles slow or failing APIs.
- **Connects:** gets any HTTP call to `/catch/<bin>/...`; answers with the bin's response rules; fires `http.captured` to Rules; **Forward to URL** sends a request on; **Send to webhook** turns it into a delivery; Webhooks' **Add a catcher endpoint** points test deliveries here.
- **Use it:** create a bin with the Slack preset, point your app's Slack webhook URL at the catch URL, trigger an alert, see it rendered as a Slack message.
- **A to Z:** bins list, presets, catch URL, Clear requests, Delete bin, Requests tab, request detail tabs (Preview, Body, Headers, Query, Response), Copy as cURL, Forward to URL, Send to webhook, Responses tab (rules, default reply; detail in `responses`).

### Webhooks

- **Solves:** testing the handlers your app runs for provider webhooks (inbound email, inbound SMS, delivery events, payment notifications) without a public URL or tunnel; checking signature verification; reproducing, fixing and replaying a failed webhook; sending alerts to your team's chat.
- **Connects:** gets events from Mail, SMS, Verify, HTTP and Payments; Rules pick events and filter them, Endpoints say where and how (Template, Variables, Secret, Retries), Deliveries log everything sent (including Inbound routes, reply webhooks, status callbacks and gateway notifications); Overview and the home Overview summarise it.
- **Use it:** on Endpoints press **Add a catcher endpoint**, then **Send test**; add a rule for `email.received`; send a sample email; open the delivery.
- **A to Z (one sub-page each):**
  - `index`: the concepts in one page (event, rule, endpoint, template, variable, delivery) and the Webhooks Overview screen (ranges, tiles, chart, by endpoint, top failure codes).
  - `endpoints`: table, sparkline, Docker hint, edit sheet tabs (General, Request or Template, Security, Retries, Variables), Send test.
  - `rules`: list order, filter builder (all / any, not, groups), fields per event, preview of the last 50 messages.
  - `inbound-routes`: priority, filters (match recipient, match header, catch all), actions (forward to URL or email, store and notify, stop), named groups, preview.
  - `deliveries`: log, chips, drawer (attempts, request and response), Copy as cURL, Replay, Edit and replay, Cancel retries, Save.
  - `composer-and-saved`: Send to webhook dialog, Composer, Saved deliveries (Send, Rename, Save as template).
  - `templates`: gallery, families (act like the provider, notify a tool), detail, preview, Use in new endpoint, revisions.
  - `variables`: kinds, scopes and precedence, Resolves to, Regenerate.

### Payments

- **Solves:** building checkout without sandbox accounts, internet or a tunnel for IPN; testing success, declines, 3-D Secure, cancel and delay; refunds, captures and disputes after payment; regional gateways (SSLCommerz, bKash) whose sandboxes are limited; a gateway SendMock does not ship.
- **Connects:** gets payments over each gateway's API or the native API; the test checkout page drives the outcome; redirects go to your app's success, fail and cancel URLs; notifications go through the gateway's notification endpoint (a Webhooks endpoint) into Deliveries; `payment.*` events reach Rules; Gateways use Methods, Methods use Flows; outcome profile, merchant name and test values come from Settings > Payments.
- **Use it:** on Gateways open **Open a test checkout** for Stripe, pay with `4242 4242 4242 4242`, see the redirect and notification, then **Simulate > Refund**.
- **A to Z:**
  - `index`: All payments list, filters, detail drawer (timeline, redirects, notifications), Simulate menu by status, Resend notification, test cards and wallets.
  - `checkout-page`: test mode banner, method picker and tabs, each built-in flow step, test controls, 3-D Secure, the result and Return to merchant, closed sessions, the "Use a test card" safety rule.
  - `gateways`, `methods`, `flows`: each screen's table and edit sheet, Modified and Reset to default, with the "how they fit together" diagram: **Gateway** offers **Methods** in order, each **Method** runs one **Flow**, a **Flow** is steps from the step catalogue.

### Numbers

- **Solves:** two-way SMS needs a number set up the way you would in the Twilio console (inbound URL, fallback, status callback); sender pools through Messaging Services.
- **Connects:** inbound SMS from the SMS conversation go to the number's (or its Messaging Service's) reply webhook; outbound messages from a Messaging Service pick a number from its pool; both show in SMS and Deliveries.
- **Use it:** **Add a sample number**, set its inbound URL to a catcher bin, reply in a conversation, see the request in HTTP.
- **A to Z:** Numbers tab and sheet, Messaging Services tab and sheet, inbound handling choices.

### Logs

- **Solves:** "my app says it sent, but nothing shows up": SMTP AUTH or TLS problems, rejected sessions, provider API calls answered 400 with the reason.
- **Connects:** every SMTP session behind Mail and every API request behind SMS, Verify, Payments and email APIs; each row links to the message it created.
- **A to Z:** SMTP tab (filters, transcript viewer, Copy transcript, Open email), API requests tab (filters, request and response bodies, Open message).

### Settings

One page, one section per Settings section in app order, each with what it solves:

| Section | Solves |
|---------|--------|
| General | the database growing forever; starting clean (Delete all, Reset to seed) |
| Seed | the same setup for every teammate and every CI run |
| Email | bounce and complaint tests (magic and custom outcome addresses, delivery profile), reply domains, safe release |
| SMS | failure and delay tests (profile, failure rate, magic and custom outcome numbers, strict Twilio test mode) |
| Payments | merchant name, default currency, auto outcomes for automated tests, the test values to type |
| Notifications | pop-ups while you work, or bell only |
| Opened events | testing read receipts and open tracking |
| Chaos | testing your app when the mail server rejects, is slow or drops the connection |
| OTP patterns | your app's code format is not found by default |
| Connection | copy-ready settings for your language and where your app runs (host, Docker, Compose) |
| About | version, listeners, update check, help links |

## Recipes (basic use)

Short task pages using **built-ins only**, each: the situation, what you need, numbered steps (UI first, then the same with the CLI), **In your code** (the whole flow as a test in every supported language, added in W15, see [21](21-reference-and-examples.md#5-code-examples-in-every-supported-language)), what you should see, and next steps. Planned list:

1. Catch your app's password reset email and click the link.
2. Read a one-time code from an email or SMS (UI copy button, `sendmock otp`).
3. Test bounce and complaint handling with magic addresses.
4. Test failed SMS with Twilio's test numbers.
5. Log in with Twilio Verify, then force an expired code and too many attempts.
6. Two-way SMS: a user replies STOP and your app answers with TwiML.
7. Reply by email: a user answers a ticket notification.
8. Receive inbound email in Postmark, SendGrid or Mailgun format.
9. Take a Stripe test payment and handle its webhook.
10. SSLCommerz or bKash checkout with redirect and IPN.
11. Keep Slack and push notifications away from real people.
12. Debug a failing webhook handler and replay the delivery.
13. Share your setup with your team and CI with the seed file.

## Advanced: customize and create

Each page: what you can change, when you would, a step-by-step walkthrough in the UI, the same as a seed file snippet, the same with the CLI, how to undo (Reset to default, Delete, Restore a revision), and limits (what still needs code).

| Page | Creates or changes |
|------|--------------------|
| `email-outcome-addresses` | your own bounce, defer, complaint, unsubscribe and reject addresses |
| `sms-outcome-numbers` | your own failing, delayed and read numbers |
| `otp-patterns` | patterns for your code format, with the tester |
| `templates` | edit a built-in (Modified, Reset to default), create from blank, clone, Save as template, import and export, templates directory for teams, revisions |
| `request-editor` | body modes (Template, Fields, Raw, None), Strict and Lenient rendering, functions and filters |
| `variables` | Dynamic, Random (per send or fixed), Computed and Prompt variables, secrets, overrides at send time |
| `rules-and-filters` | grouped filters, `not`, header fields, regex, order |
| `inbound-routes` | `reply+<token>` routing with named groups, store and notify, Mailgun Routes API |
| `catcher-responses` | response rules per path and method, templated echo bodies, delay, failure rate |
| `numbers-and-services` | numbers with reply webhooks, Messaging Services and sender pools |
| `payment-flow` | compose checkout steps from the step catalogue, labels and label variables |
| `payment-method` | a new wallet, card or bank method with its test values |
| `payment-gateway` | a **complete gateway from scratch** (see below) and editing a built-in |
| `chaos` | SMTP rejections, latency and dropped connections |
| `seed-file` | export, commit, validate, apply in CI, secrets as `${ENV}` |
| `scenarios` | repeatable multi-step tests in TOML (Phase 4) |

**Complete gateway walkthrough** (`advanced/payment-gateway.md`), using a provider SendMock does not ship, Upay (a mobile wallet: account number, OTP, PIN), so a method and a gateway are both needed (Nagad was the first idea, but it already ships as a method):

1. **Flow:** does a built-in flow match the provider's checkout? Wallet (number, OTP, PIN) does; otherwise compose one in Payments > Flows.
2. **Method:** Payments > Methods > **Add method**, pick the flow, set the accent colour and test values (test numbers with outcomes, OTP, PIN).
3. **Gateway:** Payments > Gateways > **Add gateway**, start from blank or the closest built-in. Then each tab: General, Checkout (add the method), Merchant (credentials, notification endpoint), Redirect (GET or POST, fields from the provider's docs), Notification (event names, body template, signature header with the template functions).
4. **Preview:** render the redirect and notification against a payment, fix problems shown under each part.
5. **Try it:** **Open a test checkout**, pay with a test number, check the redirect and the notification in Deliveries.
6. **Point your app at it:** base URL `/providers/<key>/...`, the credentials you set.
7. **Keep it:** Settings > Seed > **Export**, commit `sendmock.seed.toml`.
8. **Limits:** a new step type, or provider API calls beyond session init and validation, need code; open a provider request issue.

## AI: build it with an agent

Every create and update above is an operation in the registry, so an agent can do it through MCP or the CLI with the same validation as the UI ([14-ai-integration.md](14-ai-integration.md)). The AI pages show how:

- **`ai/index` (setup):** `sendmock ai install --target claude-code|codex|cursor|gemini|vscode`, what gets installed (MCP server, skill), toolsets and `--read-only`, the safety rules (asks before destructive actions, never reads secrets back, `created_by` badge on what an agent made).
- **`ai/build-with-ai`:** one row per thing you can create, with a prompt that works, what the agent does and the tools it uses:

  | Say | The agent | Uses |
  |-----|-----------|------|
  | "Add the Upay gateway; docs: <url>" | reads the docs, creates the flow (if needed), method and gateway, previews, runs a test checkout, exports the seed | `add-payment-gateway` prompt, `sendmock_payment_*` tools |
  | "Make a QR wallet flow" | lists step types, adds steps with labels, attaches it to a method | `add-payment-flow`, `sendmock_payment_flow_step_*` |
  | "Send Africa's Talking inbound SMS to my app" | clones the closest template, edits the fields, previews against a sample | `sendmock_webhook_template_*` |
  | "Post every email to support@ to my app in Postmark format" | creates the endpoint with the template and a rule with a filter, sends a test | `setup-inbound-webhook`, endpoint and rule tools |
  | "Make the Slack bin return 429 one time in ten" | adds a response rule with a failure rate | `sendmock_http_response_set` |
  | "Make qa+fail@ always bounce and +1555777* always fail with 30007" | creates outcome rules | outcome rule tools |
  | "Route reply+<ticket>@ to my app" | creates an inbound route with a named group, previews it | inbound route tools |
  | "Why did my webhook fail?" | reads the delivery, explains the error, replays after the fix | `debug-failed-webhook` |
  | "Test my OTP login" | triggers the flow, waits for the SMS, reads the code, finishes the login, writes a scenario | `test-otp-flow`, `sendmock_otp_get` |

- **`ai/payment-gateway-with-ai`:** the full worked example: the prompt, each step the agent takes (with the tool calls), what you check in the UI (Gateways shows the new gateway with its methods, the checkout page uses the flow, Deliveries shows the notification), how to fix what the agent got wrong (edit in the UI, or ask again), and exporting to the seed file. Prompt tips: link the provider's API docs, paste a sample IPN, name the signature scheme, ask for a test checkout and a seed export at the end.
- **`ai/prompts`:** the built-in MCP prompts (`setup-email-capture`, `setup-sms-capture`, `setup-inbound-webhook`, `test-otp-flow`, `simulate-sms-conversation`, `debug-failed-webhook`, `add-payment-flow`, `add-payment-gateway`) with when to use each.
- Phases: CLI and MCP tools arrive with each backend phase (payments in 3P), the skill, prompts and `sendmock ai install` in Phase 4. Each AI page carries the status line like every other page.

## Deeper: every control explained (planned 2026-10-27, owner feedback F17; not started)

A later layer of the guide, for readers who want to know exactly what each thing on a screen does. The menu pages explain a screen as a whole; these pages go one level down, control by control. **Not built now:** it starts once a screen has its live mode in Stage B, so the pages describe the real behaviour, and it is complete before 1.0 (Phase 5).

- **What is covered, for every screen:** every button, menu item, switch, tab, field, filter, column, badge and keyboard shortcut, and every text the screen can show (empty states, errors, toasts, confirmation dialogs, status labels).
- **What each entry says**, in plain words:
  1. its name as the screen shows it, and where it is (numbered on an annotated screenshot);
  2. what it does, step by step, and what you see afterwards;
  3. what it changes or sends: stored data, events, the webhooks and rules it can trigger, the log entries it writes;
  4. where its text and numbers come from: the setting, seed file key, provider definition or API field behind them;
  5. how it links to other screens (for example a message badge opening its provider, a delivery opening its rule);
  6. the same action from the CLI, REST API and MCP, from the surface catalogue;
  7. the errors it can show, why, and what to do.
- **Where:** one page per screen under `docs/wiki/deeper/<menu>/<screen>.md`, in a new **Deeper** section of the sidebar under Advanced. Each menu page's "Everything on this screen" ends with a link to its Deeper page.
- **Kept true, not hand-maintained:**
  - an inventory of every control and text per screen is read from the demo app by a Playwright crawl (accessible names and roles), and a test fails when a control has no entry or an entry names a control that no longer exists;
  - "where it comes from" and "the same action from the CLI, REST API and MCP" are generated from the OpenAPI spec and the surface catalogue, as the menu pages' tables already are;
  - the annotated screenshots come from `bun run screenshots` scenes with numbered markers.
- **Order:** the screens people use most first (Mail, SMS and Verify, Webhooks, Payments), then the rest, each in the same pull request as its live mode where possible.
- Criteria: WS-10 in [acceptance](acceptance/07-distribution-website.md#ws-10-deeper-docs-every-control).

## Screenshots

- `bun run screenshots` (website) gains a scene per menu and sub-page that has its own screen (about 25), written to `docs/wiki/images/<page>.jpg` in the light theme, as today's four are.
- Images stay JPEG at quality 80; the total added is expected around 2.5 MB, checked when the scenes are added.

## Acceptance criteria: WS-06 User guide

In [acceptance/07-distribution-website.md](acceptance/07-distribution-website.md#ws-06-user-guide):

- WS-06.1 Every sidebar item and every Settings section has a guide page with the template headings (What it solves, How it connects, Use it, Everything on this screen, Customize, From the CLI, API and AI); the test reads the list from `navigation-items.ts` and `settings-sections.ts`, so a new menu without a page fails CI.
- WS-06.2 Every menu page shows its screenshot, produced by `bun run screenshots`.
- WS-06.3 The connection map and the problem index link to every menu page, and every recipe and Advanced page is linked from at least one menu page.
- WS-06.4 The UI steps of the recipes and the Advanced walkthroughs (gateway, method, flow, template, catcher response, inbound route, outcome rules) are followed by Playwright tests in the demo, so a renamed button fails CI.
- WS-06.5 Every CLI command and MCP tool named in the AI pages exists in the generated reference (checked once WS-03.2 generates it in Phase 0).

The existing docs test (published pages, broken links and anchors) keeps covering the new pages.

## Order of work

On branch `docs/user-guide-plan`, one commit per step:

1. Structure: folders, `meta.json`, moved pages, status lines; Tour, How it all connects, What can I test; the WS-06.1 and WS-06.3 tests.
2. Menu pages in sidebar order: Overview, Mail, SMS and Verify, HTTP, Webhooks, Payments, Numbers, Logs, Settings, with screenshots (WS-06.2).
3. Introduction and Getting started rewritten; Recipes.
4. Advanced pages, the gateway walkthrough first.
5. AI pages.
6. Walkthrough tests (WS-06.4); acceptance file and PROGRESS ticked.

## As built (2026-10-26)

- **Pages:** 81 Markdown pages in `docs/wiki/`: the guide pages (Tour, How it all connects, What can I test?), a page or folder per sidebar menu in sidebar order (Mail 5 pages, SMS 4 with Verify, HTTP 2, Webhooks 8, Payments 5, and Overview, Numbers, Logs, Settings), 13 recipes, 16 Advanced pages, 4 AI pages, and the existing install, connect and tools pages. The old feature pages moved into their folders (`git mv`), and Introduction and Getting started were rewritten.
- **Accuracy:** UI labels in the steps were taken from the components and e2e tests; API paths from the frozen spec; CLI commands and MCP tools from [14-ai-integration.md](14-ai-integration.md) (WS-06.5 checks them once the reference is generated). Every page carries its phase status line.
- **Walkthrough example:** Upay instead of Nagad, because Nagad already ships as a method. The demo's preview renderer knows only a few filters, so the gateway walkthrough says to leave the `hmac_sha256` signature header out when trying it in the demo.
- **Screenshots:** `website/scripts/screenshot-scenes.ts` holds the scenes; landing scenes keep both themes, the 17 new docs scenes are light only (1.6 MB for all 21 docs images). Toasts are hidden with CSS during capture: removing the toaster node made React crash the page on the next toast, which left blank shots.
- **Tests:** `website/tests/guide.spec.ts` (WS-06.1 to WS-06.3, file based, reading the sidebar and Settings sections from the web source) and `web/tests/e2e/guide-recipes.spec.ts` and `guide-advanced.spec.ts` (WS-06.4, 19 tests following each recipe's "Try it in the demo" steps and the Advanced walkthroughs). The structure test caught two pages without the template headings, fixed. Front matter values must not contain `: ` (YAML), which broke the site build once.
- **WS-06.5:** first planned to wait for the generated reference in Phase 0; the surface catalogue of W14 ([20](20-surface-parity.md)) made it checkable now, so a contract test reads every command and tool in the guide against it.

